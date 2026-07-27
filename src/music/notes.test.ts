import { describe, expect, it } from "vitest";
import { noteName, pitchClassName } from "./notes";

describe("note names", () => {
  it("uses scientific pitch notation", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(66)).toBe("F♯4");
    expect(noteName(47, true)).toBe("B2");
  });

  it("supports consistent flat spelling", () => {
    expect(noteName(58, true)).toBe("B♭3");
    expect(pitchClassName(6, true)).toBe("G♭");
    expect(pitchClassName(6, false)).toBe("F♯");
  });
});
