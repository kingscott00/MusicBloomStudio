import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, hashNoise } from "../utils/math";
import { drawSoftPoint, noteColor } from "./helpers";

interface Star {
  note: number;
  x: number;
  y: number;
  strength: number;
  pulse: number;
  seed: number;
}

export class ConstellationGenerator implements VisualGenerator {
  readonly mode = "constellation" as const;
  private stars: Star[] = [];

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const existing = this.stars.find((star) => star.note === note.note);
    if (existing) {
      existing.strength = Math.min(
        1.5,
        existing.strength + 0.34 + note.velocity / 260,
      );
      existing.pulse = 1;
      return;
    }
    const seed = note.note * 9.71 + state.sequence * 2.37;
    this.stars.push({
      note: note.note,
      x: 0.1 + hashNoise(seed, 2) * 0.8,
      y:
        0.12 +
        (1 - (note.note - 24) / 84) * 0.67 +
        (hashNoise(seed, 3) - 0.5) * 0.12,
      strength: 0.55 + note.velocity / 160,
      pulse: 1,
      seed,
    });
    this.stars = this.stars.slice(-34);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const { width, height, time, params, music } = frame;
    if (!this.stars.length) {
      for (let i = 0; i < 9; i += 1) {
        this.stars.push({
          note: 48 + i * 2,
          x: 0.15 + hashNoise(i, 1) * 0.7,
          y: 0.15 + hashNoise(i, 7) * 0.65,
          strength: 0.12,
          pulse: 0,
          seed: i * 8.1,
        });
      }
    }

    context.save();
    context.globalCompositeOperation = "lighter";
    const positions = this.stars.map((star) => ({
      star,
      x:
        star.x * width +
        (params.autoMotion ? Math.sin(time * 0.00013 + star.seed) * 14 : 0),
      y:
        clamp(star.y, 0.06, 0.94) * height +
        Math.cos(time * 0.0001 + star.seed) * params.idle * 0.09,
    }));

    const maxDistance = Math.min(width, height) * (0.18 + params.density / 700);
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i];
        const b = positions[j];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const musicalConnection = Math.abs(a.star.note - b.star.note) % 12;
        if (
          distance > maxDistance ||
          (![0, 3, 4, 5, 7, 8, 9].includes(musicalConnection) &&
            music.notes.length > 1)
        )
          continue;
        const alpha =
          (1 - distance / maxDistance) *
          0.13 *
          Math.min(a.star.strength, b.star.strength);
        context.beginPath();
        context.moveTo(a.x, a.y);
        const curve = Math.sin(time * 0.0004 + i * j) * music.tension * 24;
        context.quadraticCurveTo(
          (a.x + b.x) / 2 + curve,
          (a.y + b.y) / 2 - curve,
          b.x,
          b.y,
        );
        context.strokeStyle = rgba(noteColor(frame, a.star.note), alpha);
        context.lineWidth = 0.5;
        context.stroke();
      }
    }

    for (const position of positions) {
      const { star, x, y } = position;
      star.pulse *= 0.93;
      star.strength *= music.sustain ? 0.9997 : 0.999;
      const twinkle = 0.78 + Math.sin(time * 0.002 + star.seed) * 0.22;
      const radius = (1.2 + star.strength * 2.5 + star.pulse * 6) * twinkle;
      const color = noteColor(frame, star.note);
      drawSoftPoint(
        context,
        x,
        y,
        radius,
        color,
        clamp(star.strength * 0.55, 0.04, 0.82),
      );
      context.beginPath();
      context.moveTo(x - radius * 2, y);
      context.lineTo(x + radius * 2, y);
      context.moveTo(x, y - radius * 2);
      context.lineTo(x, y + radius * 2);
      context.strokeStyle = rgba(color, star.strength * 0.15);
      context.lineWidth = 0.45;
      context.stroke();
    }
    context.restore();
  }

  reset(): void {
    this.stars = [];
  }
}
