import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, lerp } from "../utils/math";
import { glowStroke, noteColor } from "./helpers";

interface Ribbon {
  note: number;
  velocity: number;
  life: number;
  phase: number;
  points: Array<{ x: number; y: number }>;
}

export class RibbonsGenerator implements VisualGenerator {
  readonly mode = "ribbons" as const;
  private ribbons: Ribbon[] = [];

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const existing = this.ribbons.find((ribbon) => ribbon.note === note.note);
    if (existing) {
      existing.life = 1;
      existing.velocity = note.velocity;
      return;
    }
    this.ribbons.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      phase: note.note * 0.73 + state.sequence * 0.31,
      points: [],
    });
    this.ribbons = this.ribbons.slice(-14);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const { width, height, time, params, music } = frame;
    if (!this.ribbons.length) {
      this.ribbons.push({
        note: 60,
        velocity: 28,
        life: 0.25,
        phase: 2,
        points: [],
      });
    }

    context.save();
    context.globalCompositeOperation = "lighter";
    for (let index = 0; index < this.ribbons.length; index += 1) {
      const ribbon = this.ribbons[index];
      const direction = Math.sign(music.lastInterval || 1);
      const phase =
        time *
          0.00018 *
          (20 + params.speed) *
          (params.reducedMotion ? 0.25 : 1) +
        ribbon.phase;
      const targetX =
        width *
        (0.5 +
          Math.sin(phase * 0.15 + index) * (params.autoMotion ? 0.12 : 0.03));
      const registerY = height * (0.83 - ((ribbon.note - 24) / 84) * 0.64);
      const waveY =
        Math.sin(phase + index * 0.7) * height * (0.04 + music.tension * 0.06);
      const targetY = registerY + waveY;
      const last = ribbon.points[ribbon.points.length - 1];
      const next = {
        x: last
          ? lerp(last.x, targetX, 0.025 + params.responsiveness / 1800) +
            direction * music.rhythmicActivity * 1.8
          : targetX,
        y: last
          ? lerp(last.y, targetY, 0.035 + params.responsiveness / 1300)
          : targetY,
      };
      ribbon.points.push(next);
      const maxPoints = Math.round(24 + params.trails * 1.15);
      if (ribbon.points.length > maxPoints)
        ribbon.points.splice(0, ribbon.points.length - maxPoints);
      ribbon.life -= frame.delta * (music.sustain ? 0.000045 : 0.0001);
      if (music.notes.some((note) => note.note === ribbon.note))
        ribbon.life = Math.min(1, ribbon.life + 0.025);

      if (ribbon.points.length < 3) continue;
      const color = noteColor(frame, ribbon.note, index / 18);
      for (let strand = -1; strand <= 1; strand += 1) {
        context.beginPath();
        ribbon.points.forEach((point, pointIndex) => {
          const progress = pointIndex / ribbon.points.length;
          const drift =
            Math.sin(pointIndex * 0.18 + phase + strand) *
            (5 + params.bloom * 0.07);
          const x =
            point.x +
            drift * strand +
            Math.sin(progress * Math.PI) * music.lastInterval * 0.8;
          const y =
            point.y +
            strand * (5 + index * 0.8) +
            Math.cos(pointIndex * 0.12 + phase) * 7;
          if (pointIndex === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        glowStroke(
          context,
          color,
          4 + params.glow * 0.13,
          clamp(ribbon.life, 0, 1) * (strand === 0 ? 0.23 : 0.09),
        );
        context.lineWidth = strand === 0 ? 1.25 + ribbon.velocity / 100 : 0.55;
        context.stroke();
      }
    }
    context.restore();
    this.ribbons = this.ribbons.filter((ribbon) => ribbon.life > 0);

    // A faint connective veil keeps single-note playing visually substantial.
    if (this.ribbons.length === 1) {
      const ribbon = this.ribbons[0];
      context.fillStyle = rgba(noteColor(frame, ribbon.note), 0.018);
      context.fillRect(0, 0, width, height);
    }
  }

  reset(): void {
    this.ribbons = [];
  }
}
