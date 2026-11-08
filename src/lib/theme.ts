/**
 * Builds the accent colours from one brand colour (THEME_PRIMARY), so a clone
 * only sets a single hex value. Without it, the stylesheet's own colours apply.
 */

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: Rgb) {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** Moves a colour towards another by `amount` (0 to 1). */
function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return color.map((channel, index) => channel + (target[index] - channel) * amount) as Rgb;
}

function luminance([r, g, b]: Rgb) {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];
const LIGHT_TEXT = "#fffaf3";
const DARK_TEXT = "#1d120c";

/** Text on a button of this colour: whichever of light or dark reads better. */
function textOn(color: Rgb) {
  const l = luminance(color);
  const contrastWithLight = (luminance(toRgb(LIGHT_TEXT)) + 0.05) / (l + 0.05);
  const contrastWithDark = (l + 0.05) / (luminance(toRgb(DARK_TEXT)) + 0.05);
  return contrastWithLight >= contrastWithDark ? LIGHT_TEXT : DARK_TEXT;
}

/** CSS that overrides the accent variables in src/app/globals.css. */
export function themeCss(primary: string) {
  const light = toRgb(primary);
  // On a dark background the brand colour is lifted so it stays readable.
  const dark = mix(light, WHITE, 0.25);
  return [
    `:root{--accent:${toHex(light)};--accent-strong:${toHex(mix(light, BLACK, 0.18))};--on-accent:${textOn(light)}}`,
    `@media (prefers-color-scheme: dark){:root{--accent:${toHex(dark)};--accent-strong:${toHex(mix(dark, BLACK, 0.12))};--on-accent:${textOn(dark)}}}`,
  ].join("");
}
