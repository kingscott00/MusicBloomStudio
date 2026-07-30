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

const noteColorCache = new Map<string, string>();
const softPointCache = new Map<string, HTMLCanvasElement>();

export function noteColor(
  frame: VisualFrame,
  note: number,
  offset = 0,
): string {
  const position = note / 12 + offset;
  const key = `${frame.colors.join(".")}|${Math.round(position * 256)}`;
  const cached = noteColorCache.get(key);
  if (cached) return cached;
  const color = paletteColor(frame.colors, position);
  noteColorCache.set(key, color);
  return color;
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
  const cap = Math.round(
    (60 + frame.params.density * 2.7) *
      multiplier *
      (0.55 + frame.qualityScale * 0.45),
  );
  let write = 0;
  for (let read = 0; read < particles.length; read += 1) {
    if (particles[read].life > 0) {
      particles[write] = particles[read];
      write += 1;
    }
  }
  const start = Math.max(0, write - cap);
  const kept = write - start;
  for (let index = 0; index < kept; index += 1)
    particles[index] = particles[start + index];
  particles.length = kept;
  return particles;
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
  const safeRadius = Math.max(0.5, Math.round(radius * 2) / 2);
  const key = `${color}|${safeRadius}`;
  let sprite = softPointCache.get(key);
  if (!sprite) {
    const padding = 3.4;
    const size = Math.max(4, Math.ceil(safeRadius * padding * 2));
    sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;
    const spriteContext = sprite.getContext("2d");
    if (spriteContext) {
      const center = size / 2;
      const gradient = spriteContext.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        center,
      );
      gradient.addColorStop(0, rgba(color, 1));
      gradient.addColorStop(0.18, rgba(color, 0.9));
      gradient.addColorStop(0.52, rgba(color, 0.24));
      gradient.addColorStop(1, rgba(color, 0));
      spriteContext.fillStyle = gradient;
      spriteContext.fillRect(0, 0, size, size);
    }
    if (softPointCache.size >= 96) {
      const oldest = softPointCache.keys().next().value;
      if (oldest) softPointCache.delete(oldest);
    }
    softPointCache.set(key, sprite);
  }
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * clamp(alpha, 0, 1);
  context.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
  context.globalAlpha = previousAlpha;
}

export function qualityCount(
  frame: VisualFrame,
  desired: number,
  minimum: number,
): number {
  return Math.max(minimum, Math.round(desired * frame.qualityScale));
}

export function expSmoothing(delta: number, speed: number): number {
  return 1 - Math.exp(-delta * speed);
}
