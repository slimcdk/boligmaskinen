import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { JobContext, LogLine } from '../src/jobs/types.ts';
import { runStep } from '../src/pipeline/python.ts';

const FAKE_PYTHON = fileURLToPath(new URL('./sources/fake-python.sh', import.meta.url));

function context(): { context: JobContext; lines: LogLine[]; progress: number[]; cancel: () => void } {
  const lines: LogLine[] = [];
  const progress: number[] = [];
  const controller = new AbortController();
  return {
    lines, progress, cancel: () => controller.abort(),
    context: {
      log: async (text, level = 'info') => { lines.push({ at: '', level, text }); },
      progress: async (fraction) => { progress.push(fraction); },
      signal: controller.signal, dataPackDir: null, db: undefined as never, runId: '1', trigger: 'manual', busy: async () => [],
    },
  };
}

const options = (progress?: [number, number]) => ({ python: FAKE_PYTHON, tmpDir: join(mkdtempSync(join(tmpdir(), 'step-')), 'tmp'), progress });

describe('running a step of the pipeline', () => {
  it('logs what the step writes and moves the progress within its part of the run', async () => {
    const { context: c, lines, progress } = context();
    await runStep(c, options([0.5, 1]), 'ok', []);
    expect(lines.map((l) => [l.level, l.text])).toEqual([['info', 'Working on it'], ['warn', 'A library warned about something']]);
    expect(progress).toEqual([0.75, 1]);
  });

  it('fails with the last line the step wrote about its error', async () => {
    const { context: c, lines } = context();
    await expect(runStep(c, options(), 'fail', [])).rejects.toThrow(/^Missing source files: zones$/);
    expect(lines.map((l) => l.text)).toEqual(['Traceback (most recent call last):', '  File "grid.py", line 1']);
  });

  it('stops the step when the run is cancelled', async () => {
    const { context: c, cancel } = context();
    const started = Date.now();
    const step = runStep(c, options(), 'slow', []);
    setTimeout(cancel, 300);
    await expect(step).rejects.toThrow('Cancelled');
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('runs one step at a time', async () => {
    const record = join(mkdtempSync(join(tmpdir(), 'step-')), 'record.txt');
    const first = context();
    const second = context();
    await Promise.all([runStep(first.context, options(), 'record', [record]), runStep(second.context, options(), 'record', [record])]);
    expect(readFileSync(record, 'utf8').split('\n').filter(Boolean).map((l) => l.split(' ')[0])).toEqual(['start', 'end', 'start', 'end']);
    expect(second.lines[0].text).toBe('Waiting for another step to finish before the record step');
  });

  it('says when the system killed the step, as it does when the memory runs out', async () => {
    const { context: c } = context();
    await expect(runStep(c, options(), 'hungry', [])).rejects.toThrow('fake-python.sh was killed, most likely because the memory ran out. The steps need about 1 GB (docs/self-hosting.md).');
  });

  it('says how to set up Python when it is missing', async () => {
    const { context: c } = context();
    await expect(runStep(c, { ...options(), python: '/nowhere/python' }, 'ok', [])).rejects.toThrow(
      'The pipeline\'s Python is missing: /nowhere/python. Run "uv sync" in pipeline/, or set PIPELINE_PYTHON.',
    );
  });
});
