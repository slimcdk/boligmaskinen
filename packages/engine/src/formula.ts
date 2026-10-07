/**
 * The block language: a small, safe expression language.
 *
 * Every block in the weighting is a formula over the data, for example
 * `ramp(forest, 300, 3000)` or `noise < 55 ? 1 : 0.3`. Predefined blocks are formulas too,
 * which the user can read and change. The code is parsed and compiled into plain closures.
 * It is never run as JavaScript, so it can only do arithmetic on the data, and it behaves
 * the same in the browser and on a server.
 *
 * Syntax: numbers, true/false, value names, + - * / % **, comparisons, && || !, a ? b : c,
 * function calls and `let name = …` lines before the result. `//` starts a comment.
 * Missing data is NaN and spreads: through arithmetic, and through comparisons and logic unless
 * the answer is given anyway (`false && x` is false, `true || x` is true). A NaN result means
 * "no data", so a requirement never removes a cell because data is missing. known(x) and
 * fallback(x, y) handle missing data on purpose.
 *
 * Like free values in GeoGebra, some `let` lines become controls in the side panel:
 * - `let reach = 3000` or `let reach = slider(3000, 0, 10000, 100)` becomes a slider,
 * - `let byzone = true` becomes a switch,
 * - `let travel = choice(1, work_car, work_bike)` becomes a choice between the values.
 * A comment at the end of the line is the control's label, and "(m)", "(min)", "(dB)" or
 * "(%)" at its end is the unit. Changing a control rewrites the value in the code.
 */
import { utility } from './engine.ts';

export interface FormulaError {
  message: string;
  line: number;
  column: number;
}

/** A value in the code that the side panel shows as a control. */
export interface FormulaParam {
  kind: 'number' | 'flag' | 'choice';
  name: string;
  /** From the comment at the end of the line, or the name. */
  label: string;
  unit: string;
  /** Number, 1/0 for a flag, or the 1-based option for a choice. */
  value: number;
  min: number;
  max: number;
  step: number;
  /** True when the code sets the range, with slider(…); otherwise it follows the value. */
  fixedRange: boolean;
  /** choice: what the options are called. */
  options: string[];
  /** Where the value is in the source, to rewrite it. */
  start: number;
  end: number;
}

export interface CompiledFormula {
  /** Value names in the order run() expects them. */
  inputs: string[];
  /** Names the code actually reads. */
  uses: string[];
  params: FormulaParam[];
  /** Booleans come out as 1 and 0. */
  run(values: ArrayLike<number>): number;
}

export type CompileResult = { ok: true; formula: CompiledFormula } | { ok: false; error: FormulaError };

interface FunctionSpec {
  args: [number, number];
  fn: (...values: number[]) => number;
  help: string;
}

export const FUNCTIONS: Record<string, FunctionSpec> = {
  ramp: { args: [3, 3], fn: (x, full, zero) => utility(full, zero, x), help: 'ramp(x, full, zero) is 1 at full, 0 at zero and linear between, in either direction' },
  clamp: { args: [1, 3], fn: (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x)), help: 'clamp(x) keeps x between 0 and 1; clamp(x, lo, hi) between lo and hi' },
  min: { args: [1, 20], fn: Math.min, help: 'min(a, b, …) is the smallest value' },
  max: { args: [1, 20], fn: Math.max, help: 'max(a, b, …) is the largest value' },
  abs: { args: [1, 1], fn: Math.abs, help: 'abs(x) without its sign' },
  sqrt: { args: [1, 1], fn: Math.sqrt, help: 'sqrt(x) square root' },
  pow: { args: [2, 2], fn: Math.pow, help: 'pow(x, y) is x to the power of y, like x ** y' },
  exp: { args: [1, 1], fn: Math.exp, help: 'exp(x) is e to the power of x' },
  log: { args: [1, 1], fn: Math.log, help: 'log(x) natural logarithm' },
  round: { args: [1, 1], fn: Math.round, help: 'round(x) to the nearest whole number' },
  floor: { args: [1, 1], fn: Math.floor, help: 'floor(x) rounds down' },
  ceil: { args: [1, 1], fn: Math.ceil, help: 'ceil(x) rounds up' },
  known: { args: [1, 1], fn: (x) => (Number.isNaN(x) ? 0 : 1), help: 'known(x) is true when x has data' },
  fallback: { args: [2, 2], fn: (x, y) => (Number.isNaN(x) ? y : x), help: 'fallback(x, y) is y where x has no data' },
  slider: { args: [3, 4], fn: (x) => x, help: 'let name = slider(value, min, max, step) makes a slider' },
  choice: { args: [2, 20], fn: (i, ...options) => options[Math.round(i) - 1] ?? NaN, help: 'let name = choice(1, a, b, …) picks one of the values; the side panel shows the choice' },
};

