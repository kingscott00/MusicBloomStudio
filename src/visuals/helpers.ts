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
  const cap = Math.round(
    (60 + frame.params.density * 2.7) *
      multiplier *
      (0.55 + frame.qualityScale * 0.45),
  );
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
  const safeRadius = Math.max(0.5, radius);
  context.shadowColor = color;
  context.shadowBlur = safeRadius * 2.4;
  context.fillStyle = rgba(color, clamp(alpha * 0.32, 0, 1));
  context.beginPath();
  context.arc(x, y, safeRadius * 1.85, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = safeRadius * 1.25;
  context.fillStyle = rgba(color, clamp(alpha, 0, 1));
  context.beginPath();
  context.arc(x, y, safeRadius * 0.58, 0, Math.PI * 2);
  context.fill();
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
