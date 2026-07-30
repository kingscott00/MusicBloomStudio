import { describe, expect, it } from "vitest";
import { defaultRandomizerLocks } from "../presets/randomizer";
import { defaultParams } from "../presets/presets";
import type { MidiMappingProfile } from "../types";
import {
  createHistory,
  createLaboratoryState,
  pushHistory,
  undoHistory,
} from "./state";
import {
  SAFE_SURPRISE_PAIRS,
  surpriseCurrentScene,
  surpriseFullInstrument,
} from "./surprise";
import type { VisualInstrument } from "./types";

describe("Laboratory Surprise Me", () => {
  it("respects current-scene locks and preserves the other scene", () => {
    const state = createLaboratoryState({
      ...defaultParams,
      mode: "metal",
      paletteId: "embers",
      density: 17,
      speed: 23,
      trails: 44,
      glow: 51,
      bloom: 63,
    });
    const otherScene = structuredClone(state.sceneB);
    const result = surpriseCurrentScene(
      state,
      state.sceneA.params,
      {
        ...defaultRandomizerLocks,
        experience: true,
        palette: true,
        density: true,
        motion: true,
        trails: true,
        glow: true,
        symmetry: true,
      },
      41717,
    );
    expect(result.params).toMatchObject({
      mode: "metal",
      paletteId: "embers",
      density: 17,
      speed: 23,
      trails: 44,
      glow: 51,
      bloom: 63,
    });
    expect(result.state.sceneB).toEqual(otherScene);
    expect(result.state.macros).toEqual(state.macros);
    expect(result.state.modulationRoutes).toEqual(state.modulationRoutes);
  });

  it("creates complete, useful A/B instruments from safe pairings", () => {
    const state = createLaboratoryState(defaultParams);
    const result = surpriseFullInstrument(
      state,
      defaultParams,
      defaultRandomizerLocks,
      82217,
    );
    const pair = [
      result.state.sceneA.params.mode,
      result.state.sceneB.params.mode,
    ];
    expect(
      SAFE_SURPRISE_PAIRS.some(([a, b]) => pair[0] === a && pair[1] === b),
    ).toBe(true);
    expect(result.state.macros).toHaveLength(8);
    expect(result.state.macros[0].name).toBe("Radiance");
    expect(result.state.modulationRoutes.length).toBeGreaterThanOrEqual(2);
    expect(result.state.modulationRoutes.length).toBeLessThanOrEqual(3);
    expect(result.state.morph).toBeGreaterThanOrEqual(22);
    expect(result.state.morph).toBeLessThanOrEqual(70);
    expect(result.state.sceneA.advanced).not.toEqual({});
    expect(result.state.sceneB.response.attack).toBeGreaterThan(0);
  });

  it("preserves each scene identity and palette when those locks are active", () => {
    const state = createLaboratoryState(defaultParams);
    state.sceneA.params.mode = "forest";
    state.sceneA.params.paletteId = "forest";
    state.sceneB.params.mode = "portal";
    state.sceneB.params.paletteId = "violet";
    const result = surpriseFullInstrument(
      state,
      state.sceneA.params,
      {
        ...defaultRandomizerLocks,
        experience: true,
        palette: true,
      },
      112233,
    );
    expect(result.state.sceneA.params.mode).toBe("forest");
    expect(result.state.sceneB.params.mode).toBe("portal");
    expect(result.state.sceneA.params.paletteId).toBe("forest");
    expect(result.state.sceneB.params.paletteId).toBe("violet");
  });

  it("replays both scopes deterministically from the same seed", () => {
    const state = createLaboratoryState(defaultParams);
    expect(
      surpriseCurrentScene(
        state,
        defaultParams,
        defaultRandomizerLocks,
        123456,
      ),
    ).toEqual(
      surpriseCurrentScene(
        state,
        defaultParams,
        defaultRandomizerLocks,
        123456,
      ),
    );
    expect(
      surpriseFullInstrument(
        state,
        defaultParams,
        defaultRandomizerLocks,
        654321,
      ),
    ).toEqual(
      surpriseFullInstrument(
        state,
        defaultParams,
        defaultRandomizerLocks,
        654321,
      ),
    );
  });

  it.each(["current", "full"] as const)(
    "undoes a %s surprise as one history operation",
    (scope) => {
      const state = createLaboratoryState(defaultParams);
      const original = { laboratory: state, params: defaultParams };
      const result =
        scope === "current"
          ? surpriseCurrentScene(
              state,
              defaultParams,
              defaultRandomizerLocks,
              811,
            )
          : surpriseFullInstrument(
              state,
              defaultParams,
              defaultRandomizerLocks,
              811,
            );
      const history = pushHistory(
        createHistory(original),
        { laboratory: result.state, params: result.params },
        "Surprise",
      );
      expect(history.entries).toHaveLength(2);
      expect(undoHistory(history).state).toEqual(original);
    },
  );

  it("does not modify MIDI mappings or overwrite saved instruments", () => {
    const state = createLaboratoryState(defaultParams);
    const profile: MidiMappingProfile = {
      id: "profile-one",
      name: "Controller",
      deviceId: "midi-1",
      deviceName: "Keyboard",
      mappings: [],
    };
    const saved: VisualInstrument[] = [
      {
        version: 1,
        id: "saved-one",
        name: "Saved",
        builtIn: false,
        favorite: false,
        modifiedAt: "2026-07-30T00:00:00.000Z",
        state: structuredClone(state),
        randomizerLocks: defaultRandomizerLocks,
      },
    ];
    const mappingsBefore = structuredClone(profile);
    const savedBefore = structuredClone(saved);
    surpriseFullInstrument(state, defaultParams, defaultRandomizerLocks, 919);
    expect(profile).toEqual(mappingsBefore);
    expect(saved).toEqual(savedBefore);
  });

  it("only selects renderer-safe mode pairings", () => {
    const allowed = new Set(SAFE_SURPRISE_PAIRS.map(([a, b]) => `${a}:${b}`));
    for (let seed = 1; seed <= 64; seed += 1) {
      const state = createLaboratoryState(defaultParams);
      const result = surpriseFullInstrument(
        state,
        defaultParams,
        defaultRandomizerLocks,
        seed,
      );
      expect(
        allowed.has(
          `${result.state.sceneA.params.mode}:${result.state.sceneB.params.mode}`,
        ),
      ).toBe(true);
    }
  });
});
