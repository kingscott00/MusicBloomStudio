import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
} from "../types";
import { rgba } from "../utils/color";
import { clamp } from "../utils/math";
import {
  drawSoftPoint,
  glowStroke,
  limitParticles,
  noteColor,
  type Spark,
} from "./helpers";

interface Orbiter extends Spark {
  angle: number;
  radius: number;
  note: number;
  tilt: number;
}

export class OrbitGenerator implements VisualGenerator {
  readonly mode = "orbit" as const;
  private orbiters: Orbiter[] = [];

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const count = 3 + Math.round(note.velocity / 28);
    for (let i = 0; i < count; i += 1) {
      this.orbiters.push({
        x: 0,
        y: 0,
        vx: 0.0004 + Math.random() * 0.001,
        vy: 0,
        life: 1,
        maxLife: 1,
        size: 1.3 + note.velocity / 34,
        hue: note.note / 12,
        seed: Math.random() * 80,
        angle: Math.random() * Math.PI * 2,
        radius: 35 + (note.note - 36) * 2.2 + state.notes.length * 7,
        note: note.note,
        tilt: (Math.random() - 0.5) * 0.75,
      });
    }
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const { width, height, time, params, music } = frame;
    const cx =
      width * 0.5 +
      (params.autoMotion ? Math.cos(time * 0.00013) * width * 0.05 : 0);
    const cy =
      height * 0.5 +
      (params.autoMotion ? Math.sin(time * 0.00017) * height * 0.035 : 0);
    const base = Math.min(width, height) * 0.12;
    const ringCount = clamp(3 + music.notes.length, 3, 10);
    context.save();
    context.translate(cx, cy);
    context.globalCompositeOperation = "lighter";

    const coreColor = noteColor(frame, music.chord.root ?? 0, time * 0.00001);
    const core = context.createRadialGradient(0, 0, 0, 0, 0, base * 0.95);
    core.addColorStop(0, rgba(coreColor, 0.38 + music.energy * 0.2));
    core.addColorStop(0.25, rgba(coreColor, 0.12));
    core.addColorStop(1, rgba(coreColor, 0));
    context.fillStyle = core;
    context.fillRect(-base, -base, base * 2, base * 2);

    for (let ring = 0; ring < ringCount; ring += 1) {
      const radius = base * (0.74 + ring * 0.35);
      const wobble =
        1 +
        Math.sin(time * 0.0007 + ring * 1.7) * (0.025 + music.tension * 0.04);
      context.save();
      context.rotate(
        time * 0.000012 * params.rotation * (ring % 2 ? -1 : 1) + ring * 0.43,
      );
      context.scale(1, 0.42 + ((ring * 0.13) % 0.45));
      context.beginPath();
      context.ellipse(0, 0, radius * wobble, radius, 0, 0, Math.PI * 2);
      glowStroke(
        context,
        noteColor(frame, (music.chord.root ?? ring) + ring * 1.8),
        5 + params.glow * 0.1,
        0.12 + music.energy * 0.11,
      );
      context.lineWidth = ring % 3 === 0 ? 1.4 : 0.8;
      context.stroke();
      context.restore();
    }
    context.restore();

    for (let point = 0; point < 12; point += 1) {
      const angle = point * 2.399 + time * 0.000018 * (1 + params.rotation);
      const distance = base * (1.15 + (point % 5) * 0.36);
      drawSoftPoint(
        context,
        cx + Math.cos(angle) * distance,
        cy + Math.sin(angle) * distance * 0.58,
        1.2 + (point % 3) * 0.5,
        noteColor(frame, point + (music.chord.root ?? 0)),
        0.12 + music.energy * 0.08,
      );
    }

    for (const orbiter of this.orbiters) {
      orbiter.angle +=
        orbiter.vx *
        frame.delta *
        (0.3 + params.speed / 60) *
        (params.reducedMotion ? 0.35 : 1);
      orbiter.life -= frame.delta * (music.sustain ? 0.00008 : 0.00018);
      const targetRadius = base * 0.6 + ((orbiter.note - 24) / 72) * base * 3.2;
      orbiter.radius +=
        (targetRadius - orbiter.radius) * 0.008 * params.responsiveness;
      const x = cx + Math.cos(orbiter.angle) * orbiter.radius;
      const y =
        cy +
        Math.sin(orbiter.angle) *
          orbiter.radius *
          (0.38 + Math.abs(orbiter.tilt));
      const color = noteColor(frame, orbiter.note);
      drawSoftPoint(
        context,
        x,
        y,
        orbiter.size * (0.8 + music.energy),
        color,
        orbiter.life * 0.65,
      );
      if (orbiter.life > 0.25) {
        context.beginPath();
        context.moveTo(
          cx + Math.cos(orbiter.angle - 0.08) * orbiter.radius,
          cy +
            Math.sin(orbiter.angle - 0.08) *
              orbiter.radius *
              (0.38 + Math.abs(orbiter.tilt)),
        );
        context.lineTo(x, y);
        context.strokeStyle = rgba(color, orbiter.life * 0.12);
        context.stroke();
      }
    }
    this.orbiters = limitParticles(this.orbiters, frame, 1.1);
  }

  reset(): void {
    this.orbiters = [];
  }
}
