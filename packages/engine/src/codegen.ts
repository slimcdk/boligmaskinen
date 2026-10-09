/**
 * Blocks compiled to JavaScript: one loop over the cells per block, which V8 compiles to machine
 * code. It gives the same numbers as the closures in formula.ts, which stay for single cells and
 * for where JavaScript cannot be generated (a Content Security Policy without 'unsafe-eval').
 *
 * The generated code is built from the parsed formula only: numbers the tokenizer read, names it
 * gives itself (v0, l0, t0) and a fixed set of operators and helpers. Nothing the user wrote is
 * copied into it, so a block can still only do arithmetic on the data.
 */
import type { Expr, Program } from './formula.ts';
import { utility } from './engine.ts';

/** Runs a block over n cells: its result per cell into `out`, as runBlock in blocks.ts describes. */
export type BlockLoop = (columns: readonly (ArrayLike<number> | null | undefined)[], out: Float32Array, n: number, preference: boolean) => {
  /** Cells where a preference gave a score outside 0–1, and the first of them. */
  bad: number;
  first: number;
};

const missing = (x: number) => x !== x;

/** The helpers the generated code calls; each does what the closures in formula.ts do. */
const HELPERS = {
  // utility() in engine.ts without Math.min and Math.max, which are slower: NaN stays NaN, -0 becomes 0
  RAMP: (x: number, full: number, zero: number) => {
    if (full === zero) return utility(full, zero, x);
    const u = (zero - x) / (zero - full);
    return u <= 0 ? 0 : u > 1 ? 1 : u;
  },
  CLAMP: (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x)),
  KNOWN: (x: number) => (missing(x) ? 0 : 1),
  FALLBACK: (x: number, y: number) => (missing(x) ? y : x),
  LT: (a: number, b: number) => (missing(a) || missing(b) ? NaN : a < b ? 1 : 0),
  LE: (a: number, b: number) => (missing(a) || missing(b) ? NaN : a <= b ? 1 : 0),
  GT: (a: number, b: number) => (missing(a) || missing(b) ? NaN : a > b ? 1 : 0),
  GE: (a: number, b: number) => (missing(a) || missing(b) ? NaN : a >= b ? 1 : 0),
  EQ: (a: number, b: number) => (missing(a) || missing(b) ? NaN : a === b ? 1 : 0),
  NE: (a: number, b: number) => (missing(a) || missing(b) ? NaN : a !== b ? 1 : 0),
  AND: (a: number, b: number) => (a === 0 || b === 0 ? 0 : missing(a) || missing(b) ? NaN : 1),
  OR: (a: number, b: number) => ((a !== 0 && !missing(a)) || (b !== 0 && !missing(b)) ? 1 : missing(a) || missing(b) ? NaN : 0),
  NOT: (a: number) => (missing(a) ? NaN : a === 0 ? 1 : 0),
};

const COMPARISONS: Record<string, keyof typeof HELPERS> = {
  '<': 'LT', '<=': 'LE', '>': 'GT', '>=': 'GE', '==': 'EQ', '===': 'EQ', '!=': 'NE', '!==': 'NE', '&&': 'AND', '||': 'OR',
};
const ARITHMETIC = new Set(['+', '-', '*', '/', '%']);
const MATH = new Set(['abs', 'sqrt', 'exp', 'log', 'round', 'floor', 'ceil', 'min', 'max', 'pow']);

function literal(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? 'Infinity' : '(-Infinity)';
  return value < 0 || Object.is(value, -0) ? `(${value === 0 ? '-0' : String(value)})` : String(value);
}

/** What an expression's code needs: names for the inputs, the `let` values and the temporaries. */
interface Names {
  scope: Map<string, number>;
  inputs: number;
  constants: Record<string, { value: number }>;
  temps: number;
  /** Input slots the code reads. */
  reads: Set<number>;
}

function expression(expr: Expr, names: Names): string {
  const code = (e: Expr) => expression(e, names);
  switch (expr.t) {
    case 'num':
      return literal(expr.v);
    case 'var': {
      const constant = names.constants[expr.name];
      if (constant && !names.scope.has(expr.name)) return literal(constant.value);
      const slot = names.scope.get(expr.name);
      if (slot === undefined) throw new Error(`Unknown name ${expr.name}`);
      if (slot < names.inputs) {
        names.reads.add(slot);
        return `v${slot}`;
      }
      return `l${slot - names.inputs}`;
    }
    case 'un':
      if (expr.op === '-') return `(-(${code(expr.a)}))`;
      if (expr.op === '!') return `NOT(${code(expr.a)})`;
      return code(expr.a);
    case 'bin': {
      const [a, b] = [code(expr.a), code(expr.b)];
      if (ARITHMETIC.has(expr.op)) return `(${a} ${expr.op} ${b})`;
      if (expr.op === '**') return `Math.pow(${a}, ${b})`;
      const helper = COMPARISONS[expr.op];
      if (!helper) throw new Error(`Unknown operator ${expr.op}`);
      return `${helper}(${a}, ${b})`;
    }
    case 'cond': {
      // The condition once, then only the branch it picks, as the closures do
      const t = `t${names.temps++}`;
      return `((${t} = ${code(expr.c)}) !== ${t} ? NaN : ${t} !== 0 ? ${code(expr.a)} : ${code(expr.b)})`;
    }
    case 'call': {
      const args = expr.args.map(code);
      switch (expr.name) {
        case 'ramp': return `RAMP(${args.join(', ')})`;
        case 'clamp': return `CLAMP(${args[0]}, ${args[1] ?? '0'}, ${args[2] ?? '1'})`;
        case 'known': return `KNOWN(${args[0]})`;
        case 'fallback': return `FALLBACK(${args[0]}, ${args[1]})`;
        case 'slider': return args[0];
        case 'choice': {
          const t = `t${names.temps++}`;
          const options = args.slice(1).map((option, k) => `${t} === ${k + 1} ? ${option} : `).join('');
          return `((${t} = Math.round(${args[0]})), ${options}NaN)`;
        }
        default:
          if (!MATH.has(expr.name)) throw new Error(`Unknown function ${expr.name}`);
          return `Math.${expr.name}(${args.join(', ')})`;
      }
    }
  }
}

