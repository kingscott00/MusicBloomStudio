import { describe, expect, it } from "vitest";
import type { HeldNote, ReleasedNote } from "../types";
import { MusicalAnalyzer } from "./analyze";
import { detectChord } from "./chords";

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

  it("derives release energy only from completed note lifecycles", () => {
    const analyzer = new MusicalAnalyzer();
    analyzer.registerOnset(60, 100, 100);
    const release: ReleasedNote = {
      note: 60,
      velocity: 100,
      startedAt: 100,
      releasedAt: 260,
      source: "midi",
      releasedFromSustain: false,
    };
    const state = analyzer.analyze([], false, 280, false, [release]);

    expect(state.releaseEnergy).toBeGreaterThan(0);
    expect(state.sustainEnergy).toBe(0);
  });

  it("updates visual harmony from the stabilized chord as one state", () => {
    const analyzer = new MusicalAnalyzer();
    const majorNotes = [held(59, 90), held(63, 90), held(66, 90)];
    const minorNotes = [held(59, 90), held(62, 90), held(66, 90)];
    const major = detectChord(majorNotes);
    const minor = detectChord(minorNotes);

    const first = analyzer.analyze(majorNotes, false, 1000, false, [], major);
    const second = analyzer.analyze(minorNotes, false, 1200, false, [], minor);

    expect(first.chord.quality).toBe("major");
    expect(second.chord.quality).toBe("minor");
    expect(second.tension).not.toBe(first.tension);
    expect(second.chordChangedAt).toBe(1200);
  });
});
