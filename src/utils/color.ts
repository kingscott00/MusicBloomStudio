export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function mixColor(a: string, b: string, amount: number): string {
  const aa = hexToRgb(a);
  const bb = hexToRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return `rgb(${aa.map((v, index) => Math.round(v + (bb[index] - v) * t)).join(",")})`;
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
