import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, hashNoise, lerp } from "../utils/math";
import { glowStroke, noteColor, qualityCount } from "./helpers";
import {
  harmonyProfile,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

interface RibbonPoint {
  x: number;
  y: number;
  energy: number;
}

interface Ribbon {
  note: number;
  velocity: number;
  life: number;
  phase: number;
  headX: number;
  headY: number;
  direction: number;
  points: RibbonPoint[];
  idle: boolean;
}

interface RibbonPulse {
  note: number;
  velocity: number;
  life: number;
  progress: number;
}

export class RibbonsGenerator implements VisualGenerator {
  readonly mode = "ribbons" as const;
  private ribbons: Ribbon[] = [];
  private pulses: RibbonPulse[] = [];

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const existing = this.ribbons.find(
      (ribbon) => ribbon.note === note.note && !ribbon.idle,
    );
    if (existing) {
      existing.life = 1;
      existing.velocity = note.velocity;
      existing.direction = Math.sign(state.lastInterval || existing.direction);
    } else {
      this.ribbons.push({
        note: note.note,
        velocity: note.velocity,
        life: 1,
        phase: note.note * 0.47 + state.sequence * 1.17,
        headX: 0.12 + ((note.note % 12) / 12) * 0.5,
        headY: 0.81 - registerPosition(note.note) * 0.63,
        direction: Math.sign(state.lastInterval || 1),
        points: [],
        idle: false,
      });
      this.ribbons = this.ribbons.slice(-12);
    }
    this.pulses.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      progress: 0,
    });
    this.pulses = this.pulses.slice(-12);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    this.syncHeldVoices(frame);
    if (!this.ribbons.length) this.addIdleRibbon();
    const { width, height, time, delta, params, music, dynamics } = frame;
    const profile = harmonyProfile(music.chord.quality);
    const motionScale = params.reducedMotion ? 0.36 : 1;
    const maxPoints = qualityCount(
      frame,
      Math.round(36 + params.trails * 1.25),
      32,
    );

    context.save();
    context.globalCompositeOperation = "lighter";
    for (let index = 0; index < this.ribbons.length; index += 1) {
      const ribbon = this.ribbons[index];
      const force = velocityCurve(ribbon.velocity);
      const register = registerPosition(ribbon.note);
      const voice = frame.voices.find(
        (candidate) => candidate.note === ribbon.note,
      );
      const held = voice?.phase === "attack" || voice?.phase === "held";
      const sustained = voice?.phase === "sustain";
      const voiceEnergy = voice?.energy ?? 0;
      const speed =
        (0.000018 + params.speed * 0.0000012) *
        (0.62 + force * 0.64) *
        motionScale *
        (1 + dynamics.rhythm * 0.75);
      ribbon.headX += delta * speed;
      if (ribbon.headX > 1.12) {
        ribbon.headX = -0.1;
        ribbon.points = [];
        ribbon.phase += 1.7;
      }

      const melodicLift =
        clamp(music.lastInterval / 24, -0.45, 0.45) *
        (0.08 + dynamics.attack * 0.07);
      const registerY = 0.81 - register * 0.63;
      const harmonicWave =
        Math.sin(
          ribbon.headX *
            Math.PI *
            (2.1 + profile.crystalline * 0.8 + profile.directionalPull * 0.35) +
            time * 0.00042 * (8 + params.speed) +
            ribbon.phase,
        ) *
        (0.035 +
          profile.float * 0.045 +
          profile.curvature * 0.03 +
          dynamics.held * 0.018);
      const slowCurrent =
        Math.sin(time * 0.00013 + ribbon.phase * 0.7) *
        (params.autoMotion ? 0.055 : 0.015);
      const targetY =
        registerY + harmonicWave + slowCurrent - melodicLift * ribbon.direction;
      ribbon.headY = lerp(
        ribbon.headY,
        targetY,
        1 - Math.exp(-delta * (0.004 + params.responsiveness * 0.00006)),
      );
      ribbon.points.push({
        x: ribbon.headX * width,
        y: ribbon.headY * height,
        energy:
          clamp(
            0.18 + force * 0.42 + dynamics.attack * 0.35 + dynamics.held * 0.24,
            0,
            1,
          ) *
          clamp(
            0.38 +
              voiceEnergy * 0.62 +
              Math.min(0.16, (voice?.heldDuration ?? 0) / 12000),
            0,
            1,
          ),
      });
      if (ribbon.points.length > maxPoints)
        ribbon.points.splice(0, ribbon.points.length - maxPoints);
      ribbon.life -=
        delta *
        (sustained || music.sustain
          ? 0.000025
          : voice?.phase === "release"
            ? 0.000075 * (1.2 - voice.release)
            : ribbon.idle
              ? 0.000002
              : 0.00013);
      if (held || sustained)
        ribbon.life = Math.min(1, ribbon.life + 0.012 + voiceEnergy * 0.012);

      if (ribbon.points.length < 4) continue;
      this.drawRibbon(context, frame, ribbon, index, profile);
    }
    this.drawPulses(context, frame);
    context.restore();

    this.ribbons = this.ribbons.filter(
      (ribbon) => ribbon.life > 0 || ribbon.idle,
    );
    if (
      this.ribbons.every((ribbon) => !ribbon.idle) &&
      music.notes.length === 0
    )
      this.addIdleRibbon();
  }

  private syncHeldVoices(frame: VisualFrame): void {
    for (const voice of frame.voices) {
      if (
        voice.phase === "release" ||
        this.ribbons.some(
          (ribbon) => ribbon.note === voice.note && !ribbon.idle,
        )
      )
        continue;
      const root =
        frame.music.chord.root ?? frame.music.notes[0]?.note ?? voice.note;
      const interval = (voice.note - root + 120) % 12;
      this.ribbons.push({
        note: voice.note,
        velocity: voice.velocity,
        life: Math.max(0.5, voice.energy),
        phase:
          voice.note * 0.47 +
          frame.music.sequence * 1.17 +
          voice.heldDuration * 0.0002,
        headX: 0.12 + (interval / 12) * 0.5 + hashNoise(voice.note, 11) * 0.06,
        headY: 0.81 - registerPosition(voice.note) * 0.63,
        direction: Math.sign(frame.music.lastInterval || 1),
        points: [],
        idle: false,
      });
    }
    this.ribbons = this.ribbons.slice(-12);
  }

  private drawRibbon(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    ribbon: Ribbon,
    index: number,
    profile: ReturnType<typeof harmonyProfile>,
  ): void {
    const force = velocityCurve(ribbon.velocity);
    const color = noteColor(frame, ribbon.note, index * 0.035);
    const life = clamp(ribbon.life, 0, 1);
    const strandCount = qualityCount(
      frame,
      2 + Math.min(3, frame.music.notes.length) + profile.layerBonus,
      2,
    );

    for (let strand = strandCount; strand >= 0; strand -= 1) {
      const centered = strand - strandCount / 2;
      const separation =
        centered * (3.5 + frame.params.bloom * 0.045 + profile.float * 2.5);
      const broad = strand === strandCount;
      context.beginPath();
      for (
        let pointIndex = 0;
        pointIndex < ribbon.points.length;
        pointIndex += 1
      ) {
        const point = ribbon.points[pointIndex];
        const progress = pointIndex / Math.max(1, ribbon.points.length - 1);
        const age = 1 - progress;
        const curl =
          Math.sin(
            pointIndex * 0.17 +
              ribbon.phase +
              strand * 0.8 +
              frame.time * 0.001,
          ) *
          (2.2 +
            profile.warp * 6 +
            profile.instability * 5 +
            frame.dynamics.rhythm * 4);
        const x =
          point.x +
          curl * centered * 0.22 +
          Math.sin(progress * Math.PI) *
            frame.music.lastInterval *
            (0.28 + strand * 0.05);
        const y =
          point.y +
          separation * Math.sin(progress * Math.PI) +
          curl +
          profile.inward * age * age * 8 +
          profile.directionalPull * progress * progress * 12;
        if (pointIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      const alpha =
        life * (ribbon.idle ? 0.055 : broad ? 0.055 : 0.14 + force * 0.14);
      glowStroke(
        context,
        color,
        broad ? 13 + frame.params.glow * 0.15 : 4 + frame.params.glow * 0.085,
        alpha,
      );
      context.lineWidth = broad
        ? 6 + force * 5
        : 0.7 + force * 1.8 + (strand === 0 ? 0.5 : 0);
      context.stroke();
    }

    const pointSkip = Math.max(3, Math.round(8 - frame.qualityScale * 4));
    for (
      let pointIndex = pointSkip;
      pointIndex < ribbon.points.length;
      pointIndex += pointSkip
    ) {
      const point = ribbon.points[pointIndex];
      const alpha =
        life *
        point.energy *
        (0.08 + frame.dynamics.rhythm * 0.1) *
        (pointIndex / ribbon.points.length);
      context.fillStyle = rgba(color, alpha);
      context.beginPath();
      context.arc(point.x, point.y, 0.6 + force * 0.9, 0, Math.PI * 2);
      context.fill();
    }
  }

  private drawPulses(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
  ): void {
    for (const pulse of this.pulses) {
      const force = velocityCurve(pulse.velocity);
      pulse.progress +=
        frame.delta *
        (0.00034 + force * 0.00042) *
        (frame.params.reducedMotion ? 0.52 : 1);
      pulse.life -= frame.delta * 0.00085;
      const register = registerPosition(pulse.note);
      const x = pulse.progress * frame.width;
      const y =
        frame.height *
        (0.81 -
          register * 0.63 +
          Math.sin(pulse.progress * Math.PI * 4 + pulse.note) * 0.035);
      const color = noteColor(frame, pulse.note);
      context.beginPath();
      context.arc(x, y, 4 + force * 12, 0, Math.PI * 2);
      context.fillStyle = rgba(color, pulse.life * (0.12 + force * 0.22));
      context.shadowColor = color;
      context.shadowBlur = 12 + frame.params.glow * 0.15;
      context.fill();
    }
    this.pulses = this.pulses.filter(
      (pulse) => pulse.life > 0 && pulse.progress < 1.2,
    );
  }

  private addIdleRibbon(): void {
    const seed = 71.3;
    this.ribbons.push({
      note: 57,
      velocity: 24,
      life: 1,
      phase: hashNoise(seed, 2) * Math.PI * 2,
      headX: 0.12,
      headY: 0.54,
      direction: 1,
      points: [],
      idle: true,
    });
  }

  reset(): void {
    this.ribbons = [];
    this.pulses = [];
  }

  getActiveCount(): number {
    return (
      this.pulses.length +
      this.ribbons.reduce((sum, ribbon) => sum + ribbon.points.length, 0)
    );
  }
}
