// The primary tones of Angular Material's M3 palettes that the heatmap's colour scales use, from
// @angular/material 22.2.1 (core/theming/_palettes.scss). A tone is perceived lightness: 0 is
// black, 100 white. To update, copy the same tones from a newer version.
export const M3_TONES = {
  orange: { 25: '#612d00', 40: '#964900', 60: '#e37100', 80: '#ffb787', 90: '#ffdcc7' },
  azure: { 25: '#003a7a', 40: '#005cbb', 60: '#438fff', 80: '#abc7ff', 90: '#d7e3ff' },
  green: { 25: '#014600', 40: '#026e00', 60: '#03a800', 80: '#02e600', 90: '#77ff61' },
  violet: { 25: '#5000a4', 40: '#7d00fa', 60: '#a974ff', 80: '#d5baff', 90: '#ecdcff' },
  rose: { 25: '#7a003a', 40: '#ba005c', 60: '#ff4a8e', 80: '#ffb1c5', 90: '#ffd9e1' },
  red: { 25: '#7e0100', 40: '#c00100', 60: '#ff5540', 80: '#ffb4a8', 90: '#ffdad4' },
  yellow: { 25: '#3e3e00', 40: '#626200', 60: '#969600', 80: '#cdcd00', 90: '#eaea00' },
} as const;
