import type { HeldNote, VisualFrame, VisualGenerator } from "../types";
import { rgba } from "../utils/color";
import { clamp } from "../utils/math";
import { drawSoftPoint, glowStroke, noteColor, qualityCount } from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  registerPosition,
  velocityCurve,
  voiceComposition,
} from "./musicMapping";

interface DepthPulse {
  note: number;
  velocity: number;
  life: number;
  depth: number;
}

export class PortalGenerator implements VisualGenerator {
  readonly mode = "portal" as const;
  private pulses: DepthPulse[] = [];
  private rotation = 0;

  noteTriggered(note: HeldNote): void {
    this.pulses.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      depth: 0,
    });
    this.pulses = this.pulses.slice(-14);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const profile = harmonyProfile(frame.music.chord.quality);
    const composition = voiceComposition(frame.voices);
    const motion = frame.params.reducedMotion ? 0.3 : 1;
    this.rotation +=
      frame.delta *
      (0.000018 + frame.params.rotation * 0.0000008) *
      motion *
      (1 + frame.dynamics.rhythm * 0.7);
    const cx =
      frame.width *
      (0.5 +
        composition.pitch * 0.075 +
        (frame.params.autoMotion ? Math.sin(frame.time * 0.00008) * 0.04 : 0));
    const cy =
      frame.height *
      (0.5 +
        (0.5 - composition.register) * 0.1 +
        (frame.params.autoMotion ? Math.cos(frame.time * 0.0001) * 0.025 : 0));
    const root = frame.music.chord.root ?? frame.music.lastNote ?? 60;
    const openEnergy = clamp(
      0.24 +
        frame.dynamics.held * 0.44 +
        frame.dynamics.sustain * 0.18 +
        frame.dynamics.attack * 0.17 -
        frame.dynamics.release * 0.08,
      0.2,
      1,
    );
    const rings = qualityCount(
      frame,
      10 +
        Math.min(7, frame.voices.length * 2) +
        profile.layerBonus * 2 +
        Math.round(frame.params.density / 24),
      8,
    );
    const maxRadius =
      Math.min(frame.width, frame.height) *
      (0.22 + frame.params.bloom / 410) *
      (0.78 + profile.openness * 0.12) *
      (0.72 + openEnergy * 0.32);

    context.save();
    context.translate(cx, cy);
    context.globalCompositeOperation = "screen";
    for (let ring = 0; ring < rings; ring += 1) {
      const depth = ring / Math.max(1, rings - 1);
      const perspective = Math.pow(depth, 1.55);
      const radius = maxRadius * (0.08 + perspective * 0.92);
      const tunnelOffset =
        (1 - depth) * maxRadius * (0.18 + profile.directionalPull * 0.16);
      const x =
        -tunnelOffset +
        Math.sin(frame.time * 0.0005 + ring * 0.73) *
          profile.instability *
          radius *
          0.08;
      const y =
        tunnelOffset * 0.24 +
        Math.cos(frame.time * 0.00043 + ring) * profile.float * radius * 0.045;
      const sides = clamp(
        Math.round(frame.params.symmetry + profile.crystalline * 3),
        4,
        16,
      );
      const color = noteColor(frame, root + ring * 0.72);
      context.save();
      context.translate(x, y);
      context.rotate(
        this.rotation * (1.1 - depth * 0.6) * (ring % 2 ? -1 : 1) +
          ring * 0.055,
      );
      context.scale(1, 0.68 + depth * 0.22 + profile.inward * 0.05);
      context.beginPath();
      for (let point = 0; point <= sides; point += 1) {
        const angle = (point / sides) * Math.PI * 2;
        const fracture =
          1 +
          Math.sin(point * 7.1 + frame.time * 0.0017) * profile.warp * 0.045;
        const px = Math.cos(angle) * radius * fracture;
        const py = Math.sin(angle) * radius;
        if (point === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      glowStroke(
        context,
        color,
        3 + frame.params.glow * 0.085,
        (0.055 + depth * 0.12 + frame.dynamics.held * 0.05) *
          (0.76 + openEnergy * 0.32),
      );
      context.lineWidth = 0.5 + depth * 0.8 + frame.dynamics.velocity * 0.55;
      context.stroke();
      context.restore();
    }

    const spokeCount = qualityCount(
      frame,
      frame.params.symmetry + profile.layerBonus * 2,
      4,
    );
    for (let spoke = 0; spoke < spokeCount; spoke += 1) {
      const angle = (spoke / spokeCount) * Math.PI * 2 + this.rotation;
      context.beginPath();
      context.moveTo(
        Math.cos(angle) * maxRadius * 0.06,
        Math.sin(angle) * maxRadius * 0.04,
      );
      context.lineTo(
        Math.cos(angle + profile.directionalPull * 0.08) * maxRadius,
        Math.sin(angle + profile.directionalPull * 0.08) * maxRadius * 0.82,
      );
      context.strokeStyle = rgba(
        noteColor(frame, root + spoke),
        0.025 + frame.dynamics.held * 0.045,
      );
      context.lineWidth = 0.45;
      context.stroke();
    }

    drawSoftPoint(
      context,
      -maxRadius * 0.14,
      maxRadius * 0.035,
      maxRadius * (0.045 + openEnergy * 0.03),
      noteColor(frame, root, 0.12),
      0.38 + frame.dynamics.intensity * 0.28,
    );
    this.drawPulses(context, frame, maxRadius);
    context.restore();
  }

  private drawPulses(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    maxRadius: number,
  ): void {
    for (const pulse of this.pulses) {
      const force = velocityCurve(pulse.velocity);
      pulse.depth +=
        frame.delta *
        (0.00045 + force * 0.0007) *
        (frame.params.reducedMotion ? 0.48 : 1);
      pulse.life -= frame.delta * 0.00072;
      const perspective = clamp(pulse.depth, 0, 1.2);
      const radius = maxRadius * (0.05 + perspective * perspective * 0.94);
      const offset = (1 - perspective) * maxRadius * 0.17;
      context.beginPath();
      context.ellipse(
        -offset,
        offset * 0.24,
        radius,
        radius * (0.68 + registerPosition(pulse.note) * 0.16),
        pitchPosition(pulse.note) * 0.18,
        0,
        Math.PI * 2,
      );
      context.strokeStyle = rgba(
        noteColor(frame, pulse.note),
        pulse.life * (0.18 + force * 0.34),
      );
      context.shadowColor = noteColor(frame, pulse.note);
      context.shadowBlur = 8 + frame.params.glow * 0.1;
      context.lineWidth = 0.7 + force * 1.8;
      context.stroke();
    }
    this.pulses = this.pulses.filter(
      (pulse) => pulse.life > 0 && pulse.depth < 1.25,
    );
  }

  reset(): void {
    this.pulses = [];
    this.rotation = 0;
  }

  getActiveCount(): number {
    return this.pulses.length;
  }
}