/** Named values every formula can use. */
export const CONSTANTS: Record<string, { value: number; help: string }> = {
  BYZONE: { value: 1, help: 'zone code for byzone' },
  LANDZONE: { value: 2, help: 'zone code for landzone' },
  SOMMERHUS: { value: 3, help: 'zone code for sommerhusområde' },
};

const KEYWORDS = new Set(['let', 'return', 'true', 'false']);
const OPERATORS = ['===', '!==', '**', '<=', '>=', '==', '!=', '&&', '||', '+', '-', '*', '/', '%', '<', '>', '!', '?', ':', '(', ')', ',', '=', ';'];

interface Token {
  kind: 'num' | 'name' | 'op' | 'end';
  text: string;
  pos: number;
  value?: number;
}

type Expr =
  | { t: 'num'; v: number; pos: number; end?: number; bool?: boolean }
  | { t: 'var'; name: string; pos: number }
  | { t: 'un'; op: string; a: Expr; pos: number }
  | { t: 'bin'; op: string; a: Expr; b: Expr; pos: number }
  | { t: 'cond'; c: Expr; a: Expr; b: Expr; pos: number }
  | { t: 'call'; name: string; args: Expr[]; pos: number };

interface Program {
  lets: { name: string; expr: Expr; pos: number }[];
  result: Expr;
}

class FormulaSyntaxError extends Error {
  readonly pos: number;