/** The source of a block's loop. Exported for the tests, which read it. */
export function loopSource(program: Program, inputNames: readonly string[], constants: Record<string, { value: number }>): string {
  const names: Names = { scope: new Map(inputNames.map((name, i) => [name, i])), inputs: inputNames.length, constants, temps: 0, reads: new Set() };
  const lets = program.lets.map((l, k) => {
    const code = `const l${k} = ${expression(l.expr, names)};`;
    names.scope.set(l.name, names.inputs + k);
    return code;
  });
  const result = expression(program.result, names);
  const reads = [...names.reads].sort((a, b) => a - b);
  return [
    '"use strict";',
    'return function block(columns, out, n, preference) {',
    ...reads.map((slot) => `  const c${slot} = columns[${slot}];`),
    names.temps ? `  let ${Array.from({ length: names.temps }, (_, k) => `t${k}`).join(', ')};` : '',
    '  let bad = 0, first = -1;',
    '  for (let i = 0; i < n; i++) {',
    ...reads.map((slot) => `    const v${slot} = c${slot}[i];`),
    ...lets.map((line) => `    ${line}`),
    `    const r = ${result};`,
    // Missing data stays missing; a requirement is met where it is not 0; a score has to be 0–1
    '    if (r !== r) { out[i] = NaN; continue; }',
    '    if (!preference) { out[i] = r !== 0 ? 1 : 0; continue; }',
    '    if (r >= 0 && r <= 1) { out[i] = r; continue; }',
    '    if (bad++ === 0) first = i;',
    '  }',
    '  return { bad, first };',
    '};',
  ].filter(Boolean).join('\n');
}

/** False once the page has said no to generated code, so it is not tried again. */
let allowed = true;

/** Whether blocks run as generated code; false makes them run as closures, as the tests compare. */
export function allowGeneratedCode(value: boolean): void {
  allowed = value;
}

export function generatedCodeAllowed(): boolean {
  return allowed;
}

/**
 * Puts the blocks' results together: per cell, the preferences averaged by their weights over the
 * ones with data, unless a requirement is 0 (blocks.ts, evaluateBlocks).
 */
export type CombineLoop = (wants: readonly Float32Array[], weights: readonly number[], masks: readonly Float32Array[], scores: Float32Array, histogram: Uint32Array, n: number) => void;

const combines = new Map<string, CombineLoop | null>();

/** The loop for so many preferences and requirements, made once for each count. */
export function compileCombine(wants: number, masks: number): CombineLoop | null {
  if (!allowed) return null;
  const key = `${wants}/${masks}`;
  if (!combines.has(key)) {
    const w = Array.from({ length: wants }, (_, k) => k);
    const m = Array.from({ length: masks }, (_, k) => k);
    const source = [
      '"use strict";',
      'return function combine(wants, weights, masks, scores, histogram, n) {',
      ...w.map((k) => `  const w${k} = wants[${k}], k${k} = weights[${k}];`),
      ...m.map((k) => `  const m${k} = masks[${k}];`),
      '  for (let i = 0; i < n; i++) {',
      m.length ? `    if (${m.map((k) => `m${k}[i] === 0`).join(' || ')}) continue;` : '',
      '    let sum = 0, weight = 0, v;',
      ...w.map((k) => `    v = w${k}[i]; if (v === v) { sum += v * k${k}; weight += k${k}; }`),
      '    const value = weight > 0 ? Math.max(0, Math.min(100, (sum / weight) * 100)) : 100;',
      '    scores[i] = value;',
      '    histogram[Math.round(value)]++;',
      '  }',
      '};',
    ].filter(Boolean).join('\n');
    try {
      combines.set(key, new Function(source)() as CombineLoop);
    } catch (error) {
      if (!(error instanceof EvalError)) throw error;
      allowed = false;
      return null;
    }
  }
  return combines.get(key)!;
}

/** A block's loop, or null where JavaScript cannot be generated. */
export function compileLoop(program: Program, inputNames: readonly string[], constants: Record<string, { value: number }>): BlockLoop | null {
  if (!allowed) return null;
  const source = loopSource(program, inputNames, constants);
  try {
    const helpers = Object.keys(HELPERS) as (keyof typeof HELPERS)[];
    return new Function(...helpers, source)(...helpers.map((name) => HELPERS[name])) as BlockLoop;
  } catch (error) {
    // A Content Security Policy without 'unsafe-eval' forbids it; the closures do the work then
    if (error instanceof EvalError) {
      allowed = false;
      return null;
    }
    throw error;
  }
}
