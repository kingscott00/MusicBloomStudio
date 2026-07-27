import type { VisualFrame } from "../types";
import { paletteColor, rgba } from "../utils/color";
import { clamp, hashNoise } from "../utils/math";

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  seed: number;
}

export function noteColor(
  frame: VisualFrame,
  note: number,
  offset = 0,
): string {
  return paletteColor(frame.colors, note / 12 + offset);
}

export function glowStroke(
  context: CanvasRenderingContext2D,
  color: string,
  blur: number,
  alpha = 1,
): void {
  context.strokeStyle = rgba(color, alpha);
  context.shadowColor = color;
  context.shadowBlur = blur;
}

export function glowFill(
  context: CanvasRenderingContext2D,
  color: string,
  blur: number,
  alpha = 1,
): void {
  context.fillStyle = rgba(color, alpha);
  context.shadowColor = color;
  context.shadowBlur = blur;
}

export function limitParticles<T extends { life: number }>(
  particles: T[],
  frame: VisualFrame,
  multiplier = 1,
): T[] {
  const cap = Math.round((80 + frame.params.density * 3.2) * multiplier);
  return particles.filter((particle) => particle.life > 0).slice(-cap);
}

export function organicWave(angle: number, time: number, seed: number): number {
  return (
    Math.sin(angle * 3 + time * 0.0007 + seed) * 0.55 +
    Math.sin(angle * 7 - time * 0.00039 + seed * 2) * 0.22 +
    (hashNoise(Math.floor(angle * 20), seed) - 0.5) * 0.16
  );
}

export function drawSoftPoint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient = context.createRadialGradient(
    x,
    y,
    0,
    x,
    y,
    Math.max(1, radius * 2.8),
  );
  gradient.addColorStop(0, rgba(color, clamp(alpha, 0, 1)));
  gradient.addColorStop(0.22, rgba(color, alpha * 0.45));
  gradient.addColorStop(1, rgba(color, 0));
  context.fillStyle = gradient;
  context.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);
}
