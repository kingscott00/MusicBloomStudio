import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, hashNoise } from "../utils/math";
import {
  drawSoftPoint,
  glowStroke,
  limitParticles,
  noteColor,
  organicWave,
  qualityCount,
  type Spark,
} from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

interface BloomImpulse {
  note: number;
  velocity: number;
  life: number;
  expansion: number;
  phase: number;
}

interface BloomMote extends Spark {
  angle: number;
  radius: number;
  radialSpeed: number;
  spin: number;
  note: number;
  depth: number;
}

export class BloomGenerator implements VisualGenerator {
  readonly mode = "bloom" as const;
  private impulses: BloomImpulse[] = [];
  private motes: BloomMote[] = [];
  private pulse = 0;
  private organismPhase = 0;

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const force = velocityCurve(note.velocity);
    this.impulses.push({
      note: note.note,
      velocity: note.velocity,
      life: 1,
      expansion: 0,
      phase: note.note * 0.319 + state.sequence * 0.73,
    });
    this.impulses = this.impulses.slice(-12);
    this.pulse = Math.max(this.pulse, 0.32 + force * 0.9);

    const count = 7 + Math.round(force * 15);
    for (let i = 0; i < count; i += 1) {
      const seed = note.note * 11.7 + state.sequence * 17.3 + i * 4.91;
      const angle = (i / count) * Math.PI * 2 + hashNoise(seed, 1) * 0.8;
      this.motes.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0.82 + hashNoise(seed, 2) * 0.4,
        maxLife: 1,
        size: 1.1 + force * 3.2 + hashNoise(seed, 3) * 1.4,
        hue: note.note / 12,
        seed,
        angle,
        radius: 8 + hashNoise(seed, 4) * 22,
        radialSpeed: 0.035 + force * 0.12 + hashNoise(seed, 5) * 0.08,
        spin: (hashNoise(seed, 6) - 0.5) * 0.0035,
        note: note.note,
        depth: 0.55 + hashNoise(seed, 7) * 0.7,
      });
    }
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    const { width, height, time, delta, music, params, dynamics } = frame;
    const latestNote = music.lastAttack?.note ?? music.notes[0]?.note ?? 60;
    const register = registerPosition(latestNote);
    const profile = harmonyProfile(music.chord.quality);
    const motionScale = params.reducedMotion ? 0.34 : 1;
    const autoDrift = params.autoMotion ? 1 : 0.18;
    const pitchDrift = pitchPosition(latestNote);
    const cx =
      width *
      (0.5 +
        pitchDrift * 0.075 +
        Math.sin(time * 0.00011) * 0.055 * autoDrift +
        Math.sin(time * 0.000037 + 2.1) * 0.025 * autoDrift);
    const cy =
      height *
      (0.53 -
        (register - 0.5) * 0.2 +
        Math.cos(time * 0.00009) * 0.03 * autoDrift);

    this.pulse *= Math.exp(-delta / 330);
    this.organismPhase +=
      delta *
      (0.00012 + params.speed * 0.0000022) *
      motionScale *
      (1 + dynamics.rhythm * 0.55);
    const breath =
      1 +
      Math.sin(this.organismPhase * Math.PI * 2) *
        (0.035 + dynamics.held * 0.045 + dynamics.sustain * 0.025);
    const registerScale = 1.18 - register * 0.22;
    const baseRadius =
      Math.min(width, height) *
      (0.115 + params.bloom / 820) *
      registerScale *
      breath *
      (1 + this.pulse * 0.2);
    const intensity = Math.max(0.16 + params.idle / 440, dynamics.intensity);

    this.drawAura(context, frame, cx, cy, baseRadius, latestNote, intensity);

    context.save();
    context.translate(cx, cy);
    context.rotate(
      time * 0.000006 * params.rotation * motionScale +
        Math.sin(time * 0.00031) * profile.float * 0.06,
    );
    context.globalCompositeOperation = "screen";

    const desiredLayers = clamp(
      4 +
        Math.min(4, music.notes.length) +
        profile.layerBonus +
        Math.round(dynamics.held * 2),
      4,
      10,
    );
    const layers = qualityCount(frame, desiredLayers, 4);
    const petals = Math.max(
      3,
      Math.round(
        (params.symmetry + Math.min(3, music.notes.length)) *
          (0.84 + frame.qualityScale * 0.16),
      ),
    );

    for (let layer = layers - 1; layer >= 0; layer -= 1) {
      const depth = layer / Math.max(1, layers - 1);
      const layerRadius =
        baseRadius * (0.32 + depth * 0.77) * (0.86 + profile.openness * 0.16);
      const layerRotation =
        layer * 0.27 +
        Math.sin(time * 0.00018 + layer * 1.4) *
          (0.035 + profile.float * 0.035);
      const color = noteColor(
        frame,
        (music.chord.root ?? latestNote) + layer * 1.37,
        depth * 0.08,
      );
      const alpha =
        (0.1 + intensity * 0.22) *
        (0.55 + (1 - depth) * 0.45) *
        (0.74 + dynamics.velocity * 0.34);
      this.drawPetalLayer(
        context,
        frame,
        petals,
        layerRadius,
        layerRotation,
        layer,
        color,
        alpha,
        profile,
      );
    }

    this.drawFilaments(
      context,
      frame,
      baseRadius,
      petals,
      latestNote,
      intensity,
    );
    this.drawHarmonyHalos(
      context,
      frame,
      baseRadius,
      latestNote,
      profile.layerBonus,
    );
    context.restore();

    this.drawAttacks(context, frame, cx, cy);
    this.drawMotes(context, frame, cx, cy);
  }

  private drawAura(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    cx: number,
    cy: number,
    radius: number,
    note: number,
    intensity: number,
  ): void {
    const color = noteColor(frame, note);
    const aura = context.createRadialGradient(
      cx,
      cy,
      radius * 0.03,
      cx,
      cy,
      radius * 1.42,
    );
    aura.addColorStop(0, rgba(color, 0.07 + intensity * 0.1));
    aura.addColorStop(0.26, rgba(color, 0.025 + intensity * 0.032));
    aura.addColorStop(0.72, rgba(color, 0.012));
    aura.addColorStop(1, rgba(color, 0));
    context.globalCompositeOperation = "screen";
    context.fillStyle = aura;
    context.fillRect(
      cx - radius * 1.45,
      cy - radius * 1.45,
      radius * 2.9,
      radius * 2.9,
    );

    drawSoftPoint(
      context,
      cx,
      cy,
      radius * (0.045 + frame.dynamics.attack * 0.035),
      noteColor(frame, note, 0.08),
      0.24 + intensity * 0.22,
    );
  }

  private drawPetalLayer(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    petalCount: number,
    radius: number,
    rotation: number,
    layer: number,
    color: string,
    alpha: number,
    profile: ReturnType<typeof harmonyProfile>,
  ): void {
    const { time, dynamics, params } = frame;
    const inward = 1 - profile.inward * 0.16;
    for (let petal = 0; petal < petalCount; petal += 1) {
      const baseAngle =
        (petal / petalCount) * Math.PI * 2 +
        rotation +
        Math.sin(petal * 2.17 + layer * 1.31) * 0.018;
      const irregularity =
        organicWave(baseAngle, time, petal + layer * 7) *
        (0.035 + profile.warp * 0.095);
      const crystallineStretch =
        1 +
        profile.crystalline *
          (petal % 2 === 0 ? 0.13 : -0.035) *
          (0.5 + dynamics.chordStability * 0.5);
      const length =
        radius *
        (0.9 + irregularity + dynamics.attack * 0.08) *
        crystallineStretch *
        inward;
      const halfWidth =
        (Math.PI / petalCount) *
        (0.48 + profile.openness * 0.21 - profile.inward * 0.08);
      const rootRadius = radius * (0.12 + layer * 0.008);
      const curl =
        Math.sin(time * 0.00053 + petal * 1.9 + layer) *
        (0.06 + profile.float * 0.09);
      const startX = Math.cos(baseAngle) * rootRadius;
      const startY = Math.sin(baseAngle) * rootRadius;
      const tipX = Math.cos(baseAngle + curl) * length;
      const tipY =
        Math.sin(baseAngle + curl) *
        length *
        (0.9 + frame.music.averageRegister * 0.12);
      const leftAngle = baseAngle - halfWidth;
      const rightAngle = baseAngle + halfWidth;
      const shoulder = length * (0.48 + profile.inward * 0.08);

      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(
        Math.cos(leftAngle) * shoulder,
        Math.sin(leftAngle) * shoulder,
        tipX - Math.sin(baseAngle) * length * 0.1,
        tipY + Math.cos(baseAngle) * length * 0.1,
        tipX,
        tipY,
      );
      context.bezierCurveTo(
        tipX + Math.sin(baseAngle) * length * 0.1,
        tipY - Math.cos(baseAngle) * length * 0.1,
        Math.cos(rightAngle) * shoulder,
        Math.sin(rightAngle) * shoulder,
        startX,
        startY,
      );
      context.closePath();
      context.fillStyle = rgba(color, alpha * (0.07 + params.glow / 1800));
      context.fill();
      context.shadowColor = color;
      context.shadowBlur = 3 + params.glow * 0.075 + dynamics.attack * 9;
      context.strokeStyle = rgba(color, alpha);
      context.lineWidth =
        0.55 +
        (1 - layer / 10) * 0.45 +
        dynamics.velocity * 0.65 +
        profile.crystalline * 0.25;
      context.stroke();

      if (layer < 3 && petal % 2 === 0) {
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(
          Math.cos(baseAngle + curl * 0.5) * length * 0.57,
          Math.sin(baseAngle + curl * 0.5) * length * 0.57,
          tipX,
          tipY,
        );
        context.strokeStyle = rgba(color, alpha * 0.42);
        context.lineWidth = 0.45;
        context.stroke();
      }
    }
  }

  private drawFilaments(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    radius: number,
    petals: number,
    note: number,
    intensity: number,
  ): void {
    const count = qualityCount(
      frame,
      petals + 3 + Math.min(4, frame.music.notes.length),
      6,
    );
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + index * 0.17;
      const sway =
        Math.sin(frame.time * 0.00072 + index * 1.73) *
        (0.16 + frame.music.tension * 0.12);
      const length =
        radius *
        (0.68 +
          (index % 3) * 0.16 +
          frame.dynamics.held * 0.1 +
          frame.dynamics.sustain * 0.13);
      context.beginPath();
      context.moveTo(
        Math.cos(angle) * radius * 0.08,
        Math.sin(angle) * radius * 0.08,
      );
      context.bezierCurveTo(
        Math.cos(angle - sway) * length * 0.35,
        Math.sin(angle - sway) * length * 0.35,
        Math.cos(angle + sway) * length * 0.78,
        Math.sin(angle + sway) * length * 0.78,
        Math.cos(angle + sway * 0.35) * length,
        Math.sin(angle + sway * 0.35) * length,
      );
      glowStroke(
        context,
        noteColor(frame, note + index * 1.4),
        4 + frame.params.glow * 0.09,
        0.07 + intensity * 0.14,
      );
      context.lineWidth = 0.42 + frame.dynamics.velocity * 0.45;
      context.stroke();
    }
  }

  private drawHarmonyHalos(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    radius: number,
    note: number,
    layerBonus: number,
  ): void {
    for (let halo = 0; halo < layerBonus; halo += 1) {
      const haloRadius =
        radius *
        (1.16 + halo * 0.19 + Math.sin(frame.time * 0.0004 + halo) * 0.025);
      context.save();
      context.rotate(halo * 0.58 + frame.time * 0.000035 * (halo + 1));
      context.scale(1, 0.62 + halo * 0.12);
      context.setLineDash([2 + halo * 2, 8 + halo * 3]);
      context.lineDashOffset = -frame.time * 0.006 * (halo + 1);
      context.beginPath();
      context.arc(0, 0, haloRadius, 0, Math.PI * 2);
      glowStroke(
        context,
        noteColor(frame, note + halo * 3.5),
        7 + frame.params.glow * 0.08,
        0.14 + frame.dynamics.held * 0.1,
      );
      context.lineWidth = 0.75;
      context.stroke();
      context.restore();
    }
    context.setLineDash([]);
  }

  private drawAttacks(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    cx: number,
    cy: number,
  ): void {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const impulse of this.impulses) {
      const force = velocityCurve(impulse.velocity);
      const register = registerPosition(impulse.note);
      impulse.expansion +=
        frame.delta *
        (0.045 + force * 0.16) *
        (frame.params.reducedMotion ? 0.5 : 1);
      impulse.life -=
        frame.delta *
        (frame.music.sustain ? 0.00036 : 0.00072) *
        (0.9 - force * 0.16);
      const x = cx + pitchPosition(impulse.note) * frame.width * 0.17;
      const y = cy + (0.5 - register) * frame.height * 0.24;
      const radius =
        12 + impulse.expansion + (1 - impulse.life) * (36 + force * 82);
      const color = noteColor(frame, impulse.note);

      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      glowStroke(
        context,
        color,
        8 + frame.params.glow * 0.13,
        impulse.life * (0.18 + force * 0.34),
      );
      context.lineWidth = 0.8 + force * 2.4;
      context.stroke();

      const smallPetals = 4 + (impulse.note % 5);
      for (let petal = 0; petal < smallPetals; petal += 1) {
        const angle =
          (petal / smallPetals) * Math.PI * 2 +
          impulse.phase +
          (1 - impulse.life) * 0.35;
        const length = 8 + force * 18 + (1 - impulse.life) * 12;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(
          x + Math.cos(angle + 0.32) * length * 0.7,
          y + Math.sin(angle + 0.32) * length * 0.7,
          x + Math.cos(angle) * length,
          y + Math.sin(angle) * length,
        );
        context.strokeStyle = rgba(color, impulse.life * (0.22 + force * 0.38));
        context.lineWidth = 0.65 + force * 1.15;
        context.stroke();
      }
    }
    context.restore();
    this.impulses = this.impulses.filter((impulse) => impulse.life > 0);
  }

  private drawMotes(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    cx: number,
    cy: number,
  ): void {
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const mote of this.motes) {
      mote.radius += mote.radialSpeed * frame.delta;
      mote.angle +=
        (mote.spin + frame.music.tension * 0.000015) *
        frame.delta *
        (frame.params.reducedMotion ? 0.4 : 1);
      mote.life -=
        frame.delta *
        (frame.music.sustain ? 0.00019 : 0.00042) *
        (0.9 + mote.depth * 0.12);
      const flutter =
        Math.sin(frame.time * 0.0012 + mote.seed) * (3 + mote.depth * 4);
      const x =
        cx +
        Math.cos(mote.angle) * mote.radius * mote.depth +
        Math.cos(mote.angle + Math.PI / 2) * flutter;
      const y =
        cy +
        Math.sin(mote.angle) * mote.radius * (0.74 + mote.depth * 0.16) +
        Math.sin(mote.angle + Math.PI / 2) * flutter;
      drawSoftPoint(
        context,
        x,
        y,
        mote.size * (0.45 + mote.life * 0.65) * mote.depth,
        noteColor(frame, mote.note),
        clamp(mote.life, 0, 1) * (0.34 + mote.depth * 0.24),
      );
    }
    context.restore();
    this.motes = limitParticles(this.motes, frame, 0.82);
  }

  reset(): void {
    this.impulses = [];
    this.motes = [];
    this.pulse = 0;
    this.organismPhase = 0;
  }

  getActiveCount(): number {
    return this.impulses.length + this.motes.length;
  }
}
