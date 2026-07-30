import type { ColorPalette } from "../types";
import { hexToRgb } from "../utils/color";
import { clamp } from "../utils/math";

const STORAGE_KEY = "music-bloom-custom-palettes-v1";

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(clamp(channel, 0, 255))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h =
    max === rr
      ? (gg - bb) / d + (gg < bb ? 6 : 0)
      : max === gg
        ? (bb - rr) / d + 2
        : (rr - gg) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p: number, q: number, t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue(p, q, h + 1 / 3) * 255,
    hue(p, q, h) * 255,
    hue(p, q, h - 1 / 3) * 255,
  ];
}

export function transformPalette(
  palette: ColorPalette,
  rotation: number,
  saturation: number,
  brightness: number,
  temperature: number,
): ColorPalette {
  const transform = (color: string) => {
    const [r, g, b] = hexToRgb(color);
    const [h, s, l] = rgbToHsl(r, g, b);
    const rgb = hslToRgb(
      (h + rotation / 360 + 1) % 1,
      clamp(s * (saturation / 100), 0, 1),
      clamp(l * (brightness / 100), 0, 1),
    );
    return rgbToHex(
      rgb[0] + temperature * 0.32,
      rgb[1] + temperature * 0.06,
      rgb[2] - temperature * 0.32,
    );
  };
  return {
    ...palette,
    colors: palette.colors.map(transform),
    background: transform(palette.background),
  };
}

export function validatePalette(value: unknown): ColorPalette | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ColorPalette>;
  const isColor = (color: unknown) =>
    typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color);
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    !Array.isArray(item.colors) ||
    item.colors.length < 2 ||
    item.colors.length > 8 ||
    !item.colors.every(isColor) ||
    !isColor(item.background)
  )
    return null;
  return {
    id: item.id.slice(0, 80),
    name: item.name.slice(0, 80),
    colors: item.colors,
    background: item.background as string,
  };
}

export function loadCustomPalettes(): ColorPalette[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(value)
      ? value
          .map(validatePalette)
          .filter((palette): palette is ColorPalette => !!palette)
      : [];
  } catch {
    return [];
  }
}

export function saveCustomPalettes(palettes: ColorPalette[]): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(palettes.map(validatePalette).filter(Boolean)),
  );
}
