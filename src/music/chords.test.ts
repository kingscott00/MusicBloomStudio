import { describe, expect, it } from "vitest";
import { detectChord } from "./chords";

describe("chord detection", () => {
  it.each([
    [[60, 64, 67], "C", "major"],
    [[60, 63, 67], "Cm", "minor"],
    [[60, 63, 66], "Cdim", "diminished"],
    [[60, 64, 68], "Caug", "augmented"],
    [[60, 62, 67], "Csus2", "sus2"],
    [[60, 65, 67], "Csus4", "sus4"],
    [[60, 64, 67, 71], "Cmaj7", "major7"],
    [[60, 64, 67, 70], "C7", "dominant7"],
    [[60, 63, 67, 70], "Cm7", "minor7"],
    [[60, 63, 67, 71], "Cm(maj7)", "minorMajor7"],
    [[60, 64, 67, 69], "C6", "major6"],
    [[60, 63, 67, 69], "Cm6", "minor6"],
    [[60, 62, 64, 67], "Cadd9", "add9"],
    [[60, 62, 64, 67, 71], "Cmaj9", "major9"],
    [[60, 62, 63, 67, 70], "Cm9", "minor9"],
    [[60, 67], "C5", "power"],
  ])("recognizes %j as %s", (notes, label, quality) => {
    expect(detectChord(notes)).toMatchObject({ label, quality });
  });

  it("recognizes inversions and labels the bass note", () => {
    expect(detectChord([64, 67, 72])).toMatchObject({
      label: "C / E",
      root: 0,
      inversion: 1,
    });
  });

  it("uses a note collection for unknown harmony", () => {
    expect(detectChord([60, 61, 66])).toMatchObject({
      quality: "collection",
      label: "C · C♯ · F♯",
    });
  });
});
