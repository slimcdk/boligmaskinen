/**
 * Blocks compiled to SQL, so PostgreSQL can score homes as the browser scores cells (milestone 4):
 * the same points from the same code, without sending millions of homes to a browser.
 *
 * It mirrors codegen.ts. Missing data is NULL in SQL, as it is NaN in JavaScript, and every helper
 * there has a CASE here that gives the same number, NULL where it gives NaN. Where PostgreSQL
 * would stop with an error and JavaScript goes on (a division by zero, the square root or
 * logarithm of a negative number, a negative number to a fraction), the SQL gives what JavaScript
 * gives instead. Two things differ: an overflow past ±1.8e308, which JavaScript turns into
 * Infinity, stops the query; and the browser keeps a block's scores as 32-bit floats, so the
 * points agree to about 1e-5.
 *
 * Like the generated JavaScript, the SQL is made from the parsed formula alone: numbers the
 * tokenizer read, the column expressions the caller gives for the value names, and a fixed set of
 * operators. Nothing the user wrote is copied into it.
 */
import { type Block } from './blocks.ts';
import { compileCached, CONSTANTS, describeError, type Expr, parseProgram } from './formula.ts';
import { LANGUAGE_VERSION, languageOf, upgradeCode } from './migrations.ts';

/** The SQL for each value name a block may read, such as `h.forest`; the caller vouches for them. */
export type SqlColumns = Readonly<Record<string, string>>;

export interface BlockSql {
  /** Its score (preference) or 1/0 (requirement) per row; NULL without data, or for a score outside 0–1. */
  value: string;
  /** True on the rows where a preference gives a score outside 0–1. In the browser such a block does not count at all. */
  outside: string;
}

const NULL = 'NULL::float8';

function literal(value: number): string {
  if (Number.isNaN(value)) return NULL;
  if (!Number.isFinite(value)) return value > 0 ? `'Infinity'::float8` : `'-Infinity'::float8`;
  return `(${Object.is(value, -0) ? '-0' : String(value)})::float8`;
}

const isNull = (a: string) => `(${a}) IS NULL`;
/** A JavaScript boolean as a number: 1, 0, or NULL where a side has no data. */
const compare = (a: string, op: string, b: string) => `(CASE WHEN ${isNull(a)} OR ${isNull(b)} THEN ${NULL} WHEN (${a}) ${op} (${b}) THEN 1::float8 ELSE 0::float8 END)`;
const COMPARISONS: Record<string, string> = { '<': '<', '<=': '<=', '>': '>', '>=': '>=', '==': '=', '===': '=', '!=': '<>', '!==': '<>' };

/** a / b as JavaScript does it: ±Infinity, or NaN for 0 / 0. */
const divide = (a: string, b: string) =>
  `(CASE WHEN (${b}) = 0 THEN (CASE WHEN (${a}) > 0 THEN 'Infinity'::float8 WHEN (${a}) < 0 THEN '-Infinity'::float8 ELSE ${NULL} END) ELSE NULLIF((${a}) / (${b}), 'NaN') END)`;
/** a % b: the remainder with the sign of a, NaN by 0 or of an infinity. */
const remainder = (a: string, b: string) =>
  `(CASE WHEN (${b}) = 0 OR abs(${a}) = 'Infinity' THEN ${NULL} WHEN abs(${b}) = 'Infinity' THEN (${a}) ELSE (${a}) - (${b}) * trunc((${a}) / (${b})) END)`;
/** Math.pow: anything to the power 0 is 1, even NaN; a negative number to a fraction is NaN. */
const power = (a: string, b: string) =>
  `(CASE WHEN (${b}) = 0 THEN 1::float8 WHEN ${isNull(a)} OR ${isNull(b)} THEN ${NULL} WHEN (${a}) < 0 AND (${b}) <> floor(${b}) THEN ${NULL} WHEN (${a}) = 0 AND (${b}) < 0 THEN 'Infinity'::float8 ELSE power(${a}, ${b}) END)`;
const allKnown = (args: string[]) => args.map(isNull).join(' OR ');

