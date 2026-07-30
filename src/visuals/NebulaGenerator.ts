import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
  VisualNoteVoice,
} from "../types";
import { clamp, hashNoise } from "../utils/math";
import { drawSoftPoint, limitParticles, noteColor } from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

interface NebulaDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  seed: number;
  note: number;
  depth: number;
}

export class NebulaGenerator implements VisualGenerator {
  readonly mode = "nebula" as const;
  private dust: NebulaDust[] = [];
  private emission = 0;
  private serial = 0;

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const count = 8 + Math.round(velocityCurve(note.velocity) * 18);
    for (let index = 0; index < count; index += 1)
      this.spawnDust(
        note.note,
        note.velocity,
        state.sequence * 31 + index,
        true,
      );
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const profile = harmonyProfile(frame.music.chord.quality);
    const motion = frame.params.reducedMotion ? 0.32 : 1;
    const voicesByNote = new Map<number, VisualNoteVoice>();
    for (const voice of frame.voices) voicesByNote.set(voice.note, voice);

    this.emission +=
      frame.delta *
      frame.dynamics.held *
      (0.012 + frame.params.density * 0.00012) *
      (0.5 + frame.qualityScale * 0.5);
    while (this.emission >= 1 && frame.music.notes.length) {
      const held = frame.music.notes[this.serial % frame.music.notes.length];
      this.spawnDust(held.note, held.velocity, this.serial++, false);
      this.emission -= 1;
    }

    context.save();
    context.globalCompositeOperation = "screen";
    const cloudVoices = frame.voices.slice(-8);
    for (let voiceIndex = 0; voiceIndex < cloudVoices.length; voiceIndex += 1) {
      const voice = cloudVoices[voiceIndex];
      const register = registerPosition(voice.note);
      const x =
        frame.width *
        (0.5 +
          pitchPosition(voice.note) * 0.3 +
          Math.sin(frame.time * 0.00011 + voice.note) * 0.04);
      const y =
        frame.height *
        (0.76 -
          register * 0.54 +
          Math.cos(frame.time * 0.00009 + voice.note * 0.7) * 0.045);
      const releaseScale = 1 + voice.releaseProgress * voice.releaseDepth * 0.5;
      const radius =
        Math.min(frame.width, frame.height) *
        (0.028 +
          (1 - register) * 0.028 +
          voice.energy * 0.015 +
          voice.development * 0.012) *
        releaseScale;
      const color = noteColor(frame, voice.note, voiceIndex * 0.04);
      const lobes = frame.qualityScale > 0.68 ? 5 : 3;
      context.save();
      context.translate(x, y);
      context.rotate(
        voice.note * 0.19 + frame.time * 0.00008 * (voiceIndex % 2 ? -1 : 1),
      );
      for (let lobe = 0; lobe < lobes; lobe += 1) {
        const direction = lobe % 2 ? -1 : 1;
        const offset = (lobe - (lobes - 1) / 2) * radius * 0.24;
        const length = radius * (1.6 + lobe * 0.22);
        context.beginPath();
        context.moveTo(-length * 0.58, offset);
        context.bezierCurveTo(
          -length * 0.18,
          offset - direction * radius * (0.65 + profile.warp * 0.28),
          length * 0.22,
          offset + direction * radius * (0.7 + profile.float * 0.25),
          length * 0.62,
          offset - direction * radius * 0.18,
        );
        context.strokeStyle = `rgba(255,255,255,${clamp(
          0.012 + voice.energy * 0.025 - voice.releaseProgress * 0.008,
          0.006,
          0.05,
        )})`;
        context.shadowColor = color;
        context.shadowBlur = 12 + frame.params.glow * 0.12;
        context.lineWidth =
          radius * (0.12 + (lobe % 3) * 0.035 + voice.sustain * 0.04);
        context.stroke();
        context.strokeStyle = color;
        context.shadowBlur = 3;
        context.globalAlpha = 0.04 + voice.energy * 0.055;
        context.lineWidth = 0.7;
        context.stroke();
        context.globalAlpha = 1;
      }
      context.restore();
    }

    for (const mote of this.dust) {
      const voice = voicesByNote.get(mote.note);
      const curl =
        Math.sin(frame.time * 0.0007 + mote.seed) *
        (0.000006 + profile.warp * 0.000012);
      mote.vx += -mote.vy * curl * frame.delta;
      mote.vy += mote.vx * curl * frame.delta;
      mote.x += mote.vx * frame.delta * motion;
      mote.y += mote.vy * frame.delta * motion;
      mote.life -=
        frame.delta *
        (voice?.phase === "sustain"
          ? 0.00012
          : voice?.phase === "release"
            ? 0.00032 + voice.releaseProgress * 0.00028
            : voice
              ? 0.00018
              : 0.00052);
      drawSoftPoint(
        context,
        mote.x * frame.width,
        mote.y * frame.height,
        mote.size * (0.65 + mote.depth * 0.7),
        noteColor(frame, mote.note, mote.depth * 0.04),
        clamp(mote.life, 0, 1) * (0.24 + mote.depth * 0.34),
      );
    }
    context.restore();
    this.dust = limitParticles(this.dust, frame, 0.92);
  }

  private spawnDust(
    note: number,
    velocity: number,
    sequence: number,
    attack: boolean,
  ): void {
    const seed = note * 19.7 + sequence * 7.11 + this.serial++ * 0.31;
    const register = registerPosition(note);
    const force = velocityCurve(velocity);
    const angle = hashNoise(seed, 1) * Math.PI * 2;
    const impulse = attack
      ? 0.00006 + force * 0.00018
      : 0.000045 + hashNoise(seed, 8) * 0.000035;
    this.dust.push({
      x: 0.5 + pitchPosition(note) * 0.3 + (hashNoise(seed, 2) - 0.5) * 0.05,
      y: 0.76 - register * 0.54 + (hashNoise(seed, 3) - 0.5) * 0.05,
      vx: Math.cos(angle) * impulse,
      vy: Math.sin(angle) * impulse * 0.65 - 0.000012,
      life: 0.72 + hashNoise(seed, 4) * 0.55,
      maxLife: 1,
      size: 1 + force * 2.6 + hashNoise(seed, 5) * 2.8,
      hue: note / 12,
      seed,
      note,
      depth: 0.35 + hashNoise(seed, 6) * 0.9,
    });
  }

  reset(): void {
    this.dust = [];
    this.emission = 0;
    this.serial = 0;
  }

  getActiveCount(): number {
    return this.dust.length;
  }
}
