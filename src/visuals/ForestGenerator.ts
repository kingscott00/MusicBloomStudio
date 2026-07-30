import type {
  HeldNote,
  MusicalState,
  VisualFrame,
  VisualGenerator,
  VisualNoteVoice,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, hashNoise, lerp } from "../utils/math";
import { drawSoftPoint, limitParticles, noteColor } from "./helpers";
import {
  harmonyProfile,
  pitchPosition,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

interface Tree {
  note: number;
  velocity: number;
  x: number;
  seed: number;
  life: number;
  shedding: boolean;
}

interface Spore {
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

export class ForestGenerator implements VisualGenerator {
  readonly mode = "forest" as const;
  private trees: Tree[] = [];
  private spores: Spore[] = [];

  noteTriggered(note: HeldNote, state: MusicalState): void {
    const existing = this.trees.find((tree) => tree.note === note.note);
    if (existing) {
      existing.velocity = note.velocity;
      existing.life = 1;
      existing.shedding = false;
      return;
    }
    this.trees.push({
      note: note.note,
      velocity: note.velocity,
      x: 0.5 + pitchPosition(note.note) * 0.31,
      seed: note.note * 23.17 + state.sequence * 7.41,
      life: 1,
      shedding: false,
    });
    this.trees = this.trees.slice(-8);
  }

  render(context: CanvasRenderingContext2D, frame: VisualFrame): void {
    this.syncVoices(frame);
    const voices = new Map<number, VisualNoteVoice>();
    for (const voice of frame.voices) voices.set(voice.note, voice);
    const profile = harmonyProfile(frame.music.chord.quality);
    const motion = frame.params.reducedMotion ? 0.3 : 1;

    context.save();
    context.globalCompositeOperation = "screen";
    for (const tree of this.trees) {
      const voice = voices.get(tree.note);
      if (!voice) tree.life *= Math.exp(-frame.delta / 1700);
      else if (voice.phase !== "release") {
        tree.life = Math.min(1, tree.life + frame.delta * 0.001);
        tree.shedding = false;
      } else {
        tree.life = Math.min(tree.life, 0.22 + voice.release * 0.9);
        if (!tree.shedding) {
          this.shed(tree, frame, voice);
          tree.shedding = true;
        }
      }
      const targetX = 0.5 + pitchPosition(tree.note) * 0.31;
      tree.x = lerp(tree.x, targetX, 1 - Math.exp(-frame.delta * 0.0018));
      const register = registerPosition(tree.note);
      const height =
        Math.min(frame.width, frame.height) *
        (0.14 +
          register * 0.11 +
          (voice?.development ?? 0) * 0.09 +
          (voice?.structuralLayer ?? 0) * 0.08) *
        (0.82 + velocityCurve(tree.velocity) * 0.28) *
        (1 - (voice?.releaseProgress ?? 0) * 0.3);
      const depth = clamp(
        3 +
          Math.round((voice?.development ?? 0) * 2) +
          Math.round((voice?.structuralLayer ?? 0) * 2) +
          (frame.qualityScale > 0.92 ? 1 : 0),
        3,
        frame.qualityScale > 0.92 ? 6 : 5,
      );
      const sway =
        Math.sin(frame.time * 0.00055 * motion + tree.seed) *
          (0.035 + profile.float * 0.025) +
        profile.directionalPull * 0.035;
      context.shadowColor = noteColor(frame, tree.note);
      context.shadowBlur = 1 + frame.params.glow * 0.025;
      this.drawBranch(
        context,
        frame,
        tree,
        voice,
        tree.x * frame.width,
        frame.height * (0.86 + (1 - register) * 0.035),
        -Math.PI / 2 + sway,
        height,
        depth,
        profile,
        0,
      );
    }
    this.drawSpores(context, frame);
    context.restore();

    this.trees = this.trees.filter((tree) => tree.life > 0.025);
  }

  private drawBranch(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
    tree: Tree,
    voice: VisualNoteVoice | undefined,
    x: number,
    y: number,
    angle: number,
    length: number,
    depth: number,
    profile: ReturnType<typeof harmonyProfile>,
    branchIndex: number,
  ): void {
    if (depth <= 0 || length < 2) return;
    const noise =
      (hashNoise(tree.seed + depth * 17.3, branchIndex * 3.1) - 0.5) *
      (0.09 + profile.warp * 0.12);
    const endX = x + Math.cos(angle + noise) * length;
    const endY = y + Math.sin(angle + noise) * length;
    const color = noteColor(
      frame,
      tree.note + (7 - depth) * 0.72,
      branchIndex * 0.003,
    );
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(
      (x + endX) / 2 + Math.sin(angle) * length * profile.curvature * 0.08,
      (y + endY) / 2 - Math.cos(angle) * length * profile.curvature * 0.08,
      endX,
      endY,
    );
    context.strokeStyle = rgba(
      color,
      tree.life * (0.08 + depth * 0.035 + (voice?.energy ?? 0) * 0.08),
    );
    context.lineWidth = Math.max(
      0.42,
      depth * 0.62 + velocityCurve(tree.velocity) * 0.45,
    );
    context.stroke();

    if (depth <= 2) {
      const leafSize =
        1.2 +
        velocityCurve(tree.velocity) * 1.8 +
        (voice?.structuralLayer ?? 0) * 1.6;
      drawSoftPoint(
        context,
        endX,
        endY,
        leafSize,
        noteColor(frame, tree.note + branchIndex),
        tree.life * (0.18 + (voice?.energy ?? 0) * 0.22),
      );
    }

    const spread =
      0.35 +
      profile.openness * 0.12 +
      profile.inward * 0.04 +
      (hashNoise(tree.seed, branchIndex + depth) - 0.5) * 0.13;
    const shrink = 0.67 + profile.stretch * 0.035;
    this.drawBranch(
      context,
      frame,
      tree,
      voice,
      endX,
      endY,
      angle - spread,
      length * shrink,
      depth - 1,
      profile,
      branchIndex * 2 + 1,
    );
    this.drawBranch(
      context,
      frame,
      tree,
      voice,
      endX,
      endY,
      angle + spread,
      length * shrink,
      depth - 1,
      profile,
      branchIndex * 2 + 2,
    );
    if (depth > 3 && profile.layerBonus > 0) {
      this.drawBranch(
        context,
        frame,
        tree,
        voice,
        endX,
        endY,
        angle + noise * 0.4,
        length * shrink * 0.78,
        depth - 2,
        profile,
        branchIndex * 2 + 3,
      );
    }
  }

  private shed(tree: Tree, frame: VisualFrame, voice: VisualNoteVoice): void {
    const count = Math.round(
      (5 + voice.releaseDepth * 14) * (0.55 + frame.qualityScale * 0.45),
    );
    for (let index = 0; index < count; index += 1) {
      const seed = tree.seed + index * 11.17 + voice.heldDuration * 0.01;
      this.spores.push({
        x: tree.x + (hashNoise(seed, 1) - 0.5) * 0.16,
        y: 0.58 - hashNoise(seed, 2) * 0.35,
        vx: (hashNoise(seed, 3) - 0.5) * 0.00008,
        vy: 0.000025 + hashNoise(seed, 4) * 0.00007,
        life: 0.65 + hashNoise(seed, 5) * 0.5,
        maxLife: 1,
        size: 0.8 + hashNoise(seed, 6) * 2.2,
        hue: tree.note / 12,
        seed,
        note: tree.note,
      });
    }
  }

  private drawSpores(
    context: CanvasRenderingContext2D,
    frame: VisualFrame,
  ): void {
    for (const spore of this.spores) {
      spore.x +=
        (spore.vx + Math.sin(frame.time * 0.001 + spore.seed) * 0.000012) *
        frame.delta;
      spore.y += spore.vy * frame.delta;
      spore.life -= frame.delta * (frame.music.sustain ? 0.00022 : 0.0005);
      drawSoftPoint(
        context,
        spore.x * frame.width,
        spore.y * frame.height,
        spore.size,
        noteColor(frame, spore.note),
        clamp(spore.life, 0, 1) * 0.52,
      );
    }
    this.spores = limitParticles(this.spores, frame, 0.55);
  }

  private syncVoices(frame: VisualFrame): void {
    for (const voice of frame.voices) {
      if (
        voice.phase === "release" ||
        this.trees.some((tree) => tree.note === voice.note)
      )
        continue;
      this.trees.push({
        note: voice.note,
        velocity: voice.velocity,
        x: 0.5 + pitchPosition(voice.note) * 0.31,
        seed: voice.note * 23.17 + voice.heldDuration * 0.002,
        life: 0.72,
        shedding: false,
      });
    }
    this.trees = this.trees.slice(-8);
  }

  reset(): void {
    this.trees = [];
    this.spores = [];
  }

  getActiveCount(): number {
    return this.trees.length + this.spores.length;
  }
}
