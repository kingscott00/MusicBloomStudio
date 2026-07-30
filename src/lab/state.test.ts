import { beforeEach, describe, expect, it } from "vitest";
import { defaultRandomizerLocks } from "../presets/randomizer";
import { defaultParams } from "../presets/presets";
import {
  captureScene,
  copyScene,
  createHistory,
  createLaboratoryState,
  importInstrument,
  loadScene,
  migrateLaboratoryState,
  mutateLaboratory,
  pushHistory,
  redoHistory,
  serializeInstrument,
  swapScenes,
  undoHistory,
  validateInstrument,
} from "./state";
import type { VisualInstrument } from "./types";

describe("laboratory scenes and history", () => {
  it("captures, restores, copies, and swaps complete scenes", () => {
    let state = createLaboratoryState(defaultParams);
    state = captureScene(state, "A", {
      ...defaultParams,
      mode: "forest",
      density: 77,
    });
    expect(state.sceneA.params.mode).toBe("forest");
    expect(loadScene(state, "A").params.density).toBe(77);

    state = copyScene(state, "A");
    expect(state.sceneB).toEqual(state.sceneA);
    state.sceneB.params.mode = "portal";
    const swapped = swapScenes(state);
    expect(swapped.sceneA.params.mode).toBe("portal");
    expect(swapped.sceneB.params.mode).toBe("forest");
  });

  it("coalesces rapid slider edits and supports undo/redo", () => {
    const initial = { value: 1 };
    let history = createHistory(initial);
    history = pushHistory(history, { value: 2 }, "Density", "density", 100);
    history = pushHistory(history, { value: 3 }, "Density", "density", 400);
    expect(history.entries).toHaveLength(2);

    const undone = undoHistory(history);
    expect(undone.state.value).toBe(1);
    const redone = redoHistory(undone.history);
    expect(redone.state.value).toBe(3);
  });

  it("bounds history growth", () => {
    let history = createHistory({ value: 0 });
    for (let index = 1; index < 80; index += 1)
      history = pushHistory(history, { value: index }, `Edit ${index}`);
    expect(history.entries).toHaveLength(50);
    expect(history.entries.at(-1)?.state.value).toBe(79);
  });
});

describe("deterministic mutation", () => {
  it("recreates the same related variation from a seed and index", () => {
    const state = createLaboratoryState(defaultParams);
    const first = mutateLaboratory(
      state,
      defaultParams,
      defaultRandomizerLocks,
      "moderate",
      4,
    );
    const second = mutateLaboratory(
      state,
      defaultParams,
      defaultRandomizerLocks,
      "moderate",
      4,
    );
    expect(first).toEqual(second);
    expect(first.params.recipeSeed).toBe(second.params.recipeSeed);
  });

  it("respects visual identity locks even for wild mutation", () => {
    const state = createLaboratoryState(defaultParams);
    const result = mutateLaboratory(
      state,
      defaultParams,
      {
        ...defaultRandomizerLocks,
        experience: true,
        palette: true,
        density: true,
        motion: true,
        glow: true,
      },
      "wild",
      99,
    );
    expect(result.params.mode).toBe(defaultParams.mode);
    expect(result.params.paletteId).toBe(defaultParams.paletteId);
    expect(result.params.density).toBe(defaultParams.density);
    expect(result.params.speed).toBe(defaultParams.speed);
    expect(result.params.glow).toBe(defaultParams.glow);
  });
});

describe("Visual Instrument serialization and migration", () => {
  beforeEach(() => localStorage.clear());

  const instrument = (): VisualInstrument => ({
    version: 1,
    id: "custom-one",
    name: "Custom One",
    builtIn: false,
    favorite: true,
    modifiedAt: "2026-07-30T00:00:00.000Z",
    state: createLaboratoryState(defaultParams),
    randomizerLocks: defaultRandomizerLocks,
  });

  it("round-trips a versioned complete instrument", () => {
    const restored = importInstrument(serializeInstrument(instrument()));
    expect(restored.name).toBe("Custom One");
    expect(restored.state.sceneA.params).toEqual(defaultParams);
    expect(restored.version).toBe(1);
  });

  it("migrates missing optional laboratory properties to safe defaults", () => {
    const state = createLaboratoryState(defaultParams);
    const migrated = migrateLaboratoryState(
      { ...state, version: undefined, customPalettes: undefined },
      defaultParams,
    );
    expect(migrated.version).toBe(1);
    expect(migrated.customPalettes).toEqual([]);
  });

  it("rejects malformed, executable-looking, and future-version imports", () => {
    expect(() => importInstrument("not json")).toThrow("valid JSON");
    expect(() =>
      validateInstrument({ version: 1, instrument: { name: "x" } }),
    ).toThrow("malformed");
    expect(() =>
      validateInstrument({ version: 99, instrument: instrument() }),
    ).toThrow("not supported");
    expect(() =>
      validateInstrument({
        ...instrument(),
        state: {
          ...instrument().state,
          sceneB: { injected: "not a scene" },
        },
      }),
    ).toThrow("invalid scene");
    expect(() =>
      validateInstrument({
        ...instrument(),
        randomizerLocks: { experience: "yes" },
      }),
    ).toThrow("invalid randomizer locks");
  });

  it("keeps existing VisualParameters compatible inside scenes", () => {
    const state = createLaboratoryState(defaultParams);
    expect(state.sceneA.params).toEqual(defaultParams);
    expect(state.sceneA.params.quality).toBe("auto");
    expect(state.sceneA.params.reducedMotion).toBe(false);
  });
});
