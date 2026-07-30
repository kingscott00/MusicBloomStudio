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
  voiceComposition,
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
  private auraSprites = new Map<string, HTMLCanvasElement>();

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
    const tonalCenter = music.chord.root ?? latestNote;
    const composition = voiceComposition(frame.voices);
    const register =
      composition.count > 0
        ? composition.register
        : registerPosition(latestNote);
    const profile = harmonyProfile(music.chord.quality);
    let development = 0;
    let structuralLayer = 0;
    for (const voice of frame.voices) {
      if (voice.phase === "release") continue;
      development = Math.max(development, voice.development);
      structuralLayer = Math.max(structuralLayer, voice.structuralLayer);
    }
    const motionScale = params.reducedMotion ? 0.34 : 1;
    const autoDrift = params.autoMotion ? 1 : 0.18;
    const pitchDrift =
      composition.count > 0 ? composition.pitch : pitchPosition(latestNote);
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
        (0.035 +
          dynamics.held * 0.045 +
          dynamics.sustain * 0.025 +
          profile.float * 0.018);
    const registerScale = 1.18 - register * 0.22;
    const baseRadius =
      Math.min(width, height) *
      (0.115 + params.bloom / 820) *
      registerScale *
      breath *
      (1 + this.pulse * 0.2) *
      (1 + development * 0.08 + structuralLayer * 0.07) *
      (0.88 + profile.stretch * 0.12);
    const intensity = Math.max(0.16 + params.idle / 440, dynamics.intensity);

    this.drawAura(context, frame, cx, cy, baseRadius, tonalCenter, intensity);

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
        Math.round(dynamics.held * 2) +
        Math.round(development) +
        Math.round(structuralLayer),
      4,
      10,
    );
    const layers = qualityCount(frame, desiredLayers, 3);
    const petals = Math.max(
      3,
      Math.round(
        (params.symmetry + Math.min(3, music.notes.length)) *
          (0.62 + frame.qualityScale * 0.38),
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
      const color = noteColor(frame, tonalCenter + layer * 1.37, depth * 0.08);
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

    this.drawVoices(context, frame, baseRadius, profile);
    this.drawFilaments(
      context,
      frame,
      baseRadius,
      petals,
      tonalCenter,
      intensity,
    );
    this.drawHarmonyHalos(context, frame, baseRadius, tonalCenter, profile);
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
    const aura = this.getAuraSprite(color);
    const auraSize = radius * 2.9;
    const previousAlpha = context.globalAlpha;
    context.globalAlpha = previousAlpha * (0.25 + intensity * 0.32);
    context.globalCompositeOperation = "screen";
    context.drawImage(
      aura,
      cx - auraSize / 2,
      cy - auraSize / 2,
      auraSize,
      auraSize,
    );
    context.globalAlpha = previousAlpha;

    drawSoftPoint(
      context,
      cx,
      cy,
      radius * (0.045 + frame.dynamics.attack * 0.035),
      noteColor(frame, note, 0.08),
      0.24 + intensity * 0.22,
    );
  }

  private getAuraSprite(color: string): HTMLCanvasElement {
    const cached = this.auraSprites.get(color);
    if (cached) return cached;
    const sprite = document.createElement("canvas");
    sprite.width = 256;
    sprite.height = 256;
    const spriteContext = sprite.getContext("2d");
    if (spriteContext) {
      const aura = spriteContext.createRadialGradient(
        128,
        128,
        2,
        128,
        128,
        128,
      );
      aura.addColorStop(0, rgba(color, 0.12));
      aura.addColorStop(0.24, rgba(color, 0.04));
      aura.addColorStop(0.7, rgba(color, 0.009));
      aura.addColorStop(1, rgba(color, 0));
      spriteContext.fillStyle = aura;
      spriteContext.fillRect(0, 0, 256, 256);
    }
    if (this.auraSprites.size >= 24) {
      const oldest = this.auraSprites.keys().next().value;
      if (oldest) this.auraSprites.delete(oldest);
    }
    this.auraSprites.set(color, sprite);
    return sprite;
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
    const inward = 1 - profile.inward * 0.22;
    const petalFill = rgba(color, alpha * (0.07 + params.glow / 1800));
    const petalStroke = rgba(color, alpha);
    const veinStroke = rgba(color, alpha * 0.42);
    const petalWidth =
      0.55 +
      (1 - layer / 10) * 0.45 +
      dynamics.velocity * 0.65 +
      profile.crystalline * 0.25;
    context.fillStyle = petalFill;
    context.shadowColor = color;
    context.shadowBlur = 2 + params.glow * 0.055 + dynamics.attack * 7;
    for (let petal = 0; petal < petalCount; petal += 1) {
      const baseAngle =
        (petal / petalCount) * Math.PI * 2 +
        rotation +
        Math.sin(petal * 2.17 + layer * 1.31) * 0.018 +
        Math.sin(time * 0.0022 + petal * 4.1) * profile.instability * 0.038;
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
        (0.84 + profile.stretch * 0.16) *
        inward;
      const halfWidth =
        (Math.PI / petalCount) *
        (0.4 +
          profile.openness * 0.23 -
          profile.inward * 0.09 +
          profile.closure * 0.05);
      const rootRadius = radius * (0.12 + layer * 0.008);
      const curl =
        Math.sin(time * 0.00053 + petal * 1.9 + layer) *
        (0.045 + profile.float * 0.09 + profile.curvature * 0.1);
      const directionalBend = profile.directionalPull * (0.035 + layer * 0.004);
      const startX = Math.cos(baseAngle) * rootRadius;
      const startY = Math.sin(baseAngle) * rootRadius;
      const tipX = Math.cos(baseAngle + curl + directionalBend) * length;
      const tipY =
        Math.sin(baseAngle + curl + directionalBend) *
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
      context.fill();
      context.strokeStyle = petalStroke;
      context.lineWidth = petalWidth;
      context.stroke();

      if (layer < 3 && petal % 2 === 0 && frame.qualityScale > 0.62) {
        context.beginPath();
        context.moveTo(startX, startY);
        context.quadraticCurveTo(
          Math.cos(baseAngle + curl * 0.5) * length * 0.57,
          Math.sin(baseAngle + curl * 0.5) * length * 0.57,
          tipX,
          tipY,
        );
        context.strokeStyle = veinStroke;
        context.lineWidth = 0.45;
        context.stroke();
      }
    }
  }

  private drawVoices(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    radius: number,
    profile: ReturnType<typeof harmonyProfile>,
  ): void {
    const root = frame.music.chord.root ?? frame.music.notes[0]?.note ?? 60;
    const inversionTurn = (frame.music.chord.inversion ?? 0) * 0.08;
    let drawn = 0;
    for (
      let voiceIndex = frame.voices.length - 1;
      voiceIndex >= 0 && drawn < 9;
      voiceIndex -= 1
    ) {
      const voice = frame.voices[voiceIndex];
      if (voice.energy <= 0.035) continue;
      drawn += 1;
      const interval = (voice.note - root + 120) % 12;
      const angle =
        (interval / 12) * Math.PI * 2 -
        Math.PI / 2 +
        inversionTurn +
        Math.sin(frame.time * 0.00022 + voice.note) * profile.float * 0.06;
      const register = registerPosition(voice.note);
      const orbit =
        radius *
        (0.28 +
          register * 0.62 +
          profile.openness * 0.08 +
          voice.hold * 0.08 +
          voice.releaseProgress * (0.12 + voice.releaseDepth * 0.28));
      const x = Math.cos(angle) * orbit;
      const y = Math.sin(angle) * orbit * (0.78 + profile.inward * 0.12);
      const color = noteColor(frame, voice.note);
      const size =
        radius *
        (0.055 +
          voice.energy * 0.08 +
          voice.attack * 0.1 +
          voice.development * 0.06 +
          voice.structuralLayer * 0.075);
      const releaseScale =
        1 - voice.releaseProgress * (0.7 - voice.releaseDepth * 0.28);

      context.save();
      context.translate(x, y);
      context.scale(
        releaseScale,
        releaseScale *
          (1 - voice.releaseProgress * (0.28 + profile.inward * 0.12)),
      );
      context.rotate(
        angle +
          Math.PI / 2 +
          profile.directionalPull * 0.28 +
          Math.sin(frame.time * 0.0017 + voice.note) *
            profile.instability *
            0.12,
      );
      context.beginPath();
      context.moveTo(0, -size * 0.25);
      context.bezierCurveTo(
        size * (0.5 + profile.curvature * 0.18),
        -size * 0.8,
        size * (0.58 + profile.openness * 0.15),
        size * 0.65,
        0,
        size * (1 + profile.stretch * 0.24),
      );
      context.bezierCurveTo(
        -size * (0.58 + profile.openness * 0.15),
        size * 0.65,
        -size * (0.5 + profile.curvature * 0.18),
        -size * 0.8,
        0,
        -size * 0.25,
      );
      context.strokeStyle = rgba(color, 0.16 + voice.energy * 0.38);
      context.fillStyle = rgba(color, 0.025 + voice.hold * 0.07);
      context.shadowColor = color;
      context.shadowBlur = 5 + frame.params.glow * 0.09 + voice.attack * 14;
      context.lineWidth = 0.7 + velocityCurve(voice.velocity) * 1.2;
      context.fill();
      context.stroke();

      if (voice.development > 0.08 && voice.phase !== "release") {
        context.beginPath();
        context.ellipse(
          0,
          size * 0.12,
          size * (0.32 + voice.development * 0.16),
          size * (0.55 + voice.development * 0.24),
          0,
          0,
          Math.PI * 2,
        );
        context.strokeStyle = rgba(
          color,
          voice.development * (0.1 + voice.energy * 0.18),
        );
        context.lineWidth = 0.5;
        context.stroke();
      }
      if (voice.structuralLayer > 0.08 && voice.phase !== "release") {
        for (let tendril = -1; tendril <= 1; tendril += 1) {
          context.beginPath();
          context.moveTo(0, size * 0.3);
          context.bezierCurveTo(
            tendril * size * 0.45,
            size * 0.9,
            -tendril * size * 0.55,
            size * 1.3,
            tendril * size * 0.28,
            size * (1.55 + voice.structuralLayer * 0.45),
          );
          context.strokeStyle = rgba(color, voice.structuralLayer * 0.18);
          context.lineWidth = 0.45;
          context.stroke();
        }
      }

      if (voice.phase === "sustain" || voice.phase === "release") {
        context.setLineDash(voice.phase === "sustain" ? [3, 5] : [2, 8]);
        context.beginPath();
        context.arc(
          0,
          0,
          size * (1.2 + voice.sustain * 0.5 + voice.release * 0.35),
          0,
          Math.PI * 2,
        );
        context.strokeStyle = rgba(
          color,
          0.08 + voice.sustain * 0.22 + voice.release * 0.16,
        );
        context.lineWidth = 0.6;
        context.stroke();
        context.setLineDash([]);
      }
      context.restore();

      if (voice.phase === "release") {
        const shedCount = frame.qualityScale > 0.7 ? 3 : 2;
        for (let shed = 0; shed < shedCount; shed += 1) {
          const shedAngle =
            angle +
            (shed - (shedCount - 1) / 2) * 0.32 +
            Math.sin(voice.note + shed) * 0.12;
          const distance =
            orbit + radius * voice.releaseProgress * (0.22 + shed * 0.11);
          drawSoftPoint(
            context,
            Math.cos(shedAngle) * distance,
            Math.sin(shedAngle) * distance * (0.78 + profile.inward * 0.12),
            1.2 + voice.releaseDepth * 1.6,
            color,
            voice.release * (0.18 + voice.releaseDepth * 0.24),
          );
        }
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
    profile: ReturnType<typeof harmonyProfile>,
  ): void {
    const haloCount = Math.max(
      profile.layerBonus,
      Math.round(profile.halo * 2),
    );
    for (let halo = 0; halo < haloCount; halo += 1) {
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
        0.08 + profile.halo * 0.12 + frame.dynamics.held * 0.1,
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
      impulse.life -= frame.delta * 0.00165 * (0.9 - force * 0.16);
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
    let writeIndex = 0;
    for (const impulse of this.impulses) {
      if (impulse.life > 0) this.impulses[writeIndex++] = impulse;
    }
    this.impulses.length = writeIndex;
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
        (frame.music.sustain ? 0.00027 : 0.00072) *
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
