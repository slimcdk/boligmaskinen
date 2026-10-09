/// <reference lib="webworker" />
import { HeatEngine, type HeatMessage } from './heat-engine';

let engine: HeatEngine | null = null;
let detail: HeatEngine | null = null;

// The weighting, smoothing and colouring run here, so the page answers while a slider moves
addEventListener('message', ({ data }: MessageEvent<HeatMessage>) => {
  switch (data.type) {
    case 'grid':
      engine = new HeatEngine(data.grid);
      break;
    case 'detail':
      detail = data.grid && new HeatEngine(data.grid);
      break;
    case 'render': {
      const result = engine!.render(data.request, new Uint32Array(data.buffer));
      // The detail around the view, drawn as the region's map is
      if (data.detail && detail) detail.render(data.request, new Uint32Array(data.detail), result.stats);
      postMessage({ type: 'rendered', id: data.id, result, buffer: data.buffer, detail: data.detail }, [data.buffer, ...(data.detail ? [data.detail] : [])]);
      break;
    }
    case 'explain':
      postMessage({ type: 'explained', id: data.id, breakdown: (data.detail && detail ? detail : engine!).explain(data.cell, data.request) });
      break;
  }
});
