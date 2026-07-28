import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpPanel } from "./components/HelpPanel";
import { Icon } from "./components/Icon";
import { MidiPanel } from "./components/MidiPanel";
import { PerformanceDisplay } from "./components/PerformanceDisplay";
import { PianoKeyboard } from "./components/PianoKeyboard";
import { PresetBrowser } from "./components/PresetBrowser";
import {
  VisualCanvas,
  type VisualCanvasHandle,
} from "./components/VisualCanvas";
import { VisualControls } from "./components/VisualControls";
import { useMidi } from "./hooks/useMidi";
import { usePerformance } from "./hooks/usePerformance";
import { devNotesFromSearch } from "./music/devSimulation";
import {
  builtInPresets,
  defaultParams,
  loadCustomPresets,
  saveCustomPresets,
} from "./presets/presets";
import type { Preset, RenderMetrics, VisualParameters } from "./types";

const SETTINGS_KEY = "music-bloom-settings-v1";

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
  const [cleanView, setCleanView] = useState(false);
  const [customPresets, setCustomPresets] = useState(loadCustomPresets);
  const [activePreset, setActivePreset] = useState("moonlit-bloom");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [renderMetrics, setRenderMetrics] = useState<RenderMetrics>({
    fps: 0,
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
  });
  const canvasRef = useRef<VisualCanvasHandle>(null);
  const stageRef = useRef<HTMLElement>(null);
  const performance = usePerformance(preferFlats);
  const devNoteOn = performance.noteOn;
  const devNoteOff = performance.noteOff;
  const midi = useMidi({
    onNote: performance.sendEvent,
    onSustain: performance.sustain,
    onDisconnect: () => {
      performance.clearSource("midi");
      performance.sustain(false);
    },
  });
  const allPresets = useMemo(
    () => [...builtInPresets, ...customPresets],
    [customPresets],
  );

  useEffect(() => {
    const devNotes = devNotesFromSearch(window.location.search);
    if (!devNotes.length) return;
    for (const note of devNotes) devNoteOn(note, 104, "screen");
    return () => {
      for (const note of devNotes) devNoteOff(note, "screen");
    };
  }, [devNoteOff, devNoteOn]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ params, preferFlats }));
  }, [params, preferFlats]);

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

  const updateParams = useCallback((changes: Partial<VisualParameters>) => {
    setParams((current) => ({ ...current, ...changes }));
    setActivePreset("");
  }, []);

  const applyPreset = (preset: Preset) => {
    setParams({ ...preset.params, reducedMotion: params.reducedMotion });
    setActivePreset(preset.id);
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
      return updated;
    });

  const resetVisuals = () => {
    setParams({ ...defaultParams, reducedMotion: params.reducedMotion });
    setActivePreset("moonlit-bloom");
    canvasRef.current?.reset();
  };

  const enterFullscreen = async () => {
    setCleanView(true);
    try {
      await stageRef.current?.requestFullscreen();
    } catch {
      // The artwork-only clean view still works when the browser blocks fullscreen.
    }
  };

  return (
    <main className={`studio ${cleanView ? "clean-view" : ""}`}>
      <section className="art-stage" ref={stageRef}>
        <VisualCanvas
          ref={canvasRef}
          music={performance.music}
          params={params}
          onMetrics={diagnosticsOpen ? setRenderMetrics : undefined}
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
            />
          )}
        </div>

        {cleanView && (
          <button className="exit-clean" onClick={() => setCleanView(false)}>
            <Icon name="close" size={16} /> Exit clean view <kbd>Esc</kbd>
          </button>
        )}
      </section>
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
