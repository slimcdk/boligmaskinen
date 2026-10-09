import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { JobContext } from '../jobs/types.ts';

/** Lines of a step's errors that the job's log shows. */
const STDERR_LINES = 20;

let queue: Promise<unknown> = Promise.resolve();
/** Steps that run or wait to. */
let pending = 0;

/** One step at a time: building the grid of all of Denmark alone takes several GB of memory. */
function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

export interface StepOptions {
  /** The Python that has the pipeline installed (pipeline/.venv/bin/python). */
  python: string;
  /** Where the step may write temporary files. */
  tmpDir: string;
  /** The part of the run's progress the step fills. */
  progress?: [number, number];
}

/**
 * Runs one step of the pipeline, `python -m boligmaskinen_pipeline <step> <args>`, with its output
 * in the job's log: a line "@progress 0.42" moves the progress bar, every other line is logged. A
 * step that fails fails the job with the last line it wrote to stderr, which says why. Steps run
 * one at a time; cancelling the run stops the step.
 */
export function runStep(context: JobContext, options: StepOptions, step: string, args: string[]): Promise<void> {
  if (pending++ > 0) void context.log(`Waiting for another step to finish before the ${step} step`).catch(() => undefined);
  return oneAtATime(() => run(context, options, step, args)).finally(() => pending--);
}

async function run(context: JobContext, options: StepOptions, step: string, args: string[]): Promise<void> {
  if (context.signal.aborted) throw new Error('Cancelled');
  const [from, to] = options.progress ?? [0, 1];
  const child = spawn(options.python, ['-I', '-m', 'boligmaskinen_pipeline', step, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Only what the step needs: Python ignores its own variables with -I
    env: { PATH: process.env['PATH'] ?? '/usr/bin:/bin', HOME: process.env['HOME'] ?? options.tmpDir, LANG: 'C.UTF-8', TMPDIR: options.tmpDir },
  });
  const stop = () => {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
  };
  context.signal.addEventListener('abort', stop, { once: true });

  const errors: string[] = [];
  const logs: Promise<void>[] = [];
  createInterface({ input: child.stdout }).on('line', (line) => {
    const match = /^@progress ([\d.]+)$/.exec(line);
    if (match) logs.push(context.progress(from + (to - from) * Number(match[1])));
    else if (line.trim()) logs.push(context.log(line));
  });
  createInterface({ input: child.stderr }).on('line', (line) => {
    if (!line.trim()) return;
    errors.push(line);
    if (errors.length > STDERR_LINES) errors.shift();
  });

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'ENOENT'
        ? new Error(`The pipeline's Python is missing: ${options.python}. Run "uv sync" in pipeline/, or set PIPELINE_PYTHON.`)
        : error);
    });
    child.on('close', (exitCode) => resolve(exitCode));
  }).finally(() => context.signal.removeEventListener('abort', stop));
  await Promise.all(logs);
  if (context.signal.aborted) throw new Error('Cancelled');
  if (code !== 0) {
    for (const line of errors.slice(0, -1)) await context.log(line, 'warn');
    throw new Error(errors.at(-1) ?? `The ${step} step stopped with exit code ${code}`);
  }
  // A step that succeeds can still have warned about something
  for (const line of errors) await context.log(line, 'warn');
}
