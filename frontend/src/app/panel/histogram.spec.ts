import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Histogram } from './histogram';

interface Drawn { op: 'fillRect' | 'fillText'; args: number[] | [string, number, number]; font: string; baseline: string }

describe('Histogram', () => {
  let drawn: Drawn[];

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    drawn = [];
    // jsdom has no canvas, so a 2D context that writes down what is drawn
    const g = {
      font: '', textBaseline: 'alphabetic', textAlign: 'start', fillStyle: '',
      setTransform: () => undefined, clearRect: () => undefined,
      fillRect: (...args: number[]) => drawn.push({ op: 'fillRect', args, font: g.font, baseline: g.textBaseline }),
      fillText: (...args: [string, number, number]) => drawn.push({ op: 'fillText', args, font: g.font, baseline: g.textBaseline }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(g as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps its labels, descenders and all, inside the canvas, below the bars', async () => {
    const fixture = TestBed.createComponent(Histogram);
    const histogram = new Uint32Array(101);
    histogram[40] = 5;
    histogram[100] = 20;
    fixture.componentRef.setInput('histogram', histogram);
    fixture.detectChanges();
    await fixture.whenStable();

    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    const height = canvas.height;
    const labels = drawn.filter((d) => d.op === 'fillText');
    // The foot of the em box on the canvas's edge, so a "p" is not cut off
    expect(labels.map((d) => [d.args[0], d.args[2], d.baseline])).toEqual([['0', height, 'bottom'], ['100 points', height, 'bottom']]);
    // M3's smallest type, label-small, is 11 px
    expect(Number(/([\d.]+)px/.exec(labels[0].font)![1])).toBeGreaterThanOrEqual(11);
    // The bars end above the labels' strip
    const bars = drawn.filter((d) => d.op === 'fillRect') as { args: number[] }[];
    expect(bars).toHaveLength(101);
    expect(Math.max(...bars.map((d) => d.args[1] + d.args[3]))).toBeLessThanOrEqual(height - 14);
  });
});
