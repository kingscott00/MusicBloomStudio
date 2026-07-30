import { describe, expect, it } from "vitest";
import { devSimulationFromSearch } from "./devSimulation";

describe("developer note simulation", () => {
  it("parses timed note and sustain scenarios for lifecycle verification", () => {
    expect(
      devSimulationFromSearch(
        "?devNotes=48,60,60,999&devDuration=100&devSustain=1&devPedalUp=2000",
      ),
    ).toEqual({
      notes: [48, 60],
      duration: 100,
      sustain: true,
      pedalUp: 2000,
    });
  });

  it("bounds scenario timing and ignores invalid notes", () => {
    const simulation = devSimulationFromSearch(
      "?devNotes=nope,-1,127&devDuration=2&devPedalUp=99999",
    );
    expect(simulation.notes).toEqual([127]);
    expect(simulation.duration).toBe(20);
    expect(simulation.pedalUp).toBe(12_000);
  });
});
