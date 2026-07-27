import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
} from "../types";
import { clamp } from "../utils/math";
import {
  drawSoftPoint,
  glowStroke,
  limitParticles,
  noteColor,
  organicWave,
  type Spark,
} from "./helpers";

interface Tendril extends Spark {
  angle: number;
  radius: number;
  note: number;
}

export class BloomGenerator implements VisualGenerator {
  readonly mode = "bloom" as const;
  private tendrils: Tendril[] = [];
  private pulse = 0;

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const count = 5 + Math.round(note.velocity / 18);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + note.note * 0.31;
      this.tendrils.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * (0.15 + note.velocity / 180),
        vy: Math.sin(angle) * (0.15 + note.velocity / 180),
        life: 1,
        maxLife: 1,
        size: 1.5 + note.velocity / 45,
        hue: note.note / 12,
        seed: Math.random() * 50,
        angle,
        radius: 12 + state.notes.length * 3,
        note: note.note,
      });
    }
    this.pulse = Math.max(this.pulse, 0.3 + (note.velocity / 127) * 0.7);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const { width, height, time, music, params } = frame;
    const cx =
      width * 0.5 +
      (params.autoMotion ? Math.sin(time * 0.00011) * width * 0.035 : 0);
    const cy = height * (0.5 - (music.averageRegister - 0.5) * 0.17);
    const energy = Math.max(0.12 + params.idle / 420, music.energy);
    const breath =
      1 + Math.sin(time * 0.0012 * (0.5 + params.speed / 100)) * 0.045;
    this.pulse *= 0.96;
    const radius =
      Math.min(width, height) *
      (0.105 + params.bloom / 900) *
      breath *
      (1 + this.pulse * 0.18);
    const symmetry = Math.max(3, params.symmetry);
    const layers = clamp(
      2 +
        music.notes.length +
        (music.chord.quality.includes("7") ? 1 : 0) +
        (music.chord.quality.includes("9") ? 2 : 0),
      3,
      9,
    );

    context.save();
    context.translate(cx, cy);
    context.rotate(
      time * 0.000025 * params.rotation +
        music.tension * Math.sin(time * 0.0013) * 0.05,
    );
    context.globalCompositeOperation = "lighter";

    for (let layer = layers; layer >= 0; layer -= 1) {
      const layerRadius =
        radius * (0.34 + (layer / Math.max(1, layers)) * 0.76);
      const petalCount = symmetry + Math.min(5, music.notes.length);
      const color = noteColor(
        frame,
        (music.chord.root ?? layer * 2) + layer * 0.72,
      );
      context.beginPath();
      for (let step = 0; step <= petalCount * 18; step += 1) {
        const angle = (step / (petalCount * 18)) * Math.PI * 2;
        const petal = Math.pow(
          Math.abs(Math.cos((angle * petalCount) / 2)),
          0.65,
        );
        const unresolved =
          music.chord.quality === "sus2" || music.chord.quality === "sus4"
            ? Math.sin(angle * 2 + time * 0.001) * 0.12
            : 0;
        const organic =
          organicWave(angle, time, layer) * (0.035 + music.tension * 0.045);
        const r = layerRadius * (0.54 + petal * 0.48 + organic + unresolved);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r * (0.86 + music.averageRegister * 0.18);
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      glowStroke(
        context,
        color,
        4 + params.glow * 0.16,
        (0.085 + energy * 0.15) * (1 - (layer / (layers + 2)) * 0.3),
      );
      context.lineWidth = 0.55 + (layers - layer) * 0.12;
      context.stroke();
    }

    for (let spoke = 0; spoke < symmetry; spoke += 1) {
      const angle = (spoke / symmetry) * Math.PI * 2;
      context.beginPath();
      context.moveTo(
        Math.cos(angle) * radius * 0.08,
        Math.sin(angle) * radius * 0.08,
      );
      context.quadraticCurveTo(
        Math.cos(angle + 0.35) * radius * 0.55,
        Math.sin(angle + 0.35) * radius * 0.55,
        Math.cos(angle) * radius * (1.08 + music.tension * 0.1),
        Math.sin(angle) * radius * (1.08 + music.tension * 0.1),
      );
      glowStroke(
        context,
        noteColor(frame, spoke + (music.chord.root ?? 0)),
        8 + params.glow * 0.12,
        0.07 + energy * 0.11,
      );
      context.stroke();
    }
    context.restore();

    for (const tendril of this.tendrils) {
      tendril.radius += (0.4 + params.speed / 90) * frame.delta * 0.06;
      tendril.angle += (0.0007 + params.rotation * 0.000006) * frame.delta;
      tendril.life -= frame.delta * (music.sustain ? 0.00014 : 0.00029);
      const x =
        cx +
        Math.cos(tendril.angle + Math.sin(time * 0.001 + tendril.seed) * 0.13) *
          tendril.radius;
      const y = cy + Math.sin(tendril.angle) * tendril.radius * 0.82;
      drawSoftPoint(
        context,
        x,
        y,
        tendril.size * (0.5 + tendril.life),
        noteColor(frame, tendril.note),
        tendril.life * 0.36,
      );
    }
    this.tendrils = limitParticles(this.tendrils, frame, 0.65);
  }

  reset(): void {
    this.tendrils = [];
    this.pulse = 0;
  }
}
