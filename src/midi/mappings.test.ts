import { beforeEach, describe, expect, it } from "vitest";
import type {
  MidiControlMessage,
  MidiMapping,
  MidiMappingProfile,
} from "../types";
import {
  applyContinuousMapping,
  createMappingRuntime,
  exportMappingProfiles,
  findMappingConflicts,
  importMappingProfiles,
  loadMappingProfiles,
  saveMappingProfiles,
  scaleMidiValue,
  shouldTriggerMidiAction,
} from "./mappings";

const mapping: MidiMapping = {
  id: "map-1",
  targetType: "parameter",
  target: "density",
  deviceId: "controller-a",
  deviceName: "Controller A",
  source: "cc",
  channel: 0,
  controller: 21,
  inputMin: 0,
  inputMax: 127,
  outputMin: 0,
  outputMax: 100,
  invert: false,
  smoothing: "none",
  takeover: "jump",
  pitchMode: "permanent",
};

const message = (value: number): MidiControlMessage => ({
  source: "cc",
  deviceId: "controller-a",
  deviceName: "Controller A",
  channel: 0,
  controller: 21,
  rawValue: value,
  value,
  timestamp: 1,
});

describe("MIDI performance mappings", () => {
  beforeEach(() => localStorage.clear());

  it("scales ranges and supports inversion", () => {
    expect(scaleMidiValue(63.5, mapping)).toBeCloseTo(50);
    expect(scaleMidiValue(0, { ...mapping, invert: true })).toBe(100);
  });

  it("supports direct control and smoothing", () => {
    const direct = applyContinuousMapping(
      mapping,
      message(127),
      10,
      createMappingRuntime(),
    );
    expect(direct.value).toBe(100);

    const smooth = applyContinuousMapping(
      { ...mapping, smoothing: "heavy" },
      message(127),
      0,
      createMappingRuntime(),
    );
    expect(smooth.value).toBeGreaterThan(0);
    expect(smooth.value).toBeLessThan(30);
  });

  it("waits for pickup, then tracks after crossing", () => {
    const runtime = createMappingRuntime();
    const pickup = { ...mapping, takeover: "pickup" as const };
    expect(
      applyContinuousMapping(pickup, message(0), 75, runtime),
    ).toMatchObject({ value: null, waitingForPickup: true });
    expect(
      applyContinuousMapping(pickup, message(100), 75, runtime).value,
    ).not.toBeNull();
  });

  it("detects same-source conflicts", () => {
    expect(
      findMappingConflicts([mapping], {
        ...mapping,
        id: "map-2",
        target: "glow",
      }),
    ).toEqual([mapping]);
  });

  it("triggers button actions only on the rising edge", () => {
    expect(shouldTriggerMidiAction(0, 127)).toBe(true);
    expect(shouldTriggerMidiAction(127, 127)).toBe(false);
    expect(shouldTriggerMidiAction(127, 0)).toBe(false);
  });

  it("supports centered momentary pitch modulation", () => {
    const runtime = createMappingRuntime();
    const pitch = {
      ...mapping,
      source: "pitchbend" as const,
      controller: null,
      pitchMode: "momentary" as const,
      outputMin: 0,
      outputMax: 100,
    };
    const centered = applyContinuousMapping(
      pitch,
      { ...message(64), source: "pitchbend", controller: null },
      40,
      runtime,
    );
    expect(centered.value).toBeCloseTo(40, 0);
    const raised = applyContinuousMapping(
      pitch,
      { ...message(127), source: "pitchbend", controller: null },
      40,
      runtime,
    );
    expect(raised.value).toBeGreaterThan(80);
  });

  it("persists profiles by their device identity", () => {
    const profiles: MidiMappingProfile[] = [
      {
        id: "profile-a",
        name: "Controller A",
        deviceId: "controller-a",
        deviceName: "Controller A",
        mappings: [mapping],
      },
      {
        id: "profile-b",
        name: "Controller B",
        deviceId: "controller-b",
        deviceName: "Controller B",
        mappings: [],
      },
    ];
    saveMappingProfiles(profiles);
    expect(loadMappingProfiles()).toEqual(profiles);
    expect(
      loadMappingProfiles().find(
        (profile) => profile.deviceId === "controller-b",
      )?.mappings,
    ).toEqual([]);
  });

  it("exports and imports mapping JSON", () => {
    const profiles: MidiMappingProfile[] = [
      {
        id: "profile-a",
        name: "Stage",
        deviceId: "controller-a",
        deviceName: "Controller A",
        mappings: [mapping],
      },
    ];
    expect(importMappingProfiles(exportMappingProfiles(profiles))).toEqual(
      profiles,
    );
  });

  it("keeps mapping profiles unchanged while visual recipes change", () => {
    const profile: MidiMappingProfile = {
      id: "profile-a",
      name: "Stage",
      deviceId: "controller-a",
      deviceName: "Controller A",
      mappings: [mapping],
    };
    saveMappingProfiles([profile]);
    // Presets and Surprise Me update visual parameters in a separate store.
    localStorage.setItem(
      "music-bloom-settings-v1",
      JSON.stringify({ params: { density: 88 } }),
    );
    expect(loadMappingProfiles()).toEqual([profile]);
  });
});
