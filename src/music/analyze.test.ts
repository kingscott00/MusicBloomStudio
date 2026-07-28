import { describe, expect, it } from "vitest";
import type { HeldNote } from "../types";
import { MusicalAnalyzer } from "./analyze";

const held = (note: number, velocity: number, sustained = false): HeldNote => ({
  note,
  velocity,
  startedAt: 100,
  source: "midi",
  physicallyHeld: !sustained,
  sustained,
});

describe("MusicalAnalyzer envelopes", () => {
  it("preserves the exact latest attack independently of note sorting", () => {
    const analyzer = new MusicalAnalyzer();
    analyzer.registerOnset(72, 60, 100);
    analyzer.registerOnset(48, 112, 220);
    const state = analyzer.analyze(
      [held(48, 112), held(72, 60)],
      false,
      225,
      false,
    );

    expect(state.lastAttack).toMatchObject({
      note: 48,
      velocity: 112,
      sequence: 2,
    });
    expect(state.lastInterval).toBe(-24);
    expect(state.timeBetweenNotes).toBe(120);
    expect(state.attackImpulse).toBeGreaterThan(0.8);
  });

  it("distinguishes quiet and forceful performance energy", () => {
    const quiet = new MusicalAnalyzer();
    quiet.registerOnset(60, 24, 100);
    const quietState = quiet.analyze([held(60, 24)], false, 110, false);

    const loud = new MusicalAnalyzer();
    loud.registerOnset(60, 124, 100);
    const loudState = loud.analyze([held(60, 124)], false, 110, false);

    expect(loudState.rollingAverageVelocity).toBeGreaterThan(
      quietState.rollingAverageVelocity,
    );
    expect(loudState.heldEnergy).toBeGreaterThan(quietState.heldEnergy);
    expect(loudState.energy).toBeGreaterThan(quietState.energy);
  });

  it("tracks release and sustain-linger energy", () => {
    const analyzer = new MusicalAnalyzer();
    analyzer.registerOnset(60, 100, 100);
    analyzer.registerRelease(60, 260);
    const state = analyzer.analyze([held(60, 100, true)], true, 280, false);

    expect(state.releaseEnergy).toBeGreaterThan(0);
    expect(state.sustainEnergy).toBeGreaterThan(0);
  });
});
