/// <reference lib="webworker" />
import { HeatEngine, type HeatMessage } from './heat-engine';

let engine: HeatEngine | null = null;

// The weighting, smoothing and colouring run here, so the page answers while a slider moves
addEventListener('message', ({ data }: MessageEvent<HeatMessage>) => {
  switch (data.type) {
    case 'grid':
      engine = new HeatEngine(data.grid);
      break;
    case 'render': {
      const result = engine!.render(data.request, new Uint32Array(data.buffer));
      postMessage({ type: 'rendered', id: data.id, result, buffer: data.buffer }, [data.buffer]);
      break;
    }
    case 'explain':
      postMessage({ type: 'explained', id: data.id, breakdown: engine!.explain(data.cell, data.request) });
      break;
  }
});
