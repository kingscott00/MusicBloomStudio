import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpPanel } from "./components/HelpPanel";
import { Icon } from "./components/Icon";
import { MidiPanel } from "./components/MidiPanel";
import { MidiPerformanceControls } from "./components/MidiPerformanceControls";
import { PerformanceDisplay } from "./components/PerformanceDisplay";
import { PianoKeyboard } from "./components/PianoKeyboard";
import { PresetBrowser } from "./components/PresetBrowser";
import {
  VisualCanvas,
  type VisualCanvasHandle,
} from "./components/VisualCanvas";
import { VisualControls } from "./components/VisualControls";
import { VisualLaboratory } from "./components/VisualLaboratory";
import { useMidi } from "./hooks/useMidi";
import { useMidiMappings } from "./hooks/useMidiMappings";
import { usePerformance } from "./hooks/usePerformance";
import { useVisualLaboratory } from "./hooks/useVisualLaboratory";
import { devSimulationFromSearch } from "./music/devSimulation";
import {
  builtInPresets,
  defaultParams,
  loadCustomPresets,
  saveCustomPresets,
} from "./presets/presets";
import {
  createRandomizedParameters,
  defaultRandomizerLocks,
  loadRandomizerLocks,
  randomSeed,
  saveRandomizerLocks,
} from "./presets/randomizer";
import type {
  MidiActionTarget,
  MidiControlMessage,
  Preset,
  RandomizerLock,
  RenderMetrics,
  VisualParameters,
} from "./types";
import { experiences } from "./visuals/experiences";

const SETTINGS_KEY = "music-bloom-settings-v1";
const FAVORITES_KEY = "music-bloom-favorite-presets-v1";
const LAB_GUIDE_KEY = "music-bloom-laboratory-guide-v1";

function loadSettings(): { params: VisualParameters; preferFlats: boolean } {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as {
      params?: Partial<VisualParameters>;
      preferFlats?: boolean;
    };
    return {
      params: {
        ...defaultParams,
        ...stored.params,
        reducedMotion:
          stored.params?.reducedMotion ??
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      },
      preferFlats: stored.preferFlats ?? false,
    };
  } catch {
    return { params: defaultParams, preferFlats: false };
  }
}

