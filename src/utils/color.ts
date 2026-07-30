const rgbCache = new Map<string, [number, number, number]>();
const mixCache = new Map<string, string>();

export function hexToRgb(hex: string): [number, number, number] {
  const cached = rgbCache.get(hex);
  if (cached) return cached;
  let result: [number, number, number];
  if (hex.startsWith("#")) {
    const value = Number.parseInt(hex.slice(1), 16);
    result = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  } else {
    const channels = hex.match(/\d+(?:\.\d+)?/g);
    result =
      channels && channels.length >= 3
        ? [Number(channels[0]), Number(channels[1]), Number(channels[2])]
        : [255, 255, 255];
  }
  rgbCache.set(hex, result);
  return result;
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function mixColor(a: string, b: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const step = Math.round(t * 256);
  const key = `${a}|${b}|${step}`;
  const cached = mixCache.get(key);
  if (cached) return cached;
  const aa = hexToRgb(a);
  const bb = hexToRgb(b);
  const result = `rgb(${aa
    .map((v, index) => Math.round(v + (bb[index] - v) * (step / 256)))
    .join(",")})`;
  mixCache.set(key, result);
  return result;
}

export function paletteColor(colors: string[], position: number): string {
  const scaled = (((position % 1) + 1) % 1) * colors.length;
  const index = Math.floor(scaled) % colors.length;
  return mixColor(
    colors[index],
    colors[(index + 1) % colors.length],
    scaled - Math.floor(scaled),
  );
}
