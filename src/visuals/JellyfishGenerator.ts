import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
  VisualNoteVoice,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, hashNoise, lerp } from "../utils/math";
import {
  drawSoftPoint,
  limitParticles,
  noteColor,
  qualityCount,
} from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

interface Jelly {
  note: number;
  velocity: number;
  x: number;
  y: number;
  phase: number;
  life: number;
}

interface Plankton {
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
}

interface PulseWave {
  note: number;
  velocity: number;
  life: number;
  radius: number;
}

export class JellyfishGenerator implements VisualGenerator {
  readonly mode = "jellyfish" as const;
  private jellies: Jelly[] = [];
  private plankton: Plankton[] = [];
  private waves: PulseWave[] = [];

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const register = registerPosition(note.note);
    const existing = this.jellies.find((jelly) => jelly.note === note.note);
    if (existing) {
      existing.velocity = note.velocity;
      existing.life = 1;
      existing.phase += 0.7;
    } else {
      this.jellies.push({
        note: note.note,
        velocity: note.velocity,
        x: 0.5 + pitchPosition(note.note) * 0.27,
        y: 0.78 - register * 0.52,
        phase: note.note * 0.37 + state.sequence * 0.91,
        life: 1,
      });
      this.jellies = this.jellies.slice(-10);
    }
    this.waves.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      radius: 8,
    });
    this.waves = this.waves.slice(-12);

    const force = velocityCurve(note.velocity);
    const count = 5 + Math.round(force * 10);
    for (let index = 0; index < count; index += 1) {
      const seed = note.note * 17.7 + state.sequence * 13.1 + index * 5.3;
      this.plankton.push({
        x: 0.5 + pitchPosition(note.note) * 0.27,
        y: 0.78 - register * 0.52,
        vx: (hashNoise(seed, 1) - 0.5) * (0.00004 + force * 0.00008),
        vy: -0.000025 - hashNoise(seed, 2) * 0.00008,
        life: 0.65 + hashNoise(seed, 3) * 0.5,
        maxLife: 1,
        size: 0.8 + hashNoise(seed, 4) * 2.1 + force,
        hue: note.note / 12,
        seed,
        note: note.note,
      });
    }
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    this.syncVoices(frame);
    const voices = new Map<number, VisualNoteVoice>();
    for (const voice of frame.voices) voices.set(voice.note, voice);
    const profile = harmonyProfile(frame.music.chord.quality);
    const motion = frame.params.reducedMotion ? 0.34 : 1;

    if (!this.jellies.length) {
      this.jellies.push({
        note: 57,
        velocity: 24,
        x: 0.52,
        y: 0.5,
        phase: 1.8,
        life: 0.22,
      });
    }

    context.save();
    context.globalCompositeOperation = "screen";
    for (const jelly of this.jellies) {
      const voice = voices.get(jelly.note);
      const register = registerPosition(jelly.note);
      const force = velocityCurve(jelly.velocity);
      const release = voice?.releaseProgress ?? 0;
      const targetX =
        0.5 +
        pitchPosition(jelly.note) * 0.27 +
        Math.sin(frame.time * 0.00012 + jelly.phase) *
          (frame.params.autoMotion ? 0.055 : 0.018);
      const targetY =
        0.76 -
        register * 0.5 +
        Math.sin(frame.time * 0.00019 + jelly.phase * 1.7) * 0.045 -
        (voice?.development ?? 0) * 0.035;
      jelly.x = lerp(jelly.x, targetX, 1 - Math.exp(-frame.delta * 0.0015));
      jelly.y = lerp(jelly.y, targetY, 1 - Math.exp(-frame.delta * 0.0012));
      if (!voice) jelly.life *= Math.exp(-frame.delta / 1900);
      else if (voice.phase !== "release")
        jelly.life = Math.min(1, jelly.life + frame.delta * 0.001);
      else jelly.life = Math.min(jelly.life, 0.28 + voice.release * 0.9);

      const x = jelly.x * frame.width;
      const y = jelly.y * frame.height;
      const size =
        Math.min(frame.width, frame.height) *
        (0.065 + (1 - register) * 0.075 + frame.params.bloom / 1800) *
        (0.78 + force * 0.3 + (voice?.development ?? 0) * 0.18) *
        (1 - release * 0.36);
      this.drawJelly(context, frame, jelly, voice, x, y, size, profile, motion);
    }
    this.drawWaves(context, frame);
    this.drawPlankton(context, frame);
    context.restore();

    this.jellies = this.jellies.filter((jelly) => jelly.life > 0.025);
  }

  private drawJelly(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    jelly: Jelly,
    voice: VisualNoteVoice | undefined,
    x: number,
    y: number,
    size: number,
    profile: ReturnType<typeof harmonyProfile>,
    motion: number,
  ): void {
    const color = noteColor(frame, jelly.note);
    const energy = voice?.energy ?? jelly.life;
    const pulse =
      1 +
      Math.sin(frame.time * 0.0022 * motion + jelly.phase) *
        (0.045 + energy * 0.055) +
      (voice?.attack ?? 0) * 0.18;
    const width = size * pulse * (0.9 + profile.openness * 0.08);
    const height = size * (0.56 + profile.inward * 0.08);

    context.save();
    context.translate(x, y);
    context.rotate(
      Math.sin(frame.time * 0.00023 + jelly.phase) * 0.13 * motion +
        profile.directionalPull * 0.05,
    );
    const shellCount = qualityCount(frame, 3 + profile.layerBonus, 2);
    for (let shell = shellCount - 1; shell >= 0; shell -= 1) {
      const inset = shell / Math.max(1, shellCount - 1);
      const shellWidth = width * (0.72 + inset * 0.34);
      const shellHeight = height * (0.68 + inset * 0.34);
      context.beginPath();
      context.moveTo(-shellWidth, 0);
      context.bezierCurveTo(
        -shellWidth * 0.86,
        -shellHeight * (1.14 + profile.float * 0.12),
        shellWidth * 0.86,
        -shellHeight * (1.14 + profile.float * 0.12),
        shellWidth,
        0,
      );
      context.quadraticCurveTo(
        0,
        shellHeight * (0.45 + inset * 0.12),
        -shellWidth,
        0,
      );
      context.closePath();
      context.fillStyle = rgba(color, jelly.life * (0.018 + energy * 0.04));
      context.strokeStyle = rgba(
        color,
        jelly.life * (0.13 + energy * 0.2) * (1 - inset * 0.28),
      );
      context.shadowColor = color;
      context.shadowBlur = 5 + frame.params.glow * 0.09;
      context.lineWidth = 0.55 + (voice?.attack ?? 0) * 1.4;
      context.fill();
      context.stroke();
    }

    const tendrilCount = qualityCount(
      frame,
      4 +
        Math.min(5, frame.params.symmetry) +
        Math.round(voice?.structuralLayer ?? 0),
      4,
    );
    for (let tendril = 0; tendril < tendrilCount; tendril += 1) {
      const position = tendril / Math.max(1, tendrilCount - 1) - 0.5;
      const rootX = position * width * 1.5;
      const length =
        size *
        (0.9 +
          Math.abs(position) * 0.35 +
          (voice?.development ?? 0) * 0.55 +
          (voice?.sustain ?? 0) * 0.4);
      const sway =
        Math.sin(frame.time * 0.0014 * motion + jelly.phase + tendril * 0.8) *
        size *
        (0.12 + profile.float * 0.07);
      context.beginPath();
      context.moveTo(rootX, height * 0.08);
      context.bezierCurveTo(
        rootX + sway,
        length * 0.32,
        rootX - sway * 0.7,
        length * 0.72,
        rootX + sway * 0.42 + profile.directionalPull * size * 0.16,
        length,
      );
      context.strokeStyle = rgba(
        noteColor(frame, jelly.note + tendril * 0.42),
        jelly.life * (0.09 + energy * 0.19),
      );
      context.shadowBlur = 4 + frame.params.glow * 0.06;
      context.lineWidth = 0.45 + velocityCurve(jelly.velocity) * 0.8;
      context.stroke();
    }
    context.restore();
  }

  private drawWaves(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
  ): void {
    for (const wave of this.waves) {
      const force = velocityCurve(wave.velocity);
      wave.radius += frame.delta * (0.04 + force * 0.12);
      wave.life -= frame.delta * 0.00085;
      const register = registerPosition(wave.note);
      const x = frame.width * (0.5 + pitchPosition(wave.note) * 0.27);
      const y = frame.height * (0.76 - register * 0.5);
      context.beginPath();
      context.ellipse(x, y, wave.radius, wave.radius * 0.42, 0, 0, Math.PI * 2);
      context.strokeStyle = rgba(
        noteColor(frame, wave.note),
        wave.life * (0.12 + force * 0.25),
      );
      context.lineWidth = 0.6 + force * 1.2;
      context.stroke();
    }
    this.waves = this.waves.filter((wave) => wave.life > 0);
  }

  private drawPlankton(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
  ): void {
    for (const mote of this.plankton) {
      mote.x += mote.vx * frame.delta;
      mote.y += mote.vy * frame.delta;
      mote.life -= frame.delta * (frame.music.sustain ? 0.00022 : 0.00048);
      drawSoftPoint(
        context,
        mote.x * frame.width,
        mote.y * frame.height,
        mote.size,
        noteColor(frame, mote.note),
        clamp(mote.life, 0, 1) * 0.48,
      );
    }
    this.plankton = limitParticles(this.plankton, frame, 0.52);
  }

  private syncVoices(frame: VisualFrame): void {
    for (const voice of frame.voices) {
      if (
        voice.phase === "release" ||
        this.jellies.some((jelly) => jelly.note === voice.note)
      )
        continue;
      this.jellies.push({
        note: voice.note,
        velocity: voice.velocity,
        x: 0.5 + pitchPosition(voice.note) * 0.27,
        y: 0.76 - registerPosition(voice.note) * 0.5,
        phase: voice.note * 0.37,
        life: 0.7,
      });
    }
    this.jellies = this.jellies.slice(-10);
  }

  reset(): void {
    this.jellies = [];
    this.plankton = [];
    this.waves = [];
  }

  getActiveCount(): number {
    return this.jellies.length + this.plankton.length + this.waves.length;
  }
}
