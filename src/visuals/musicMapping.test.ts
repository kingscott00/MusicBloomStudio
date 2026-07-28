import { describe, expect, it } from "vitest";
import {
  harmonyProfile,
  registerPosition,
  velocityCurve,
} from "./musicMapping";

describe("music-to-visual mapping", () => {
  it("gives chord families meaningfully different physical profiles", () => {
    expect(harmonyProfile("major").openness).toBeGreaterThan(
      harmonyProfile("minor").openness,
    );
    expect(harmonyProfile("minor").inward).toBeGreaterThan(
      harmonyProfile("major").inward,
    );
    expect(harmonyProfile("sus4").float).toBeGreaterThan(
      harmonyProfile("major").float,
    );
    expect(harmonyProfile("diminished").warp).toBeGreaterThan(
      harmonyProfile("minor").warp,
    );
    expect(harmonyProfile("major9").layerBonus).toBe(2);
  });

  it("maps register and velocity monotonically", () => {
    expect(registerPosition(36)).toBeLessThan(registerPosition(84));
    expect(velocityCurve(20)).toBeLessThan(velocityCurve(120));
    expect(velocityCurve(1)).toBeGreaterThan(0);
  });
});