  constructor(message: string, pos: number) {
    super(message);
    this.pos = pos;
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (source.startsWith('//', i)) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    const number = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(source.slice(i));
    if (number) {
      tokens.push({ kind: 'num', text: number[0], pos: i, value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i));
    if (name) {
      tokens.push({ kind: 'name', text: name[0], pos: i });
      i += name[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => source.startsWith(o, i));
    if (!op) throw new FormulaSyntaxError(`Unexpected character “${ch}”`, i);
    tokens.push({ kind: 'op', text: op, pos: i });
    i += op.length;
  }
  tokens.push({ kind: 'end', text: 'end of code', pos: source.length });
  return tokens;
}

/** Recursive-descent parser. Precedence from low to high: ?: || && equality comparison + * unary **. */
class Parser {
  private i = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  program(): Program {
    const lets: Program['lets'] = [];
    while (this.peek().text === 'let') {
      this.next();
      const name = this.next();
      if (name.kind !== 'name' || KEYWORDS.has(name.text)) throw new FormulaSyntaxError('Expected a name after “let”', name.pos);
      this.expect('=');
      lets.push({ name: name.text, expr: this.expression(), pos: name.pos });
      this.skip(';');
    }
    if (this.peek().text === 'return') this.next();
    if (this.peek().kind === 'end') throw new FormulaSyntaxError(lets.length ? 'The code ends without a result' : 'Write a formula, for example ramp(forest, 300, 3000)', this.peek().pos);
    const result = this.expression();
    this.skip(';');
    const rest = this.peek();
    if (rest.kind !== 'end') {
      throw new FormulaSyntaxError(rest.text === '=' ? 'Use == to compare, or “let name = …” to name a value' : `Unexpected “${rest.text}”`, rest.pos);
    }
    return { lets, result };
  }

  private expression(): Expr {
    const c = this.binary(0);
    if (this.peek().text !== '?') return c;
    const pos = this.next().pos;
    const a = this.expression();
    this.expect(':');
    const b = this.expression();
    return { t: 'cond', c, a, b, pos };
  }

  private static readonly LEVELS = [['||'], ['&&'], ['==', '!=', '===', '!=='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];

  private binary(level: number): Expr {
    if (level === Parser.LEVELS.length) return this.unary();
    let a = this.binary(level + 1);
    while (Parser.LEVELS[level].includes(this.peek().text) && this.peek().kind === 'op') {
      const op = this.next();
      a = { t: 'bin', op: op.text, a, b: this.binary(level + 1), pos: op.pos };
    }
    return a;
  }

  private unary(): Expr {
    const token = this.peek();
    if (token.kind === 'op' && (token.text === '-' || token.text === '+' || token.text === '!')) {
      this.next();
      return { t: 'un', op: token.text, a: this.unary(), pos: token.pos };
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.primary();
    if (this.peek().text !== '**') return base;
    const op = this.next();
    return { t: 'bin', op: '**', a: base, b: this.unary(), pos: op.pos };
  }

  private primary(): Expr {
    const token = this.next();
    const end = token.pos + token.text.length;
    if (token.kind === 'num') return { t: 'num', v: token.value!, pos: token.pos, end };
    if (token.kind === 'name') {
      if (token.text === 'true' || token.text === 'false') return { t: 'num', v: token.text === 'true' ? 1 : 0, pos: token.pos, end, bool: true };
      if (KEYWORDS.has(token.text)) throw new FormulaSyntaxError(`“${token.text}” has to start a line`, token.pos);
      if (this.peek().text !== '(') return { t: 'var', name: token.text, pos: token.pos };
      this.next();
      const args: Expr[] = [];
      if (this.peek().text !== ')') {
        do args.push(this.expression()); while (this.skip(','));
      }
      this.expect(')');
      return { t: 'call', name: token.text, args, pos: token.pos };
    }
    if (token.text === '(') {
      const inner = this.expression();
      this.expect(')');
      return inner;
    }
    throw new FormulaSyntaxError(token.kind === 'end' ? 'The formula stops in the middle' : `Unexpected “${token.text}”`, token.pos);
  }

  private peek(): Token {
    return this.tokens[this.i];
  }

  private next(): Token {
    const token = this.tokens[this.i];
    if (token.kind !== 'end') this.i++;
    return token;
  }

  private skip(text: string): boolean {
    if (this.peek().text !== text || this.peek().kind !== 'op') return false;
    this.i++;
    return true;
  }

  private expect(text: string): void {
    const token = this.peek();
    if (token.text !== text || token.kind !== 'op') throw new FormulaSyntaxError(`Expected “${text}” but found “${token.text}”`, token.pos);
    this.i++;
  }
}

const missing = Number.isNaN;
const isTrue = (x: number) => x !== 0 && !missing(x);

/** A comparison that gives no data when either side has none. */
const compare = (test: (a: number, b: number) => boolean) => (a: number, b: number) => (missing(a) || missing(b) ? NaN : test(a, b) ? 1 : 0);

const BINARY: Record<string, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '%': (a, b) => a % b,
  '**': (a, b) => Math.pow(a, b),
  '<': compare((a, b) => a < b),
  '<=': compare((a, b) => a <= b),
  '>': compare((a, b) => a > b),
  '>=': compare((a, b) => a >= b),
  '==': compare((a, b) => a === b),
  '===': compare((a, b) => a === b),
  '!=': compare((a, b) => a !== b),
  '!==': compare((a, b) => a !== b),
  // Three-valued logic: missing data only decides when the other side cannot
  '&&': (a, b) => (a === 0 || b === 0 ? 0 : missing(a) || missing(b) ? NaN : 1),
  '||': (a, b) => (isTrue(a) || isTrue(b) ? 1 : missing(a) || missing(b) ? NaN : 0),
};

/** Names close to an unknown one, for "did you mean". */
function similar(name: string, known: string[]): string[] {
  const distance = (a: string, b: string) => {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  };
  const lower = name.toLowerCase();
  return known.filter((k) => distance(lower, k.toLowerCase()) <= 2 || (lower.length >= 3 && k.toLowerCase().startsWith(lower.slice(0, 3)))).slice(0, 3);
}

type Slots = Float64Array;

function compileExpr(expr: Expr, scope: Map<string, number>, uses: Set<string>, inputs: string[]): (s: Slots) => number {
  switch (expr.t) {
    case 'num': {
      const v = expr.v;
      return () => v;
    }
    case 'var': {
      const constant = CONSTANTS[expr.name];
      if (constant && !scope.has(expr.name)) {
        const v = constant.value;
        return () => v;
      }
      const slot = scope.get(expr.name);
      if (slot === undefined) {
        const close = similar(expr.name, [...scope.keys()]);
        throw new FormulaSyntaxError(`Unknown name “${expr.name}”.${close.length ? ` Did you mean ${close.join(', ')}?` : ' See the list of values.'}`, expr.pos);
      }
      if (slot < inputs.length) uses.add(expr.name);
      return (s) => s[slot];
    }
    case 'un': {
      const a = compileExpr(expr.a, scope, uses, inputs);
      if (expr.op === '-') return (s) => -a(s);
      if (expr.op === '!') return (s) => { const v = a(s); return missing(v) ? NaN : v === 0 ? 1 : 0; };
      return a;
    }
    case 'bin': {
      const a = compileExpr(expr.a, scope, uses, inputs);
      const b = compileExpr(expr.b, scope, uses, inputs);
      const op = BINARY[expr.op];
      return (s) => op(a(s), b(s));
    }
    case 'cond': {
      const c = compileExpr(expr.c, scope, uses, inputs);
      const a = compileExpr(expr.a, scope, uses, inputs);
      const b = compileExpr(expr.b, scope, uses, inputs);
      return (s) => { const v = c(s); return missing(v) ? NaN : v !== 0 ? a(s) : b(s); };
    }
    case 'call': {
      const spec = FUNCTIONS[expr.name];
      if (!spec) throw new FormulaSyntaxError(`Unknown function “${expr.name}”. Use one of ${Object.keys(FUNCTIONS).join(', ')}.`, expr.pos);
      const [lo, hi] = spec.args;
      if (expr.args.length < lo || expr.args.length > hi) {
        const wanted = lo === hi ? `${lo}` : hi >= 20 ? `at least ${lo}` : `${lo} to ${hi}`;
        throw new FormulaSyntaxError(`${expr.name}() takes ${wanted} value${lo === 1 && hi === 1 ? '' : 's'}, not ${expr.args.length}`, expr.pos);
      }
      const args = expr.args.map((x) => compileExpr(x, scope, uses, inputs));
      const fn = spec.fn;
      if (args.length === 1) { const [a] = args; return (s) => fn(a(s)); }
      if (args.length === 2) { const [a, b] = args; return (s) => fn(a(s), b(s)); }
      if (args.length === 3) { const [a, b, c] = args; return (s) => fn(a(s), b(s), c(s)); }
      return (s) => fn(...args.map((x) => x(s)));
    }
  }
}

/** A plain number, possibly negative, and where it is written. */
function literal(expr: Expr): { value: number; start: number; end: number } | null {
  if (expr.t === 'num' && !expr.bool && expr.end !== undefined) return { value: expr.v, start: expr.pos, end: expr.end };
  if (expr.t === 'un' && expr.op === '-' && expr.a.t === 'num' && !expr.a.bool && expr.a.end !== undefined) return { value: -expr.a.v, start: expr.pos, end: expr.a.end };
  return null;
}

/** A slider range around a number: 0 to about three times the value, in round steps. */
export function autoRange(value: number): { min: number; max: number; step: number } {
  const size = Math.abs(value);
  if (size <= 1) return value < 0 ? { min: -1, max: 0, step: 0.01 } : { min: 0, max: 1, step: 0.01 };
  const unit = Math.pow(10, Math.floor(Math.log10(size)));
  const max = Math.ceil((size * 3) / unit) * unit;
  return value < 0 ? { min: -max, max: 0, step: unit / 10 } : { min: 0, max, step: unit / 10 };
}

/** "Full points within (m)" → label and unit. */
function labelOf(source: string, pos: number, name: string): { label: string; unit: string } {
  const lineStart = source.lastIndexOf('\n', pos) + 1;
  const lineEnd = source.indexOf('\n', pos);
  const line = source.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
  const comment = line.includes('//') ? line.slice(line.indexOf('//') + 2).trim() : '';
  const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(comment);
  return match ? { label: match[1] || name, unit: match[2] } : { label: comment || name, unit: '' };
}

/** "work_car", "work_bike" → "car", "bike". */
function optionNames(args: Expr[], source: string): string[] {
  const texts = args.map((a) => (a.t === 'var' ? a.name : a.t === 'num' && a.end !== undefined ? source.slice(a.pos, a.end) : ''));
  if (texts.some((t) => !t)) return args.map((_, k) => `Option ${k + 1}`);
  let prefix = texts[0];
  for (const t of texts) while (!t.startsWith(prefix)) prefix = prefix.slice(0, -1);
  prefix = prefix.slice(0, prefix.lastIndexOf('_') + 1);
  return texts.map((t) => t.slice(prefix.length) || t);
}

function paramOf(name: string, expr: Expr, pos: number, source: string): FormulaParam | null {
  const { label, unit } = labelOf(source, pos, name);
  const base = { name, label, unit, options: [] as string[] };
  if (expr.t === 'num' && expr.bool && expr.end !== undefined) {
    return { ...base, kind: 'flag', value: expr.v, min: 0, max: 1, step: 1, fixedRange: true, start: expr.pos, end: expr.end };
  }
  const plain = literal(expr);
  if (plain) return { ...base, kind: 'number', ...plain, ...autoRange(plain.value), fixedRange: false };
  if (expr.t !== 'call') return null;
  if (expr.name === 'slider') {
    const args = expr.args.map(literal);
    if (args.some((a) => !a)) throw new FormulaSyntaxError('slider() takes plain numbers: slider(value, min, max, step)', expr.pos);
    const [value, min, max, step] = args as { value: number; start: number; end: number }[];
    if (!(min.value < max.value)) throw new FormulaSyntaxError('slider(value, min, max): min has to be below max', expr.pos);
    return { ...base, kind: 'number', value: value.value, start: value.start, end: value.end, min: min.value, max: max.value, step: step?.value ?? autoRange(max.value).step, fixedRange: true };
  }
  if (expr.name === 'choice') {
    const index = literal(expr.args[0]);
    const count = expr.args.length - 1;
    if (!index || !Number.isInteger(index.value) || index.value < 1 || index.value > count) {
      throw new FormulaSyntaxError(`choice(n, …): n has to be a whole number from 1 to ${count}`, expr.pos);
    }
    return { ...base, kind: 'choice', value: index.value, min: 1, max: count, step: 1, fixedRange: true, options: optionNames(expr.args.slice(1), source), start: index.start, end: index.end };
  }
  return null;
}

function position(source: string, pos: number): { line: number; column: number } {
  const before = source.slice(0, pos).split('\n');
  return { line: before.length, column: before[before.length - 1].length + 1 };
}

function parse(source: string): Program {
  return new Parser(tokenize(source)).program();
}

/** Parse and compile a formula over the given value names. */
export function compileFormula(source: string, inputs: string[]): CompileResult {
  try {
    const program = parse(source);
    const scope = new Map(inputs.map((name, i) => [name, i]));
    const uses = new Set<string>();
    const params: FormulaParam[] = [];
    const lets = program.lets.map((l, k) => {
      if (scope.has(l.name) || FUNCTIONS[l.name] || CONSTANTS[l.name]) throw new FormulaSyntaxError(`“${l.name}” is already taken; pick another name`, l.pos);
      const fn = compileExpr(l.expr, scope, uses, inputs);
      const param = paramOf(l.name, l.expr, l.pos, source);
      if (param) params.push(param);
      scope.set(l.name, inputs.length + k);
      return fn;
    });
    const result = compileExpr(program.result, scope, uses, inputs);
    const slots = new Float64Array(inputs.length + lets.length);
    const n = inputs.length;
    return {
      ok: true,
      formula: {
        inputs,
        uses: inputs.filter((x) => uses.has(x)),
        params,
        run(values) {
          for (let i = 0; i < n; i++) slots[i] = values[i];
          for (let k = 0; k < lets.length; k++) slots[n + k] = lets[k](slots);
          return result(slots);
        },
      },
    };
  } catch (error) {
    if (!(error instanceof FormulaSyntaxError)) throw error;
    return { ok: false, error: { message: error.message, ...position(source, error.pos) } };
  }
}

const cache = new Map<string, CompileResult>();

/** compileFormula with a small cache, since blocks are re-evaluated on every change. */
export function compileCached(source: string, inputs: string[]): CompileResult {
  const key = `${inputs.join(',')}\n${source}`;
  let result = cache.get(key);
  if (!result) {
    result = compileFormula(source, inputs);
    if (cache.size > 200) cache.clear();
    cache.set(key, result);
  }
  return result;
}

/** The controls a formula defines, from its syntax alone (unknown names do not matter here). */
export function formulaParams(source: string): FormulaParam[] {
  try {
    return parse(source).lets.map((l) => paramOf(l.name, l.expr, l.pos, source)).filter((x): x is FormulaParam => !!x);
  } catch (error) {
    if (error instanceof FormulaSyntaxError) return [];
    throw error;
  }
}

/** The code with one control's value replaced. Numbers are rounded to the slider's step. */
export function setParam(source: string, param: FormulaParam, value: number): string {
  let text: string;
  if (param.kind === 'flag') text = value ? 'true' : 'false';
  else if (param.kind === 'choice') text = String(Math.round(value));
  else {
    const decimals = Math.max(0, Math.min(6, Math.ceil(-Math.log10(param.step) - 1e-9)));
    text = String(Number(value.toFixed(decimals)));
  }
  return source.slice(0, param.start) + text + source.slice(param.end);
}

/** The label comments of a ramp's two ends, which say which way it points. */
const END_LABELS = /^(\s*let\s+(full|zero)\s*=[^\n]*?\/\/\s*)(Full points up to|Full points from|No points from|No points below)/gm;

/**
 * The code turned around: the values of `full` and `zero`, the two ends of a ramp, swap places.
 * A block that gave full points for little of something then gives them for a lot, and the other
 * way round. The two lines' labels become "Full points at" and "No points at", which hold in
 * either direction. Null when the code has no such pair, or one value does not fit the other's
 * slider.
 */
export function turnAround(source: string): string | null {
  const params = formulaParams(source);
  const full = params.find((p) => p.name === 'full' && p.kind === 'number');
  const zero = params.find((p) => p.name === 'zero' && p.kind === 'number');
  if (!full || !zero || full.value === zero.value) return null;
  // A plain number's slider follows its value; slider(…) keeps the range the code gives it
  const fits = (p: FormulaParam, value: number) => !p.fixedRange || (value >= p.min && value <= p.max);
  if (!fits(full, zero.value) || !fits(zero, full.value)) return null;
  // The later value first, so the earlier one is still where it was
  const [first, second] = full.start < zero.start ? [full, zero] : [zero, full];
  let code = setParam(source, second, (second === full ? zero : full).value);
  code = setParam(code, first, (first === full ? zero : full).value);
  return code.replace(END_LABELS, (_match, start: string, name: string) => `${start}${name === 'full' ? 'Full points at' : 'No points at'}`);
}

/**
 * Rename names in the code, but not in comments: a place's values when it gets a new name, or a
 * value or function that a new version of the language calls something else (migrations.ts).
 */
export function renameValues(source: string, renames: Record<string, string>): string {
  let tokens: Token[];
  try {
    tokens = tokenize(source);
  } catch {
    return source;
  }
  let out = '';
  let last = 0;
  for (const token of tokens) {
    if (token.kind === 'name' && renames[token.text]) {
      out += source.slice(last, token.pos) + renames[token.text];
      last = token.pos + token.text.length;
    }
  }
  return out + source.slice(last);
}

export function describeError(error: FormulaError): string {
  return `Line ${error.line}, column ${error.column}: ${error.message}`;
}

/** A name a formula can use: lower case letters, digits and underscores, not starting with a digit. */
export function toVariableName(text: string): string {
  const name = text
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safe = !name ? 'value' : /^\d/.test(name) ? `v_${name}` : name;
  return KEYWORDS.has(safe) || FUNCTIONS[safe] || CONSTANTS[safe] ? `${safe}_value` : safe;
}
