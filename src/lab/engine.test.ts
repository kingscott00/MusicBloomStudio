import { describe, expect, it } from "vitest";
import { defaultParams } from "../presets/presets";
import type { MusicalState, VisualDynamics } from "../types";
import {
  applyMacroCurve,
  applyModulationValue,
  evaluateModulationSource,
  interpolatePalette,
  interpolateScenes,
  resolveLaboratoryFrame,
  scaleMacroAssignment,
} from "./engine";
import { createLaboratoryState } from "./state";
import type { MacroAssignment, ModulationRoute } from "./types";

const music: MusicalState = {
  notes: [
    {
      note: 72,
      velocity: 100,
      startedAt: 0,
      source: "midi",
      physicallyHeld: true,
      sustained: false,
    },
  ],
  chord: {
    root: 0,
    quality: "major",
    label: "C",
    inversion: null,
    pitchClasses: [0, 4, 7],
  },
  sustain: false,
  averageVelocity: 100,
  rollingAverageVelocity: 96,
  noteDensity: 0.4,
  rhythmicActivity: 0.65,
  averageRegister: 72,
  tension: 0.22,
  lastInterval: 4,
  timeBetweenNotes: 240,
  energy: 0.7,
  attackImpulse: 0.8,
  heldEnergy: 0.5,
  releaseEnergy: 0.1,
  lastReleaseAt: 0,
  sustainEnergy: 0,
  chordStability: 0.8,
  chordChangedAt: 0,
  sequence: 1,
  lastNote: 72,
  lastAttack: { sequence: 1, note: 72, velocity: 100, timestamp: 0 },
  recentNotes: [],
  noteLifecycles: [],
};

const dynamics: VisualDynamics = {
  attack: 0.8,
  held: 0.55,
  release: 0.12,
  sustain: 0,
  rhythm: 0.65,
  velocity: 0.75,
  intensity: 0.7,
  chordStability: 0.8,
};

describe("laboratory morph and macro engine", () => {
  it("interpolates same-experience numeric state without changing its mode", () => {
    const state = createLaboratoryState(defaultParams);
    state.sceneA.params.density = 20;
    state.sceneB.params.density = 80;
    state.sceneA.advanced["bloom.curvature"] = 10;
    state.sceneB.advanced["bloom.curvature"] = 90;

    const middle = interpolateScenes(state.sceneA, state.sceneB, 0.5);

    expect(middle.params.mode).toBe("bloom");
    expect(middle.params.density).toBe(50);
    expect(middle.advanced["bloom.curvature"]).toBe(50);
  });

  it("reports a bounded dual-render transition for different experiences", () => {
    const state = createLaboratoryState(defaultParams);
    state.sceneB.params.mode = "portal";
    state.morph = 50;

    const resolved = resolveLaboratoryFrame(
      { enabled: true, ...state },
      music,
      dynamics,
      1000,
    );

    expect(resolved.dualRender).toBe(true);
    expect(resolved.primary.params.mode).toBe("bloom");
    expect(resolved.secondary?.params.mode).toBe("portal");
    expect(resolved.primaryOpacity + resolved.secondaryOpacity).toBeCloseTo(1);
  });

  it("interpolates unequal palette stop counts and backgrounds", () => {
    const result = interpolatePalette(
      {
        id: "a",
        name: "A",
        colors: ["#000000", "#ffffff"],
        background: "#000000",
      },
      {
        id: "b",
        name: "B",
        colors: ["#ff0000", "#00ff00", "#0000ff"],
        background: "#ffffff",
      },
      0.5,
    );

    expect(result.colors).toHaveLength(3);
    expect(result.colors[0]).not.toBe("#000000");
    expect(result.background).toContain("rgb");
  });

  it("supports all macro curves and weighted target scaling", () => {
    expect(applyMacroCurve(0.5, "linear")).toBe(0.5);
    expect(applyMacroCurve(0.5, "ease-in")).toBeLessThan(0.5);
    expect(applyMacroCurve(0.5, "ease-out")).toBeGreaterThan(0.5);
    expect(applyMacroCurve(0.5, "s-curve")).toBeCloseTo(0.5);

    const assignment: MacroAssignment = {
      id: "a",
      target: "shared.glow",
      min: 20,
      max: 100,
      invert: false,
      curve: "linear",
      weight: 100,
    };
    expect(scaleMacroAssignment(75, assignment)).toBe(80);
    expect(scaleMacroAssignment(75, { ...assignment, invert: true })).toBe(40);
    expect(scaleMacroAssignment(100, { ...assignment, weight: 0 })).toBe(60);
  });
});

describe("laboratory modulation", () => {
  const route: ModulationRoute = {
    id: "route",
    enabled: true,
    source: "velocity",
    shape: "sine",
    target: "shared.glow",
    amount: 30,
    polarity: "unipolar",
    smoothing: 0,
    min: 20,
    max: 80,
  };

  it("evaluates existing musical analysis as normalized modulation", () => {
    const velocity = evaluateModulationSource(route, music, dynamics, 1000);
    const register = evaluateModulationSource(
      { ...route, source: "register" },
      music,
      dynamics,
      1000,
    );
    const attack = evaluateModulationSource(
      { ...route, source: "attack" },
      music,
      dynamics,
      1000,
    );

    expect(velocity).toBeGreaterThan(0);
    expect(register).toBeGreaterThan(0);
    expect(attack).toBeCloseTo(0.6);
  });

  it("applies unipolar and bipolar amounts inside explicit bounds", () => {
    expect(applyModulationValue(50, -1, route)).toBe(50);
    expect(applyModulationValue(50, 1, route)).toBe(80);
    expect(
      applyModulationValue(50, -1, { ...route, polarity: "bipolar" }),
    ).toBe(20);
    expect(applyModulationValue(75, 1, { ...route, amount: 100 })).toBe(80);
  });

  it("uses a music route in resolved visual parameters", () => {
    const state = createLaboratoryState(defaultParams);
    state.sceneA.params.glow = 30;
    state.sceneB.params.glow = 30;
    state.sceneA.modulationRoutes = [route];
    state.sceneB.modulationRoutes = [route];

    const resolved = resolveLaboratoryFrame(
      { enabled: true, ...state },
      music,
      dynamics,
      1000,
    );
    expect(resolved.primary.params.glow).toBeGreaterThan(30);
    expect(resolved.activeRoutes).toBe(1);
  });
});