export default function App() {
  const settings = useMemo(loadSettings, []);
  const [params, setParams] = useState(settings.params);
  const [preferFlats, setPreferFlats] = useState(settings.preferFlats);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [labGuideOpen, setLabGuideOpen] = useState(false);
  const [cleanView, setCleanView] = useState(false);
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem(FAVORITES_KEY) ?? "[]",
      ) as unknown;
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [randomizerLocks, setRandomizerLocks] = useState(loadRandomizerLocks);
  const [activePreset, setActivePreset] = useState("moonlit-bloom");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [renderMetrics, setRenderMetrics] = useState<RenderMetrics>({
    fps: 0,
    frameCostMs: 0,
    activeElements: 0,
    qualityScale: 0.86,
    qualityLabel: "Auto 86%",
    heldNotes: 0,
    chordRoot: null,
    chordQuality: "none",
    attackEnergy: 0,
    heldEnergy: 0,
    releaseEnergy: 0,
    sustainEnergy: 0,
    attackingNotes: 0,
    heldPhaseNotes: 0,
    sustainedNotes: 0,
    releasingNotes: 0,
    longestHeldDuration: 0,
    simulatedSustain: false,
    physicalSustain: false,
    activeModulationRoutes: 0,
    dualRender: false,
    laboratoryFrameCostMs: 0,
  });
  const canvasRef = useRef<VisualCanvasHandle>(null);
  const stageRef = useRef<HTMLElement>(null);
  const midiControlHandlerRef = useRef<(message: MidiControlMessage) => void>(
    () => undefined,
  );
  const midiActionHandlerRef = useRef<(action: MidiActionTarget) => void>(
    () => undefined,
  );
  const updateParams = useCallback((changes: Partial<VisualParameters>) => {
    setParams((current) => ({ ...current, ...changes }));
    setActivePreset("");
  }, []);
  const replaceParams = useCallback((next: VisualParameters) => {
    setParams(next);
    setActivePreset("");
  }, []);
  const laboratory = useVisualLaboratory(
    params,
    replaceParams,
    randomizerLocks,
  );
  const performance = usePerformance(preferFlats);
  const devNoteOn = performance.noteOn;
  const devNoteOff = performance.noteOff;
  const devSetSustain = performance.setSimulatedSustain;
  const midi = useMidi({
    onNote: performance.sendEvent,
    onSustain: performance.setPhysicalSustain,
    onControl: (message) => midiControlHandlerRef.current(message),
    onDisconnect: () => {
      performance.clearSource("midi");
      performance.setPhysicalSustain(false);
    },
  });
  const selectedMidiDevice = midi.devices.find(
    (device) => device.id === midi.selectedId,
  );
  const midiMappings = useMidiMappings({
    params,
    selectedDevice: selectedMidiDevice,
    onParameterChange: laboratory.isOpen
      ? (changes) => laboratory.updateShared(changes, "MIDI parameter")
      : updateParams,
    onAction: (action) => midiActionHandlerRef.current(action),
    laboratoryValues: {
      morph: laboratory.state.morph,
      ...Object.fromEntries(
        laboratory.state.macros.map((macro) => [macro.id, macro.value]),
      ),
    },
    onLaboratoryParameterChange: laboratory.setMidiParameter,
  });
  midiControlHandlerRef.current = midiMappings.handleControl;
  const allPresets = useMemo(
    () => [...builtInPresets, ...customPresets],
    [customPresets],
  );

  useEffect(() => {
    const simulation = devSimulationFromSearch(window.location.search);
    if (!simulation.notes.length) return;
    const timers: number[] = [];
    let disposed = false;
    let started = false;
    // Deferring one microtask prevents React Strict Mode's development-only
    // effect rehearsal from creating a phantom release before the real run.
    queueMicrotask(() => {
      if (disposed) return;
      started = true;
      if (simulation.sustain) devSetSustain(true);
      for (const note of simulation.notes)
        devNoteOn(note, simulation.velocity, "screen");
      if (simulation.duration !== null) {
        timers.push(
          window.setTimeout(() => {
            for (const note of simulation.notes) devNoteOff(note, "screen");
          }, simulation.duration),
        );
      }
      if (simulation.sustain && simulation.pedalUp !== null) {
        timers.push(
          window.setTimeout(() => devSetSustain(false), simulation.pedalUp),
        );
      }
    });
    return () => {
      disposed = true;
      for (const timer of timers) window.clearTimeout(timer);
      if (started) {
        for (const note of simulation.notes) devNoteOff(note, "screen");
        if (simulation.sustain) devSetSustain(false);
      }
    };
  }, [devNoteOff, devNoteOn, devSetSustain]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ params, preferFlats }));
  }, [params, preferFlats]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    saveRandomizerLocks(randomizerLocks);
  }, [randomizerLocks]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCleanView(false);
        setHelpOpen(false);
      }
    };
    const fullscreenChange = () => {
      if (!document.fullscreenElement) setCleanView(false);
    };
    window.addEventListener("keydown", keyDown);
    document.addEventListener("fullscreenchange", fullscreenChange);
    return () => {
      window.removeEventListener("keydown", keyDown);
      document.removeEventListener("fullscreenchange", fullscreenChange);
    };
  }, []);

  const applyPreset = (preset: Preset) => {
    setParams({
      ...preset.params,
      reducedMotion: params.reducedMotion,
      quality: params.quality,
    });
    setActivePreset(preset.id);
    canvasRef.current?.reset();
    midiMappings.armPickup();
  };

  const savePreset = (name: string) => {
    const next: Preset = {
      id: `custom-${Date.now().toString(36)}`,
      name,
      builtIn: false,
      params: { ...params },
    };
    setCustomPresets((current) => {
      const updated = [...current, next];
      saveCustomPresets(updated);
      return updated;
    });
    setActivePreset(next.id);
  };

  const renamePreset = (id: string, name: string) =>
    setCustomPresets((current) => {
      const updated = current.map((preset) =>
        preset.id === id ? { ...preset, name } : preset,
      );
      saveCustomPresets(updated);
      return updated;
    });

  const deletePreset = (id: string) =>
    setCustomPresets((current) => {
      const updated = current.filter((preset) => preset.id !== id);
      saveCustomPresets(updated);
      if (activePreset === id) setActivePreset("");
      setFavoriteIds((favorites) =>
        favorites.filter((favoriteId) => favoriteId !== id),
      );
      return updated;
    });

  const resetVisuals = () => {
    setParams({ ...defaultParams, reducedMotion: params.reducedMotion });
    setActivePreset("moonlit-bloom");
    canvasRef.current?.reset();
    midiMappings.armPickup();
  };

  const randomizeVisuals = (requestedSeed?: number) => {
    const seed = requestedSeed ?? randomSeed();
    setParams((current) =>
      createRandomizedParameters(
        current,
        seed,
        randomizerLocks,
        laboratory.state.customPalettes.map((palette) => palette.id),
      ),
    );
    setActivePreset("");
    canvasRef.current?.reset();
    midiMappings.armPickup();
  };

  const movePreset = (direction: -1 | 1) => {
    const currentIndex = allPresets.findIndex(
      (preset) => preset.id === activePreset,
    );
    const start = currentIndex >= 0 ? currentIndex : 0;
    const next =
      allPresets[(start + direction + allPresets.length) % allPresets.length];
    if (next) applyPreset(next);
  };

  const moveExperience = (direction: -1 | 1) => {
    const currentIndex = experiences.findIndex(
      (experience) => experience.id === params.mode,
    );
    const next =
      experiences[
        (currentIndex + direction + experiences.length) % experiences.length
      ];
    if (next) {
      updateParams({ mode: next.id });
      canvasRef.current?.reset();
      midiMappings.armPickup();
    }
  };

  const moveInstrument = (direction: -1 | 1) => {
    const currentIndex = laboratory.instruments.findIndex(
      (instrument) => instrument.id === laboratory.currentInstrumentId,
    );
    const start = currentIndex >= 0 ? currentIndex : 0;
    const next =
      laboratory.instruments[
        (start + direction + laboratory.instruments.length) %
          laboratory.instruments.length
      ];
    if (next) laboratory.loadInstrument(next);
  };

  midiActionHandlerRef.current = (action) => {
    const actions: Record<MidiActionTarget, () => void> = {
      surprise: () => randomizeVisuals(),
      "previous-preset": () => movePreset(-1),
      "next-preset": () => movePreset(1),
      "previous-experience": () => moveExperience(-1),
      "next-experience": () => moveExperience(1),
      reset: resetVisuals,
      "previous-instrument": () => moveInstrument(-1),
      "next-instrument": () => moveInstrument(1),
      mutate: () => laboratory.mutate(laboratory.state.mutationStrength),
      "load-scene-a": () => laboratory.restoreScene("A"),
      "load-scene-b": () => laboratory.restoreScene("B"),
    };
    actions[action]();
  };

  const enterFullscreen = async () => {
    setCleanView(true);
    try {
      await stageRef.current?.requestFullscreen();
    } catch {
      // The artwork-only clean view still works when the browser blocks fullscreen.
    }
  };

  const openLaboratory = () => {
    laboratory.open();
    if (localStorage.getItem(LAB_GUIDE_KEY) !== "seen") setLabGuideOpen(true);
  };

  const closeLabGuide = () => {
    localStorage.setItem(LAB_GUIDE_KEY, "seen");
    setLabGuideOpen(false);
  };

  return (
    <main
      className={`studio ${cleanView ? "clean-view" : ""} ${laboratory.isOpen ? "lab-open" : ""}`}
    >
      <section className="art-stage" ref={stageRef}>
        <VisualCanvas
          ref={canvasRef}
          music={performance.music}
          params={params}
          physicalSustain={performance.physicalSustain}
          simulatedSustain={performance.simulatedSustain}
          onMetrics={diagnosticsOpen ? setRenderMetrics : undefined}
          laboratory={laboratory.renderState}
        />
        <div className="canvas-vignette" aria-hidden="true" />

        <header className="topbar app-chrome">
          <a className="brand" href="#top" aria-label="Music Bloom Studio home">
            <span className="brand-mark">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              <b>Music Bloom</b>
              <small>STUDIO</small>
            </span>
          </a>
          <nav className="top-actions" aria-label="Artwork actions">
            <button
              className="toolbar-button laboratory-entry"
              onClick={openLaboratory}
              title="Open the advanced instrument builder"
            >
              <span aria-hidden="true">✦</span>
              <span>Open Visual Laboratory</span>
            </button>
            <button
              className="toolbar-button"
              onClick={() => canvasRef.current?.savePng()}
              title="Save current artwork as PNG"
            >
              <Icon name="camera" />
              <span>Save frame</span>
            </button>
            <button
              className="toolbar-button"
              onClick={() => setCleanView(true)}
              title="Hide the interface"
            >
              <Icon name="eye" />
              <span>Clean view</span>
            </button>
            <button
              className="toolbar-button"
              onClick={enterFullscreen}
              title="Enter full-screen artwork mode"
            >
              <Icon name="fullscreen" />
              <span>Fullscreen</span>
            </button>
            <button
              className="icon-button"
              onClick={() => setHelpOpen(true)}
              aria-label="Open help"
            >
              <Icon name="help" />
            </button>
          </nav>
        </header>

        <div className="left-rail app-chrome">
          <MidiPanel
            {...midi}
            onRequest={midi.requestAccess}
            onSelect={midi.selectDevice}
          />
          <MidiPerformanceControls
            device={selectedMidiDevice}
            controller={midiMappings}
            showDeveloperSimulator={
              import.meta.env.DEV &&
              new URLSearchParams(window.location.search).has("midi-sim")
            }
          />
          <PerformanceDisplay
            music={performance.music}
            preferFlats={preferFlats}
          />
          <label className="notation-toggle glass-card">
            <span>Note spelling</span>
            <select
              value={preferFlats ? "flats" : "sharps"}
              onChange={(event) =>
                setPreferFlats(event.target.value === "flats")
              }
            >
              <option value="sharps">Sharps · F♯</option>
              <option value="flats">Flats · G♭</option>
            </select>
          </label>
        </div>

        <aside
          className={`right-rail app-chrome ${controlsOpen ? "" : "collapsed"}`}
        >
          <button
            className="rail-toggle"
            onClick={() => setControlsOpen((open) => !open)}
            aria-expanded={controlsOpen}
          >
            <Icon name="sliders" />{" "}
            <span>{controlsOpen ? "Hide controls" : "Show controls"}</span>
          </button>
          {controlsOpen && (
            <VisualControls
              params={params}
              onChange={updateParams}
              onReset={resetVisuals}
              metrics={renderMetrics}
              diagnosticsOpen={diagnosticsOpen}
              onDiagnosticsChange={setDiagnosticsOpen}
              onRandomize={randomizeVisuals}
              randomizerLocks={randomizerLocks}
              onRandomizerLockChange={(lock: RandomizerLock, value: boolean) =>
                setRandomizerLocks((current) => ({
                  ...current,
                  [lock]: value,
                }))
              }
              onClearRandomizerLocks={() =>
                setRandomizerLocks(defaultRandomizerLocks)
              }
              availablePalettes={laboratory.palettes}
            />
          )}
        </aside>

        <div
          className={`preset-dock app-chrome ${presetsOpen ? "" : "collapsed"}`}
        >
          <button
            className="dock-toggle"
            onClick={() => setPresetsOpen((open) => !open)}
            aria-expanded={presetsOpen}
          >
            <Icon name="presets" size={16} />{" "}
            {presetsOpen ? "Hide presets" : "Show presets"}
          </button>
          {presetsOpen && (
            <PresetBrowser
              presets={allPresets}
              activeId={activePreset}
              onApply={applyPreset}
              onSave={savePreset}
              onRename={renamePreset}
              onDelete={deletePreset}
              favoriteIds={favoriteIds}
              onToggleFavorite={(id) =>
                setFavoriteIds((current) =>
                  current.includes(id)
                    ? current.filter((favoriteId) => favoriteId !== id)
                    : [...current, id],
                )
              }
            />
          )}
        </div>

        <div
          className={`keyboard-dock app-chrome ${keyboardOpen ? "" : "collapsed"}`}
        >
          <button
            className="keyboard-toggle"
            onClick={() => setKeyboardOpen((open) => !open)}
            aria-expanded={keyboardOpen}
          >
            <Icon name="keyboard" size={16} />{" "}
            {keyboardOpen ? "Hide piano" : "Open piano"}
          </button>
          {keyboardOpen && (
            <PianoKeyboard
              music={performance.music}
              onNoteOn={performance.noteOn}
              onNoteOff={performance.noteOff}
              onSustain={performance.setSimulatedSustain}
              simulatedSustain={performance.simulatedSustain}
            />
          )}
        </div>

        {cleanView && (
          <button className="exit-clean" onClick={() => setCleanView(false)}>
            <Icon name="close" size={16} /> Exit clean view <kbd>Esc</kbd>
          </button>
        )}
        {cleanView &&
          laboratory.currentInstrument &&
          laboratory.state.overlayEnabled && (
            <div className="performance-overlay">
              <span>{laboratory.currentInstrument.name}</span>
              <b>{Math.round(laboratory.state.morph)}% Morph</b>
              <div>
                {laboratory.state.macros.map((macro) => (
                  <i key={macro.id}>
                    {macro.name} {Math.round(macro.value)}
                  </i>
                ))}
              </div>
            </div>
          )}
        {midiMappings.feedbackEnabled && midiMappings.feedback && (
          <div
            className="midi-value-overlay"
            key={midiMappings.feedback.id}
            aria-live="polite"
          >
            <span>{midiMappings.feedback.label}</span>
            <b>{midiMappings.feedback.value}</b>
          </div>
        )}
      </section>
      {laboratory.isOpen && (
        <VisualLaboratory
          controller={laboratory}
          params={params}
          onMidiLearn={midiMappings.beginLearn}
          onShowGuide={() => setLabGuideOpen(true)}
        />
      )}
      <HelpPanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onOpenLaboratoryGuide={() => {
          openLaboratory();
          setLabGuideOpen(true);
        }}
      />
      {labGuideOpen && <LaboratoryGuide onClose={closeLabGuide} />}
    </main>
  );
}

