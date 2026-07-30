import type { HeldNote, VisualFrame, VisualGenerator } from "../types";
import { rgba } from "../utils/color";
import { clamp } from "../utils/math";
import { glowStroke, noteColor, qualityCount } from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  voiceComposition,
} from "./musicMapping";

interface GeometryPulse {
  note: number;
  velocity: number;
  life: number;
  radius: number;
}

export class GeometryGenerator implements VisualGenerator {
  readonly mode = "geometry" as const;
  private pulses: GeometryPulse[] = [];
  private phase = 0;

  noteTriggered(note: HeldNote): void {
    this.pulses.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      radius: 6,
    });
    this.pulses = this.pulses.slice(-12);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const profile = harmonyProfile(frame.music.chord.quality);
    const composition = voiceComposition(frame.voices);
    const motion = frame.params.reducedMotion ? 0.3 : 1;
    this.phase +=
      frame.delta *
      (0.000035 + frame.params.speed * 0.0000012) *
      motion *
      (1 + frame.dynamics.rhythm * 0.45);
    const cx =
      frame.width *
      (0.5 +
        composition.pitch * 0.05 +
        (frame.params.autoMotion ? Math.sin(frame.time * 0.00007) * 0.035 : 0));
    const cy =
      frame.height *
      (0.5 +
        (0.5 - composition.register) * 0.12 +
        (frame.params.autoMotion ? Math.cos(frame.time * 0.00009) * 0.025 : 0));
    const root = frame.music.chord.root ?? frame.music.lastNote ?? 60;
    const base =
      Math.min(frame.width, frame.height) *
      (0.09 + frame.params.bloom / 1100) *
      (0.86 + profile.openness * 0.14 + frame.dynamics.held * 0.08);
    const sides = clamp(
      Math.round(
        frame.params.symmetry +
          profile.crystalline * 2 -
          profile.instability * 2,
      ),
      3,
      16,
    );
    const layerCount = qualityCount(
      frame,
      4 +
        Math.min(4, frame.voices.length) +
        profile.layerBonus +
        Math.round(profile.halo),
      3,
    );

    context.save();
    context.translate(cx, cy);
    context.globalCompositeOperation = "screen";
    for (let layer = layerCount - 1; layer >= 0; layer -= 1) {
      const depth = layer / Math.max(1, layerCount - 1);
      const radius =
        base *
        (0.38 + depth * 1.08) *
        (1 + Math.sin(frame.time * 0.0007 + layer) * profile.float * 0.035);
      const rotation =
        this.phase * (layer % 2 ? -1 : 1) +
        layer * 0.21 +
        profile.directionalPull * 0.3;
      const color = noteColor(frame, root + layer * 1.7);
      context.save();
      context.rotate(rotation);
      this.drawPolygon(
        context,
        sides + (layer % 2),
        radius,
        profile.warp * 0.08,
        frame.time,
      );
      glowStroke(
        context,
        color,
        3 + frame.params.glow * 0.075,
        0.1 +
          frame.dynamics.held * 0.14 +
          frame.dynamics.attack * 0.13 +
          (1 - depth) * 0.05,
      );
      context.lineWidth = 0.55 + frame.dynamics.velocity * 0.75;
      context.stroke();

      const circleCount = Math.min(
        sides,
        qualityCount(frame, sides, Math.min(4, sides)),
      );
      for (let circle = 0; circle < circleCount; circle += 1) {
        const angle = (circle / circleCount) * Math.PI * 2;
        const orbit = radius * (0.45 + profile.inward * 0.08);
        const circleRadius =
          radius *
          (0.28 +
            profile.openness * 0.035 +
            Math.sin(circle * 2.1 + frame.time * 0.0006) *
              profile.instability *
              0.018);
        context.beginPath();
        context.arc(
          Math.cos(angle) * orbit,
          Math.sin(angle) * orbit,
          circleRadius,
          0,
          Math.PI * 2,
        );
        context.strokeStyle = rgba(
          noteColor(frame, root + circle),
          0.045 + frame.dynamics.held * 0.075 + profile.halo * 0.025,
        );
        context.lineWidth = 0.45;
        context.stroke();
      }
      context.restore();
    }

    const fracture = profile.instability * (0.2 + frame.music.tension * 0.45);
    if (fracture > 0.08) {
      const rays = qualityCount(frame, sides, 4);
      for (let ray = 0; ray < rays; ray += 1) {
        const angle = (ray / rays) * Math.PI * 2 + this.phase;
        const offset =
          Math.sin(ray * 9.17 + frame.time * 0.002) * fracture * base;
        context.beginPath();
        context.moveTo(
          Math.cos(angle) * base * 0.14,
          Math.sin(angle) * base * 0.14,
        );
        context.lineTo(
          Math.cos(angle) * base * (1.22 + fracture) + offset,
          Math.sin(angle) * base * (1.22 + fracture) - offset,
        );
        context.strokeStyle = rgba(
          noteColor(frame, root + ray),
          fracture * 0.12,
        );
        context.lineWidth = 0.5;
        context.stroke();
      }
    }
    this.drawPulses(context, frame, root);
    context.restore();
  }

  private drawPolygon(
    context: CanvasRenderingContext2D,
    sides: number,
    radius: number,
    warp: number,
    time: number,
  ): void {
    context.beginPath();
    for (let point = 0; point <= sides; point += 1) {
      const angle = (point / sides) * Math.PI * 2 - Math.PI / 2;
      const pointRadius =
        radius * (1 + Math.sin(point * 4.13 + time * 0.0015) * warp);
      const x = Math.cos(angle) * pointRadius;
      const y = Math.sin(angle) * pointRadius;
      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  }

  private drawPulses(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    root: number,
  ): void {
    for (const pulse of this.pulses) {
      pulse.radius += frame.delta * (0.07 + pulse.velocity / 800);
      pulse.life -= frame.delta * 0.001;
      const sides = 5 + (pulse.note % 7);
      context.save();
      context.rotate(pitchPosition(pulse.note) * 0.4);
      this.drawPolygon(context, sides, pulse.radius, 0, frame.time);
      context.strokeStyle = rgba(
        noteColor(frame, pulse.note || root),
        pulse.life * (0.14 + pulse.velocity / 360),
      );
      context.lineWidth = 0.7 + pulse.velocity / 100;
      context.stroke();
      context.restore();
    }
    this.pulses = this.pulses.filter((pulse) => pulse.life > 0);
  }

  reset(): void {
    this.pulses = [];
    this.phase = 0;
  }

  getActiveCount(): number {
    return this.pulses.length;
  }
}
