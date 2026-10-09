import { layers, namedFlavor } from '@protomaps/basemaps';

/** The fonts the basemap's labels use, by the name the data pack gives them. */
export const FONTS: Record<string, string> = {
  'Noto Sans Regular': 'noto-regular',
  'Noto Sans Medium': 'noto-medium',
  'Noto Sans Italic': 'noto-italic',
};

/** The glyph ranges the pack has: Latin, Latin Extended and punctuation. */
export const GLYPH_RANGES = ['0-255', '256-511', '8192-8447'];

/** Font stacks named by their Noto fonts, with the ones the pack has no glyphs for left out. */
function renameFonts(node: unknown): unknown {
  if (Array.isArray(node)) {
    if (node.length && node.every((x) => typeof x === 'string') && node.some((x: string) => x.startsWith('Noto Sans'))) {
      const known = node.filter((x: string) => x in FONTS).map((x: string) => FONTS[x]);
      return known.length ? known : ['noto-regular'];
    }
    return node.map(renameFonts);
  }
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, renameFonts(value)]));
  return node;
}

/**
 * The basemap's layers in Protomaps' "light" or "dark" flavour, with Danish labels. The app reads
 * style-layers.json in light mode and style-layers-dark.json in dark mode; the two have the same
 * layers, so the app switches by changing colours only.
 */
export function styleLayers(flavour: 'light' | 'dark'): string {
  return JSON.stringify(renameFonts(layers('protomaps', namedFlavor(flavour), { lang: 'da' })));
}
