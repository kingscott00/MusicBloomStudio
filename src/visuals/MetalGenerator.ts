import type { HeldNote, VisualFrame, VisualGenerator } from "../types";
import { rgba } from "../utils/color";
import { clamp } from "../utils/math";
import { noteColor, qualityCount } from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

interface MetalRipple {
  note: number;
  velocity: number;
  life: number;
  radius: number;
  repetitions: number;
}

export class MetalGenerator implements VisualGenerator {
  readonly mode = "metal" as const;
  private ripples: MetalRipple[] = [];
  private repetitions = new Map<number, number>();

  noteTriggered(note: HeldNote): void {
    const count = (this.repetitions.get(note.note) ?? 0) + 1;
    this.repetitions.set(note.note, count);
    this.ripples.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      radius: 5,
      repetitions: count,
    });
    this.ripples = this.ripples.slice(-14);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const profile = harmonyProfile(frame.music.chord.quality);
    const motion = frame.params.reducedMotion ? 0.32 : 1;
    const root = frame.music.chord.root ?? frame.music.lastNote ?? 60;
    const segments = qualityCount(frame, 64, 34);
    const bandCount = qualityCount(
      frame,
      3 + Math.min(4, frame.voices.length) + profile.layerBonus,
      3,
    );

    context.save();
    context.globalCompositeOperation = "screen";
    for (let band = bandCount - 1; band >= 0; band -= 1) {
      const depth = band / Math.max(1, bandCount - 1);
      const color = noteColor(frame, root + band * 1.9);
      const amplitude =
        frame.height *
        (0.045 +
          frame.dynamics.held * 0.06 +
          frame.dynamics.attack * 0.07 +
          profile.instability * 0.035);
      const centerY =
        frame.height *
        (0.38 +
          depth * 0.23 +
          Math.sin(frame.time * 0.00013 + band) *
            (frame.params.autoMotion ? 0.045 : 0.012));
      context.beginPath();
      for (let point = 0; point <= segments; point += 1) {
        const progress = point / segments;
        let deformation =
          Math.sin(
            progress * Math.PI * (2.4 + band * 0.72) +
              frame.time * 0.001 * (0.5 + frame.params.speed * 0.025) * motion +
              band,
          ) * amplitude;
        for (const voice of frame.voices.slice(-6)) {
          const position = 0.5 + pitchPosition(voice.note) * 0.32;
          const distance = progress - position;
          const influence = Math.exp(-distance * distance * 38);
          deformation +=
            influence *
            frame.height *
            (0.025 +
              velocityCurve(voice.velocity) * 0.055 +
              voice.attack * 0.08) *
            Math.sin(
              distance * 24 +
                frame.time * 0.0015 +
                voice.note +
                voice.releaseProgress * 2,
            ) *
            (1 - voice.releaseProgress * 0.42);
        }
        deformation +=
          Math.sin(progress * 31 + frame.time * 0.0018) *
          frame.height *
          profile.warp *
          0.009;
        const x = progress * frame.width;
        const y = centerY + deformation * (0.65 + depth * 0.65);
        if (point === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }

      context.strokeStyle = rgba(color, 0.08 + frame.dynamics.held * 0.14);
      context.shadowColor = color;
      context.shadowBlur = 10 + frame.params.glow * 0.1;
      context.lineWidth =
        10 +
        depth * 12 +
        frame.dynamics.velocity * 7 +
        frame.dynamics.attack * 8;
      context.stroke();
      context.strokeStyle = rgba(
        "#ffffff",
        0.15 + frame.dynamics.intensity * 0.2,
      );
      context.shadowBlur = 3;
      context.lineWidth = 1 + frame.dynamics.velocity * 1.3;
      context.stroke();
      context.strokeStyle = rgba(color, 0.12 + profile.inward * 0.08);
      context.shadowBlur = 0;
      context.lineWidth = 0.5;
      context.stroke();
    }

    for (const voice of frame.voices.slice(-7)) {
      const x = frame.width * (0.5 + pitchPosition(voice.note) * 0.32);
      const y =
        frame.height * (0.56 - (registerPosition(voice.note) - 0.5) * 0.24);
      const force = velocityCurve(voice.velocity);
      const radius =
        Math.min(frame.width, frame.height) *
        (0.025 +
          force * 0.035 +
          voice.development * 0.025 +
          voice.structuralLayer * 0.03) *
        (1 - voice.releaseProgress * 0.46);
      this.drawBlob(
        context,
        frame,
        voice.note,
        x,
        y,
        radius,
        voice.age,
        profile.warp,
      );
    }
    this.drawRipples(context, frame);
    context.restore();
  }

  private drawBlob(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    note: number,
    x: number,
    y: number,
    radius: number,
    age: number,
    tension: number,
  ): void {
    const points = qualityCount(frame, 28, 18);
    context.beginPath();
    for (let point = 0; point <= points; point += 1) {
      const angle = (point / points) * Math.PI * 2;
      const deformation =
        1 +
        Math.sin(angle * 3 + age * 0.002 + note) * (0.08 + tension * 0.08) +
        Math.sin(angle * 5 - age * 0.0013) * 0.035;
      const px = x + Math.cos(angle) * radius * deformation;
      const py = y + Math.sin(angle) * radius * deformation * 0.76;
      if (point === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    const color = noteColor(frame, note);
    context.fillStyle = rgba(color, 0.07);
    context.strokeStyle = rgba("#ffffff", 0.31);
    context.shadowColor = color;
    context.shadowBlur = 12 + frame.params.glow * 0.1;
    context.lineWidth = 1.1;
    context.fill();
    context.stroke();
  }

  private drawRipples(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
  ): void {
    for (const ripple of this.ripples) {
      const force = velocityCurve(ripple.velocity);
      ripple.radius += frame.delta * (0.06 + force * 0.16);
      ripple.life -= frame.delta * 0.00105;
      const x = frame.width * (0.5 + pitchPosition(ripple.note) * 0.32);
      const y =
        frame.height * (0.56 - (registerPosition(ripple.note) - 0.5) * 0.24);
      const interference = 1 + (ripple.repetitions % 5) * 0.08;
      context.beginPath();
      context.ellipse(
        x,
        y,
        ripple.radius * interference,
        ripple.radius * (0.44 + force * 0.2),
        ripple.note * 0.13,
        0,
        Math.PI * 2,
      );
      context.strokeStyle = rgba(
        noteColor(frame, ripple.note),
        clamp(ripple.life, 0, 1) * (0.14 + force * 0.3),
      );
      context.shadowColor = "#ffffff";
      context.shadowBlur = 4 + frame.params.glow * 0.06;
      context.lineWidth = 0.7 + force * 1.5;
      context.stroke();
    }
    this.ripples = this.ripples.filter((ripple) => ripple.life > 0);
  }

  reset(): void {
    this.ripples = [];
    this.repetitions.clear();
  }

  getActiveCount(): number {
    return this.ripples.length;
  }
}