function expression(expr: Expr, scope: Map<string, string>): string {
  const sql = (e: Expr) => expression(e, scope);
  switch (expr.t) {
    case 'num':
      return literal(expr.v);
    case 'var': {
      const bound = scope.get(expr.name);
      if (bound !== undefined) return bound;
      const constant = CONSTANTS[expr.name];
      if (constant) return literal(constant.value);
      throw new Error(`Unknown name ${expr.name}`);
    }
    case 'un': {
      const a = sql(expr.a);
      if (expr.op === '-') return `(-(${a}))`;
      if (expr.op === '!') return `(CASE WHEN ${isNull(a)} THEN ${NULL} WHEN (${a}) = 0 THEN 1::float8 ELSE 0::float8 END)`;
      return a;
    }
    case 'bin': {
      const [a, b] = [sql(expr.a), sql(expr.b)];
      switch (expr.op) {
        // Infinity - Infinity and the like are NaN in both, which is no data
        case '+': case '-': case '*': return `NULLIF((${a}) ${expr.op} (${b}), 'NaN')`;
        case '/': return divide(a, b);
        case '%': return remainder(a, b);
        case '**': return power(a, b);
        // Three-valued logic: missing data only decides when the other side cannot
        case '&&': return `(CASE WHEN (${a}) = 0 OR (${b}) = 0 THEN 0::float8 WHEN ${isNull(a)} OR ${isNull(b)} THEN ${NULL} ELSE 1::float8 END)`;
        case '||': return `(CASE WHEN (${a}) <> 0 OR (${b}) <> 0 THEN 1::float8 WHEN ${isNull(a)} OR ${isNull(b)} THEN ${NULL} ELSE 0::float8 END)`;
        default: {
          const op = COMPARISONS[expr.op];
          if (!op) throw new Error(`Unknown operator ${expr.op}`);
          return compare(a, op, b);
        }
      }
    }
    case 'cond': {
      const [c, a, b] = [sql(expr.c), sql(expr.a), sql(expr.b)];
      return `(CASE WHEN ${isNull(c)} THEN ${NULL} WHEN (${c}) <> 0 THEN ${a} ELSE ${b} END)`;
    }
    case 'call': {
      const args = expr.args.map(sql);
      const [x, y, z] = args;
      switch (expr.name) {
        case 'ramp': {
          // utility() in engine.ts: equal ends give 1 up to them, also where x has no data
          const u = divide(`(${z}) - (${x})`, `(${z}) - (${y})`);
          return `(CASE WHEN (${y}) = (${z}) THEN (CASE WHEN (${x}) <= (${y}) THEN 1::float8 ELSE 0::float8 END) `
            + `WHEN ${isNull(u)} THEN ${NULL} WHEN ${u} <= 0 THEN 0::float8 WHEN ${u} > 1 THEN 1::float8 ELSE ${u} END)`;
        }
        case 'clamp': {
          const [lo, hi] = [y ?? '0::float8', z ?? '1::float8'];
          return `(CASE WHEN ${allKnown([x, lo, hi])} THEN ${NULL} ELSE LEAST(${hi}, GREATEST(${lo}, ${x})) END)`;
        }
        case 'min': case 'max':
          return `(CASE WHEN ${allKnown(args)} THEN ${NULL} ELSE ${expr.name === 'min' ? 'LEAST' : 'GREATEST'}(${args.join(', ')}) END)`;
        case 'abs': return `abs(${x})`;
        case 'sqrt': return `(CASE WHEN (${x}) < 0 THEN ${NULL} ELSE sqrt(${x}) END)`;
        case 'pow': return power(x, y);
        // Past these, JavaScript gives Infinity and 0, where PostgreSQL stops with an error
        case 'exp': return `(CASE WHEN (${x}) > 709.78 THEN 'Infinity'::float8 WHEN (${x}) < -745.2 THEN 0::float8 ELSE exp(${x}) END)`;
        case 'log': return `(CASE WHEN (${x}) < 0 THEN ${NULL} WHEN (${x}) = 0 THEN '-Infinity'::float8 ELSE ln(${x}) END)`;
        // Math.round: halves up, -2.5 to -2
        case 'round': return `floor((${x}) + 0.5)`;
        case 'floor': return `floor(${x})`;
        case 'ceil': return `ceil(${x})`;
        case 'known': return `(CASE WHEN ${isNull(x)} THEN 0::float8 ELSE 1::float8 END)`;
        case 'fallback': return `COALESCE(${x}, ${y})`;
        case 'slider': return x;
        case 'choice':
          return `(CASE floor((${x}) + 0.5) ${args.slice(1).map((option, k) => `WHEN ${k + 1} THEN ${option}`).join(' ')} ELSE ${NULL} END)`;
        default:
          throw new Error(`Unknown function ${expr.name}`);
      }
    }
  }
}

