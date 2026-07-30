import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
  VisualNoteVoice,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, hashNoise, lerp } from "../utils/math";
import { drawSoftPoint, noteColor, qualityCount } from "./helpers";
import {
  harmonyProfile,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

interface Star {
  note: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  strength: number;
  pulse: number;
  seed: number;
  repetitions: number;
  idle: boolean;
}

interface StarPulse {
  note: number;
  x: number;
  y: number;
  life: number;
  radius: number;
  velocity: number;
}

interface PositionedStar {
  star: Star;
  voice?: VisualNoteVoice;
  x: number;
  y: number;
}

export class ConstellationGenerator implements VisualGenerator {
  readonly mode = "constellation" as const;
  private stars: Star[] = [];
  private pulses: StarPulse[] = [];
  private lastChord = "";
  private reorganize = 0;
  private idleSeeded = false;

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const existing = this.stars.find(
      (star) => star.note === note.note && !star.idle,
    );
    if (existing) {
      existing.strength = Math.min(
        2.2,
        existing.strength + 0.34 + note.velocity / 180,
      );
      existing.pulse = 1;
      existing.repetitions += 1;
      this.pulses.push({
        note: note.note,
        x: existing.x,
        y: existing.y,
        life: 1,
        radius: 4,
        velocity: note.velocity,
      });
      return;
    }

    const seed = note.note * 17.13 + state.sequence * 23.71;
    const target = this.positionFor(note.note, seed);
    const star: Star = {
      note: note.note,
      x: target.x,
      y: target.y,
      targetX: target.x,
      targetY: target.y,
      strength: 0.62 + velocityCurve(note.velocity) * 0.92,
      pulse: 1,
      seed,
      repetitions: 1,
      idle: false,
    };
    this.stars.push(star);
    this.stars = this.stars.slice(-42);
    this.pulses.push({
      note: note.note,
      x: star.x,
      y: star.y,
      life: 1,
      radius: 3,
      velocity: note.velocity,
    });
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    if (!this.idleSeeded) {
      this.seedIdleStars();
      this.idleSeeded = true;
    }
    this.syncHeldVoices(frame);
    if (frame.music.chord.label !== this.lastChord) {
      this.lastChord = frame.music.chord.label;
      this.reorganize = 1;
      this.retargetStars(frame);
    }
    this.reorganize *= Math.exp(-frame.delta / 850);

    const profile = harmonyProfile(frame.music.chord.quality);
    const motionScale = frame.params.reducedMotion ? 0.3 : 1;
    const driftX = frame.params.autoMotion
      ? Math.sin(frame.time * 0.000075) * frame.width * 0.035
      : 0;
    const driftY = frame.params.autoMotion
      ? Math.cos(frame.time * 0.000093) * frame.height * 0.028
      : 0;

    const voicesByNote = new Map<number, VisualNoteVoice>();
    for (const voice of frame.voices) voicesByNote.set(voice.note, voice);
    const positions: PositionedStar[] = this.stars.map((star) => {
      const settle =
        1 -
        Math.exp(
          -frame.delta *
            (0.0018 +
              frame.params.responsiveness * 0.000025 +
              this.reorganize * 0.004),
        );
      star.x = lerp(star.x, star.targetX, settle);
      star.y = lerp(star.y, star.targetY, settle);
      const voice = voicesByNote.get(star.note);
      if (!star.idle && voice) {
        if (voice.phase === "release") {
          star.strength = lerp(
            star.strength,
            0.08 + voice.release * 0.72,
            1 - Math.exp(-frame.delta * 0.003),
          );
        } else {
          const depth = Math.min(0.36, voice.heldDuration / 7000);
          star.strength = lerp(
            star.strength,
            0.5 + voice.energy * 0.85 + depth,
            1 - Math.exp(-frame.delta * 0.002),
          );
        }
      }
      const parallax = 0.6 + registerPosition(star.note) * 0.7;
      const releaseDrift =
        (voice?.releaseProgress ?? 0) *
        (0.018 + (voice?.releaseDepth ?? 0) * 0.055);
      const releaseAngle = star.seed * 0.37;
      return {
        star,
        voice,
        x:
          star.x * frame.width +
          driftX * parallax +
          Math.sin(frame.time * 0.00015 * motionScale + star.seed) *
            (2 + profile.float * 7) +
          Math.cos(releaseAngle) * frame.width * releaseDrift,
        y:
          star.y * frame.height +
          driftY * parallax +
          Math.cos(frame.time * 0.00012 * motionScale + star.seed) *
            (2 + profile.float * 5) +
          Math.sin(releaseAngle) * frame.height * releaseDrift,
      };
    });

    context.save();
    context.globalCompositeOperation = "lighter";
    this.drawConnections(context, frame, positions, profile);
    this.drawStars(context, frame, positions, profile);
    this.drawPulses(context, frame);
    context.restore();
  }

  private syncHeldVoices(frame: VisualFrame): void {
    for (const voice of frame.voices) {
      if (
        voice.phase === "release" ||
        this.stars.some((star) => star.note === voice.note && !star.idle)
      )
        continue;
      const seed = voice.note * 17.13 + voice.heldDuration * 0.001;
      const target = this.positionFor(voice.note, seed);
      this.stars.push({
        note: voice.note,
        x: target.x,
        y: target.y,
        targetX: target.x,
        targetY: target.y,
        strength: 0.5 + voice.energy * 0.9,
        pulse: 0,
        seed,
        repetitions: 1,
        idle: false,
      });
    }
    this.stars = this.stars.slice(-42);
  }

  private drawConnections(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    positions: PositionedStar[],
    profile: ReturnType<typeof harmonyProfile>,
  ): void {
    const maxStars = Math.min(
      positions.length,
      qualityCount(frame, positions.length, Math.min(8, positions.length)),
    );
    const maxDistance =
      Math.min(frame.width, frame.height) *
      (0.16 +
        frame.params.density / 680 +
        profile.openness * 0.035 -
        profile.inward * 0.018);
    for (let i = 0; i < maxStars; i += 1) {
      for (let j = i + 1; j < maxStars; j += 1) {
        const a = positions[i];
        const b = positions[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > maxDistance * maxDistance) continue;
        const interval = Math.abs(a.star.note - b.star.note) % 12;
        const consonant = [0, 3, 4, 5, 7, 8, 9].includes(interval);
        if (!consonant && frame.music.notes.length > 1 && profile.warp < 0.5)
          continue;
        const distance = Math.sqrt(distanceSquared);
        const strength =
          (1 - distance / maxDistance) *
          Math.min(a.star.strength, b.star.strength);
        const pulseBoost =
          Math.max(a.star.pulse, b.star.pulse) * 0.16 +
          frame.dynamics.attack * 0.1;
        const alpha =
          strength *
          (0.055 +
            frame.dynamics.held * 0.065 +
            pulseBoost +
            (consonant ? 0.025 : 0));
        const curve =
          Math.sin(frame.time * 0.00032 + a.star.seed * 0.1 + b.star.seed) *
            (3 + profile.warp * 26 + profile.curvature * 10) +
          profile.directionalPull * distance * 0.12;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.quadraticCurveTo(
          (a.x + b.x) / 2 - dy * 0.05 + curve,
          (a.y + b.y) / 2 + dx * 0.05 - curve,
          b.x,
          b.y,
        );
        context.strokeStyle = rgba(
          noteColor(frame, a.star.note, interval / 48),
          alpha,
        );
        context.lineWidth =
          0.45 +
          strength * 0.65 +
          (a.star.repetitions + b.star.repetitions) * 0.035;
        context.stroke();
      }
    }
  }

  private drawStars(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    positions: PositionedStar[],
    profile: ReturnType<typeof harmonyProfile>,
  ): void {
    for (const { star, voice, x, y } of positions) {
      star.pulse *= Math.exp(-frame.delta / 300);
      if (!star.idle && !voice) star.strength *= Math.exp(-frame.delta / 1200);
      const force = clamp(star.strength, 0.08, 2);
      const twinkle =
        0.86 +
        Math.sin(frame.time * 0.0021 + star.seed) *
          (0.09 + profile.crystalline * 0.07);
      const radius =
        (1.4 +
          force * 2.7 +
          star.pulse * (4 + star.repetitions * 0.55) +
          frame.dynamics.attack * 1.5 +
          (voice?.development ?? 0) * 2.2 +
          (voice?.structuralLayer ?? 0) * 2.8) *
        (1 - (voice?.releaseProgress ?? 0) * 0.48) *
        twinkle;
      const color = noteColor(frame, star.note);
      drawSoftPoint(
        context,
        x,
        y,
        radius,
        color,
        clamp(
          (star.idle ? 0.16 : 0.36) + force * 0.18 + star.pulse * 0.25,
          0.08,
          0.92,
        ),
      );

      const rayLength =
        radius *
        (1.5 +
          profile.crystalline * 1.2 +
          Math.min(3, star.repetitions) * 0.12);
      context.beginPath();
      context.moveTo(x - rayLength, y);
      context.lineTo(x + rayLength, y);
      context.moveTo(x, y - rayLength);
      context.lineTo(x, y + rayLength);
      context.strokeStyle = rgba(
        color,
        (star.idle ? 0.05 : 0.11) + star.pulse * 0.14,
      );
      context.lineWidth = 0.45;
      context.stroke();

      if (star.repetitions > 1 && !star.idle) {
        context.beginPath();
        context.arc(
          x,
          y,
          radius * (1.8 + (star.repetitions % 4) * 0.35),
          0,
          Math.PI * 2,
        );
        context.strokeStyle = rgba(color, 0.055 + star.pulse * 0.12);
        context.lineWidth = 0.55;
        context.stroke();
      }
      if ((voice?.development ?? 0) > 0.08 && !star.idle) {
        const orbitCount = (voice?.structuralLayer ?? 0) > 0.45 ? 2 : 1;
        for (let orbit = 0; orbit < orbitCount; orbit += 1) {
          context.save();
          context.translate(x, y);
          context.rotate(
            star.seed +
              orbit * 1.4 +
              frame.time * 0.00018 * (orbit % 2 ? -1 : 1),
          );
          context.scale(1, 0.42 + orbit * 0.16);
          context.beginPath();
          context.arc(
            0,
            0,
            radius * (2.2 + orbit * 0.85 + (voice?.development ?? 0) * 0.7),
            0,
            Math.PI * 2,
          );
          context.strokeStyle = rgba(
            color,
            (voice?.development ?? 0) *
              (0.09 + (voice?.structuralLayer ?? 0) * 0.07),
          );
          context.lineWidth = 0.5;
          context.stroke();
          context.restore();
        }
      }
    }
  }

  private drawPulses(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
  ): void {
    for (const pulse of this.pulses) {
      const force = velocityCurve(pulse.velocity);
      pulse.radius += frame.delta * (0.04 + force * 0.14);
      pulse.life -= frame.delta * 0.0013;
      const x = pulse.x * frame.width;
      const y = pulse.y * frame.height;
      context.beginPath();
      context.arc(x, y, pulse.radius, 0, Math.PI * 2);
      context.strokeStyle = rgba(
        noteColor(frame, pulse.note),
        pulse.life * (0.14 + force * 0.34),
      );
      context.shadowColor = noteColor(frame, pulse.note);
      context.shadowBlur = 6 + frame.params.glow * 0.1;
      context.lineWidth = 0.7 + force * 1.7;
      context.stroke();
    }
    this.pulses = this.pulses.filter((pulse) => pulse.life > 0);
  }

  private retargetStars(frame: VisualFrame): void {
    const root = frame.music.chord.root ?? 0;
    const profile = harmonyProfile(frame.music.chord.quality);
    const inversionTurn = (frame.music.chord.inversion ?? 0) * 0.14;
    for (const star of this.stars) {
      const shift = ((star.note - root + 12) % 12) / 12;
      const base = this.positionFor(
        star.note,
        star.seed + root * 11.3 + frame.music.sequence,
      );
      const angle = shift * Math.PI * 2 + inversionTurn;
      const spread = 0.045 + profile.openness * 0.045 + profile.stretch * 0.025;
      const instability =
        Math.sin(star.note * 4.7 + frame.music.sequence) *
        profile.instability *
        0.055;
      star.targetX = clamp(
        0.5 +
          (base.x - 0.5) * (0.72 + profile.stretch * 0.34) +
          Math.sin(angle) * spread +
          instability +
          profile.directionalPull * shift * 0.04,
        0.08,
        0.92,
      );
      star.targetY = clamp(
        0.5 +
          (base.y - 0.5) * (0.7 + profile.openness * 0.22) +
          Math.cos(angle) * spread * (0.72 + profile.inward * 0.3) +
          Math.sin(angle * 2) * profile.curvature * 0.035 -
          profile.float * 0.025,
        0.08,
        0.92,
      );
    }
  }

  private positionFor(note: number, seed: number): { x: number; y: number } {
    const register = registerPosition(note);
    const pitchAngle = ((note % 12) / 12) * Math.PI * 2;
    return {
      x: clamp(
        0.5 +
          Math.cos(pitchAngle) * (0.16 + register * 0.18) +
          (hashNoise(seed, 2) - 0.5) * 0.17,
        0.08,
        0.92,
      ),
      y: clamp(
        0.79 -
          register * 0.58 +
          Math.sin(pitchAngle) * 0.09 +
          (hashNoise(seed, 3) - 0.5) * 0.14,
        0.08,
        0.92,
      ),
    };
  }

  private seedIdleStars(): void {
    for (let index = 0; index < 11; index += 1) {
      const note = 45 + index * 2;
      const seed = index * 19.17 + 3.1;
      const position = this.positionFor(note, seed);
      this.stars.push({
        note,
        x: position.x,
        y: position.y,
        targetX: position.x,
        targetY: position.y,
        strength: 0.12 + hashNoise(seed, 5) * 0.08,
        pulse: 0,
        seed,
        repetitions: 0,
        idle: true,
      });
    }
  }

  reset(): void {
    this.stars = [];
    this.pulses = [];
    this.reorganize = 0;
    this.idleSeeded = false;
  }

  getActiveCount(): number {
    return this.stars.length + this.pulses.length;
  }
}
