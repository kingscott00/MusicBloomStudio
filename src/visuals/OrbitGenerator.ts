import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, hashNoise, lerp } from "../utils/math";
import {
  drawSoftPoint,
  glowStroke,
  limitParticles,
  noteColor,
  qualityCount,
  type Spark,
} from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  registerPosition,
  velocityCurve,
  voiceComposition,
} from "./musicMapping";

interface Orbiter extends Spark {
  angle: number;
  radius: number;
  targetRadius: number;
  note: number;
  tilt: number;
  force: number;
}

interface GravityWave {
  note: number;
  velocity: number;
  life: number;
  radius: number;
}

export class OrbitGenerator implements VisualGenerator {
  readonly mode = "orbit" as const;
  private orbiters: Orbiter[] = [];
  private waves: GravityWave[] = [];
  private lastChord = "";
  private reconfiguration = 0;

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const force = velocityCurve(note.velocity);
    const register = registerPosition(note.note);
    this.waves.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      radius: 6,
    });
    this.waves = this.waves.slice(-10);

    const count = 2 + Math.round(force * 7);
    for (let index = 0; index < count; index += 1) {
      const seed = note.note * 13.17 + state.sequence * 7.31 + index * 9.7;
      const direction = hashNoise(seed, 2) > 0.5 ? 1 : -1;
      this.orbiters.push({
        x: 0,
        y: 0,
        vx: direction * (0.00035 + hashNoise(seed, 3) * 0.0012),
        vy: 0,
        life: 0.8 + hashNoise(seed, 4) * 0.55,
        maxLife: 1,
        size: 1.25 + force * 3.6 + hashNoise(seed, 5) * 1.6,
        hue: note.note / 12,
        seed,
        angle: hashNoise(seed, 6) * Math.PI * 2,
        radius: 24 + register * 120,
        targetRadius: 48 + register * 250,
        note: note.note,
        tilt: (hashNoise(seed, 7) - 0.5) * 0.72,
        force,
      });
    }
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const { width, height, time, delta, params, music } = frame;
    const latestNote = music.lastAttack?.note ?? 60;
    const composition = voiceComposition(frame.voices);
    const profile = harmonyProfile(music.chord.quality);
    const motionScale = params.reducedMotion ? 0.35 : 1;
    const centerX =
      width *
      (0.53 +
        (composition.count ? composition.pitch : pitchPosition(latestNote)) *
          0.055 +
        (params.autoMotion ? Math.sin(time * 0.000085) * 0.065 : 0));
    const centerY =
      height *
      (0.5 +
        (0.5 -
          (composition.count
            ? composition.register
            : registerPosition(latestNote))) *
          0.08 +
        (params.autoMotion ? Math.cos(time * 0.00011) * 0.035 : 0));
    const base = Math.min(width, height) * (0.085 + params.bloom / 1800);

    if (music.chord.label !== this.lastChord) {
      this.lastChord = music.chord.label;
      this.reconfiguration = 1;
    }
    this.reconfiguration *= Math.exp(-delta / 700);

    this.drawCore(
      context,
      frame,
      centerX,
      centerY,
      base,
      music.chord.root ?? latestNote,
    );
    this.drawOrbits(
      context,
      frame,
      centerX,
      centerY,
      base,
      profile,
      motionScale,
    );
    this.drawGravityWaves(context, frame, centerX, centerY);
    this.drawOrbiters(context, frame, centerX, centerY, base, motionScale);
  }

  private drawCore(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    x: number,
    y: number,
    base: number,
    note: number,
  ): void {
    const pulse =
      1 +
      frame.dynamics.attack * 0.28 +
      Math.sin(frame.time * 0.0011) * (0.025 + frame.dynamics.held * 0.025);
    const radius = base * pulse;
    const color = noteColor(frame, frame.music.chord.root ?? note);
    const core = context.createRadialGradient(x, y, 0, x, y, radius * 1.5);
    core.addColorStop(0, rgba(color, 0.42 + frame.dynamics.intensity * 0.34));
    core.addColorStop(0.16, rgba(color, 0.16));
    core.addColorStop(0.52, rgba(color, 0.038));
    core.addColorStop(1, rgba(color, 0));
    context.globalCompositeOperation = "lighter";
    context.fillStyle = core;
    context.fillRect(
      x - radius * 1.5,
      y - radius * 1.5,
      radius * 3,
      radius * 3,
    );
    drawSoftPoint(
      context,
      x,
      y,
      radius * 0.09,
      noteColor(frame, note, 0.11),
      0.75,
    );
  }

  private drawOrbits(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    cx: number,
    cy: number,
    base: number,
    profile: ReturnType<typeof harmonyProfile>,
    motionScale: number,
  ): void {
    const { time, params } = frame;
    const noteSources =
      frame.voices.length > 0
        ? frame.voices.filter((voice) => voice.energy > 0.035)
        : frame.music.recentNotes.slice(-3).map((event) => ({
            note: event.note,
            velocity: event.velocity,
            energy: 0.22,
          }));
    const ringCount = qualityCount(
      frame,
      clamp(
        3 +
          noteSources.length +
          profile.layerBonus +
          Math.round(frame.dynamics.held * 2),
        3,
        11,
      ),
      3,
    );

    context.save();
    context.translate(cx, cy);
    context.globalCompositeOperation = "lighter";
    for (let ring = ringCount - 1; ring >= 0; ring -= 1) {
      const source = noteSources[ring % Math.max(1, noteSources.length)];
      const note = source?.note ?? (frame.music.chord.root ?? 48) + ring * 2;
      const register = registerPosition(note);
      const radius =
        base *
        (1.05 + ring * 0.58 + register * 0.7) *
        (0.86 + profile.openness * 0.08 + profile.stretch * 0.08);
      const direction = ring % 2 === 0 ? 1 : -1;
      const tilt =
        0.26 +
        ((note % 12) / 12) * 0.5 +
        profile.float * 0.12 +
        profile.inward * 0.08 +
        Math.sin(ring * 3.1) * 0.05;
      const rotation =
        ring * 0.56 +
        time *
          0.000008 *
          params.rotation *
          direction *
          motionScale *
          (1 + frame.dynamics.rhythm * 0.7) +
        this.reconfiguration * direction * 0.28 +
        profile.directionalPull * Math.sin(time * 0.00038 + ring) * 0.24;
      const wobble =
        1 +
        Math.sin(time * 0.0008 + ring * 1.6) *
          (0.014 + profile.warp * 0.055 + profile.instability * 0.04);
      const color = noteColor(frame, note, ring * 0.027);
      const alpha =
        0.11 +
        frame.dynamics.held * 0.11 +
        frame.dynamics.attack * 0.12 +
        (source ? velocityCurve(source.velocity) * 0.1 : 0) +
        (source && "energy" in source ? source.energy * 0.08 : 0);

      context.save();
      context.rotate(rotation);
      context.scale(1, tilt);
      context.beginPath();
      if (profile.warp > 0.42 || profile.crystalline > 0.7) {
        const segments = Math.max(32, Math.round(60 * frame.qualityScale));
        for (let step = 0; step <= segments; step += 1) {
          const angle = (step / segments) * Math.PI * 2;
          const deformation =
            1 +
            Math.sin(angle * (3 + (ring % 3)) + time * 0.0013) *
              profile.warp *
              0.045 +
            Math.cos(angle * 3) * profile.crystalline * 0.035;
          const px = Math.cos(angle) * radius * deformation * wobble;
          const py = Math.sin(angle) * radius;
          if (step === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
      } else {
        context.ellipse(0, 0, radius * wobble, radius, 0, 0, Math.PI * 2);
      }
      glowStroke(
        context,
        color,
        5 + params.glow * 0.1,
        alpha * (ring === 0 ? 1.25 : 1),
      );
      context.lineWidth =
        0.65 + (ring % 3 === 0 ? 0.55 : 0) + frame.dynamics.velocity * 0.55;
      context.stroke();

      const moonAngle =
        time * 0.00016 * (12 + params.speed) * direction * motionScale +
        ring * 2.07;
      const moonX = Math.cos(moonAngle) * radius;
      const moonY = Math.sin(moonAngle) * radius;
      drawSoftPoint(
        context,
        moonX,
        moonY,
        1.8 +
          (source ? velocityCurve(source.velocity) * 3.3 : 1) +
          frame.dynamics.attack * 2,
        color,
        0.3 + alpha,
      );
      context.restore();
    }
    context.restore();
  }

  private drawGravityWaves(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    cx: number,
    cy: number,
  ): void {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const wave of this.waves) {
      const force = velocityCurve(wave.velocity);
      wave.radius +=
        frame.delta *
        (0.08 + force * 0.22) *
        (frame.params.reducedMotion ? 0.45 : 1);
      wave.life -= frame.delta * (frame.music.sustain ? 0.00032 : 0.00062);
      const offsetX = pitchPosition(wave.note) * frame.width * 0.055;
      const offsetY = (0.5 - registerPosition(wave.note)) * frame.height * 0.08;
      context.beginPath();
      context.ellipse(
        cx + offsetX,
        cy + offsetY,
        wave.radius,
        wave.radius * (0.46 + registerPosition(wave.note) * 0.22),
        wave.note * 0.17,
        0,
        Math.PI * 2,
      );
      glowStroke(
        context,
        noteColor(frame, wave.note),
        9 + frame.params.glow * 0.12,
        wave.life * (0.2 + force * 0.38),
      );
      context.lineWidth = 0.8 + force * 2;
      context.stroke();
    }
    context.restore();
    this.waves = this.waves.filter((wave) => wave.life > 0);
  }

  private drawOrbiters(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    cx: number,
    cy: number,
    base: number,
    motionScale: number,
  ): void {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const orbiter of this.orbiters) {
      const voice = frame.voices.find(
        (candidate) => candidate.note === orbiter.note,
      );
      orbiter.targetRadius =
        base * (1.1 + registerPosition(orbiter.note) * 4.7);
      orbiter.radius = lerp(
        orbiter.radius,
        orbiter.targetRadius,
        1 - Math.exp(-frame.delta * 0.004),
      );
      orbiter.angle +=
        orbiter.vx *
        frame.delta *
        (0.6 + frame.params.speed / 45) *
        motionScale *
        (1 + frame.dynamics.rhythm * 0.8);
      orbiter.life -=
        frame.delta *
        (voice?.phase === "sustain"
          ? 0.000035
          : voice?.phase === "release"
            ? 0.00016 * (1.15 - voice.release)
            : voice
              ? 0.000045
              : 0.0003);
      if (voice && voice.phase !== "release")
        orbiter.life = Math.min(1.25, orbiter.life + voice.energy * 0.004);
      const eccentricity = 0.38 + Math.abs(orbiter.tilt);
      const x = cx + Math.cos(orbiter.angle) * orbiter.radius;
      const y =
        cy +
        Math.sin(orbiter.angle) *
          orbiter.radius *
          eccentricity *
          (0.88 + Math.sin(orbiter.seed) * 0.12);
      const color = noteColor(frame, orbiter.note);
      drawSoftPoint(
        context,
        x,
        y,
        orbiter.size * (0.7 + orbiter.force * 0.45),
        color,
        clamp(orbiter.life, 0, 1) * (0.48 + orbiter.force * 0.36),
      );
      const trailAngle = orbiter.angle - orbiter.vx * 85;
      context.beginPath();
      context.moveTo(
        cx + Math.cos(trailAngle) * orbiter.radius,
        cy + Math.sin(trailAngle) * orbiter.radius * eccentricity,
      );
      context.lineTo(x, y);
      context.strokeStyle = rgba(
        color,
        clamp(orbiter.life, 0, 1) * (0.08 + orbiter.force * 0.16),
      );
      context.lineWidth = 0.5 + orbiter.force;
      context.stroke();
    }
    context.restore();
    this.orbiters = limitParticles(this.orbiters, frame, 0.72);
  }

  reset(): void {
    this.orbiters = [];
    this.waves = [];
    this.reconfiguration = 0;
  }

  getActiveCount(): number {
    return this.orbiters.length + this.waves.length;
  }
}