/** A block as SQL over the given columns, or why it cannot run, as runBlock in blocks.ts says it. */
export function blockSql(block: Block, columns: SqlColumns): BlockSql | { issue: string } {
  let code = block.code;
  if (languageOf(block) !== LANGUAGE_VERSION) {
    const upgrade = upgradeCode(code, languageOf(block));
    if (!upgrade.ok) return { issue: upgrade.problem! };
    code = upgrade.code;
  }
  const names = Object.keys(columns);
  const compiled = compileCached(code, names);
  if (!compiled.ok) return { issue: describeError(compiled.error) };
  const program = parseProgram(code);
  // The `let` lines are written into the expressions that read them
  const scope = new Map(names.map((name) => [name, `(${columns[name]})`]));
  for (const line of program.lets) scope.set(line.name, `(${expression(line.expr, scope)})`);
  const r = expression(program.result, scope);
  if (block.role !== 'want') {
    return { value: `(CASE WHEN ${isNull(r)} THEN ${NULL} WHEN (${r}) <> 0 THEN 1::float8 ELSE 0::float8 END)`, outside: 'false' };
  }
  return {
    value: `(CASE WHEN (${r}) >= 0 AND (${r}) <= 1 THEN (${r}) ELSE ${NULL} END)`,
    outside: `COALESCE(NOT ((${r}) >= 0 AND (${r}) <= 1), false)`,
  };
}

export interface WeightingSql {
  /**
   * The points per row, 0–100, as evaluateBlocks in blocks.ts gives them: the preferences averaged
   * by their weights over the ones with data, 100 where none has data; NULL where a requirement
   * fails. Null when no preference counts.
   */
  points: string | null;
  /** Blocks that cannot run, with the reason; they count for nothing, as in the browser. */
  issues: Map<string, string>;
  /** Per block that runs, its SQL. A preference with a score outside 0–1 on any row does not count in the browser, so check `outside` first. */
  blocks: Map<string, BlockSql>;
}

/** The weighting of the blocks as SQL. Blocks that are switched off are the caller's to leave out, as in the browser. */
export function weightingSql(blocks: Block[], columns: SqlColumns): WeightingSql {
  const issues = new Map<string, string>();
  const compiled = new Map<string, BlockSql>();
  const wants: { value: string; weight: number }[] = [];
  const musts: string[] = [];
  for (const block of blocks) {
    if (block.role === 'want' && block.weight <= 0) continue;
    const sql = blockSql(block, columns);
    if ('issue' in sql) { issues.set(block.id, sql.issue); continue; }
    compiled.set(block.id, sql);
    if (block.role === 'want') wants.push({ value: sql.value, weight: block.weight });
    else musts.push(sql.value);
  }
  if (!wants.length) return { points: null, issues, blocks: compiled };
  const sum = wants.map((w) => `COALESCE(${w.value} * ${literal(w.weight)}, 0)`).join(' + ');
  const weight = wants.map((w) => `(CASE WHEN ${isNull(w.value)} THEN 0 ELSE ${literal(w.weight)} END)`).join(' + ');
  const points = `(CASE WHEN (${weight}) > 0 THEN LEAST(100::float8, GREATEST(0::float8, ((${sum}) / (${weight})) * 100)) ELSE 100::float8 END)`;
  // A requirement fails at 0; missing data passes
  const fails = musts.map((m) => `(${m}) = 0`).join(' OR ');
  return { points: musts.length ? `(CASE WHEN ${fails} THEN ${NULL} ELSE ${points} END)` : points, issues, blocks: compiled };
}