function LaboratoryGuide({ onClose }: { onClose: () => void }) {
  const steps = [
    ["Choose", "Select an experience and shape its distinctive visual laws."],
    [
      "Capture",
      "Capture the current design into Scene A, then create Scene B.",
    ],
    [
      "Morph",
      "Move continuously between the two scenes while notes stay alive.",
    ],
    [
      "Assign",
      "Give a macro one or more targets, ranges, and response curves.",
    ],
    ["Modulate", "Add gentle automatic or music-derived evolution."],
    ["Save", "Store the complete result as a playable Visual Instrument."],
  ];
  return (
    <div className="modal-backdrop lab-guide-backdrop">
      <section className="lab-guide" role="dialog" aria-modal="true">
        <span className="eyebrow">VISUAL LABORATORY · QUICK TOUR</span>
        <h2>Build a world you can perform.</h2>
        <p>
          MIDI notes, sustain, chord analysis, and lifecycle envelopes continue
          normally throughout the laboratory.
        </p>
        <ol>
          {steps.map(([title, description], index) => (
            <li key={title}>
              <span>{index + 1}</span>
              <div>
                <b>{title}</b>
                <small>{description}</small>
              </div>
            </li>
          ))}
        </ol>
        <button className="primary-button" onClick={onClose}>
          Enter the Laboratory
        </button>
      </section>
    </div>
  );
}
