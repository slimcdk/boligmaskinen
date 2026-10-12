/// <reference lib="webworker" />
import type { Grid } from '@boligmaskinen/engine';
import { HeatEngine, type HeatMessage } from './heat-engine';
import { resample, type RoutedTimes } from './travel';

let engine: HeatEngine | null = null;
let detail: HeatEngine | null = null;
let region: Grid | null = null;
let detailGrid: Grid | null = null;
/** The travel times on the road network by place position, for the detail grids to come. */
const travel = new Map<string, RoutedTimes>();

/** Travel times on the region's grid, put on the detail grid around the view. */
function onDetail(times: RoutedTimes): Partial<RoutedTimes> {
  return Object.fromEntries(Object.entries(times).map(([mode, layer]) => [mode, resample(region!, detailGrid!, layer)]));
}

// The weighting, smoothing and colouring run here, so the page answers while a slider moves
addEventListener('message', ({ data }: MessageEvent<HeatMessage>) => {
  switch (data.type) {
    case 'grid':
      region = data.grid;
      engine = new HeatEngine(data.grid);
      travel.clear();
      break;
    case 'detail':
      detailGrid = data.grid;
      detail = data.grid && new HeatEngine(data.grid, engine);
      if (detail) for (const [position, times] of travel) detail.setTravel(position, onDetail(times));
      break;
    case 'travel':
      travel.set(data.position, data.times);
      engine?.setTravel(data.position, data.times);
      detail?.setTravel(data.position, onDetail(data.times));
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
