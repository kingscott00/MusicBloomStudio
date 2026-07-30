import { useEffect, useMemo, useRef, useState } from "react";
import type { MidiLearnTarget } from "../hooks/useMidiMappings";
import type { VisualLaboratoryController } from "../hooks/useVisualLaboratory";
import { definitionsForMode } from "../lab/definitions";
import { transformPalette } from "../lab/paletteLab";
import type {
  LfoShape,
  MacroAssignment,
  MacroCurve,
  ModulationPolarity,
  ModulationRoute,
  ModulationSource,
  MutationStrength,
  SurpriseScope,
} from "../lab/types";
import { palettes as builtInPalettes } from "../presets/palettes";
import type { ColorPalette, VisualParameters } from "../types";
import { experiences } from "../visuals/experiences";
import { Icon } from "./Icon";
import { PaletteColorPicker } from "./PaletteColorPicker";

interface Props {
  controller: VisualLaboratoryController;
  params: VisualParameters;
  onMidiLearn: (target: MidiLearnTarget) => void;
  onShowGuide: () => void;
}

type LabTab =
  "design" | "scenes" | "macros" | "modulation" | "instruments" | "palette";

const sharedControls: Array<{
  key: keyof VisualParameters;
  label: string;
  min?: number;
  max?: number;
}> = [
  { key: "density", label: "Density" },
  { key: "speed", label: "Speed" },
  { key: "rotation", label: "Rotation" },
  { key: "symmetry", label: "Symmetry", min: 3, max: 14 },
  { key: "trails", label: "Trails" },
  { key: "glow", label: "Glow" },
  { key: "bloom", label: "Bloom" },
  { key: "background", label: "Background" },
];

const macroCurves: MacroCurve[] = ["linear", "ease-in", "ease-out", "s-curve"];
const modulationSources: ModulationSource[] = [
  "lfo-slow",
  "lfo-medium",
  "lfo-fast",
  "random-drift",
  "velocity",
  "register",
  "held-count",
  "rhythm",
  "tension",
  "attack",
  "held",
  "release",
  "sustain",
];
const lfoShapes: LfoShape[] = [
  "sine",
  "triangle",
  "saw",
  "square",
  "smooth-random",
];

export function VisualLaboratory({
  controller,
  params,
  onMidiLearn,
  onShowGuide,
}: Props) {
  const [tab, setTab] = useState<LabTab>("design");
  const [surpriseScope, setSurpriseScope] = useState<SurpriseScope>(
    controller.state.surpriseScope,
  );
  const [seedCopied, setSeedCopied] = useState(false);
  const tabs: Array<[LabTab, string]> = [
    ["design", "Design"],
    ["scenes", "A/B Scenes"],
    ["macros", "Macros"],
    ["modulation", "Modulation"],
    ["instruments", "Instruments"],
    ["palette", "Color"],
  ];

  return (
    <div className="laboratory app-chrome" aria-label="Visual Laboratory">
      <header className="lab-toolbar">
        <div className="lab-title">
          <button
            className="icon-button"
            onClick={controller.close}
            aria-label="Leave Visual Laboratory"
          >
            <Icon name="close" />
          </button>
          <span>
            <small>ADVANCED WORKSPACE</small>
            <b>Visual Laboratory</b>
          </span>
          {controller.dirty && <i className="unsaved-dot">Unsaved</i>}
        </div>
        <div className="lab-scene-compact">
          <button onClick={() => controller.restoreScene("A")}>Scene A</button>
          <label>
            <span>{Math.round(controller.state.morph)}% Morph</span>
            <input
              aria-label="Morph between Scene A and Scene B"
              type="range"
              min="0"
              max="100"
              value={controller.state.morph}
              onChange={(event) =>
                controller.setMorph(Number(event.target.value))
              }
            />
          </label>
          <button onClick={() => controller.restoreScene("B")}>Scene B</button>
          <button
            className="midi-learn-mini"
            onClick={() =>
              onMidiLearn({
                type: "parameter",
                target: "morph",
                label: "Morph",
              })
            }
            title="Map a MIDI controller to Morph"
          >
            MIDI
          </button>
        </div>
        <div className="lab-toolbar-actions">
          <div className="surprise-controls">
            <select
              aria-label="Surprise scope"
              value={surpriseScope}
              onChange={(event) =>
                setSurpriseScope(event.target.value as SurpriseScope)
              }
            >
              <option value="current-scene">Current Scene</option>
              <option value="full-instrument">Full Instrument</option>
            </select>
            <button
              className="surprise-button"
              onClick={() => controller.surprise(surpriseScope)}
              title="Creates one undoable, unsaved design without overwriting instruments"
            >
              Surprise Me
            </button>
            <details className="surprise-recipe">
              <summary>Seed {controller.state.surpriseSeed}</summary>
              <div>
                <small>
                  {controller.state.surpriseScope === "full-instrument"
                    ? "Full Instrument"
                    : "Current Scene"}{" "}
                  · respects locks · one Undo
                </small>
                <button
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(String(controller.state.surpriseSeed))
                      .then(() => {
                        setSeedCopied(true);
                        window.setTimeout(() => setSeedCopied(false), 1200);
                      })
                      .catch(() => setSeedCopied(false));
                  }}
                >
                  {seedCopied ? "Copied" : "Copy Seed"}
                </button>
                <button
                  onClick={() =>
                    controller.surprise(
                      controller.state.surpriseScope,
                      controller.state.surpriseSeed,
                    )
                  }
                >
                  Replay Seed
                </button>
                <button onClick={() => controller.surprise(surpriseScope)}>
                  New Seed
                </button>
              </div>
            </details>
          </div>
          <button
            onClick={controller.undo}
            disabled={controller.history.index <= 0}
          >
            Undo
          </button>
          <button
            onClick={controller.redo}
            disabled={
              controller.history.index >= controller.history.entries.length - 1
            }
          >
            Redo
          </button>
          <button onClick={onShowGuide} title="Open the laboratory guide">
            Guide
          </button>
          <button
            className="primary-button"
            onClick={() => {
              const name = window.prompt("Name this Visual Instrument");
              if (name?.trim()) controller.saveNew(name.trim());
            }}
          >
            Save Instrument
          </button>
        </div>
      </header>

      <aside className="lab-panel glass-card">
        <nav className="lab-tabs" aria-label="Laboratory sections">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="lab-panel-scroll">
          {tab === "design" && (
            <DesignTab controller={controller} params={params} />
          )}
          {tab === "scenes" && <ScenesTab controller={controller} />}
          {tab === "macros" && (
            <MacrosTab
              controller={controller}
              mode={params.mode}
              onMidiLearn={onMidiLearn}
            />
          )}
          {tab === "modulation" && (
            <ModulationTab controller={controller} mode={params.mode} />
          )}
          {tab === "instruments" && <InstrumentsTab controller={controller} />}
          {tab === "palette" && (
            <PaletteTab controller={controller} params={params} />
          )}
        </div>
      </aside>

      <div className="lab-performance-strip">
        {controller.state.macros.map((macro, index) => (
          <label
            key={macro.id}
            title={`${macro.assignments.length} assignments`}
          >
            <span>
              {macro.name}
              <button
                onClick={() =>
                  onMidiLearn({
                    type: "parameter",
                    target: `macro-${index + 1}` as MidiLearnTarget["target"],
                    label: macro.name,
                  })
                }
              >
                MIDI
              </button>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={macro.value}
              onChange={(event) => {
                const macros = controller.state.macros.map((item) =>
                  item.id === macro.id
                    ? { ...item, value: Number(event.target.value) }
                    : item,
                );
                controller.setMacros(macros, "Macro performance", macro.id);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function DesignTab({
  controller,
  params,
}: {
  controller: VisualLaboratoryController;
  params: VisualParameters;
}) {
  const definitions = definitionsForMode(params.mode);
  return (
    <>
      <LabHeading
        title="Experience laws"
        description="Shape the visual grammar while your notes remain live."
      />
      <div className="lab-experience-grid">
        {experiences.map((experience) => (
          <button
            key={experience.id}
            className={params.mode === experience.id ? "active" : ""}
            onClick={() =>
              controller.updateShared(
                { mode: experience.id },
                `Changed to ${experience.name}`,
              )
            }
          >
            <b>{experience.name}</b>
            <small>{experience.description}</small>
          </button>
        ))}
      </div>
      <details open className="lab-group">
        <summary>Core</summary>
        <div className="lab-range-grid">
          {sharedControls.map(({ key, label, min = 0, max = 100 }) => (
            <Range
              key={key}
              label={label}
              min={min}
              max={max}
              value={params[key] as number}
              onChange={(value) => controller.updateShared({ [key]: value })}
            />
          ))}
        </div>
      </details>
      {["Form", "Motion", "Light", "Composition", "Musical Response"].map(
        (group) => {
          const items = definitions.filter((item) => item.group === group);
          if (!items.length) return null;
          return (
            <details open={group === "Form"} className="lab-group" key={group}>
              <summary>{group}</summary>
              {items.map((item) => (
                <Range
                  key={item.id}
                  label={item.label}
                  description={item.description}
                  value={
                    controller.state.currentAdvanced[item.id] ??
                    item.defaultValue
                  }
                  onChange={(value) =>
                    controller.updateAdvanced(item.id, value)
                  }
                />
              ))}
            </details>
          );
        },
      )}
      <details className="lab-group">
        <summary>Musical response</summary>
        {(
          Object.keys(controller.state.response) as Array<
            keyof typeof controller.state.response
          >
        ).map((key) => (
          <Range
            key={key}
            label={`${key[0].toUpperCase()}${key.slice(1)} influence`}
            value={controller.state.response[key]}
            onChange={(value) => controller.updateResponse(key, value)}
          />
        ))}
      </details>
    </>
  );
}

function ScenesTab({ controller }: { controller: VisualLaboratoryController }) {
  const { sceneA, sceneB } = controller.state;
  return (
    <>
      <LabHeading
        title="Two complete worlds"
        description="Capture explicitly, then morph continuously without interrupting notes."
      />
      <div className="scene-cards">
        {(["A", "B"] as const).map((slot) => {
          const scene = slot === "A" ? sceneA : sceneB;
          return (
            <article
              key={slot}
              className={
                controller.state.editScene === slot
                  ? "scene-card active"
                  : "scene-card"
              }
            >
              <span>SCENE {slot}</span>
              <b>
                {
                  experiences.find((item) => item.id === scene.params.mode)
                    ?.name
                }
              </b>
              <small>
                {scene.params.paletteId} · seed {scene.params.recipeSeed}
              </small>
              <div>
                <button onClick={() => controller.capture(slot)}>
                  Capture current
                </button>
                <button onClick={() => controller.restoreScene(slot)}>
                  Load
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <Range
        label="Morph"
        description="Equal-power crossfade for different experiences."
        value={controller.state.morph}
        onChange={controller.setMorph}
      />
      <div className="lab-action-grid">
        <button onClick={controller.swap}>Swap A / B</button>
        <button onClick={() => controller.copy("A")}>Copy A → B</button>
        <button onClick={() => controller.copy("B")}>Copy B → A</button>
        <button onClick={controller.returnToEntry}>
          Return to entry state
        </button>
      </div>
      <details open className="lab-group">
        <summary>Mutation</summary>
        <div className="mutation-row">
          <select
            value={controller.state.mutationStrength}
            onChange={(event) =>
              controller.mutate(event.target.value as MutationStrength, 0)
            }
            aria-label="Mutation strength"
          >
            <option value="subtle">Subtle</option>
            <option value="moderate">Moderate</option>
            <option value="wild">Wild</option>
          </select>
          <button
            className="primary-button"
            onClick={() => controller.mutate(controller.state.mutationStrength)}
          >
            Mutate
          </button>
          <button
            onClick={() =>
              controller.mutate(controller.state.mutationStrength, -1)
            }
          >
            Previous
          </button>
          <button
            onClick={() =>
              controller.mutate(controller.state.mutationStrength, 0)
            }
          >
            Reapply
          </button>
        </div>
        <small className="lab-meta">
          Recipe {controller.state.mutationSeed} · variation{" "}
          {controller.state.mutationIndex}
        </small>
      </details>
      <details className="lab-group">
        <summary>Recent history</summary>
        <ol className="history-list">
          {controller.history.entries
            .slice(Math.max(0, controller.history.entries.length - 8))
            .reverse()
            .map((entry) => (
              <li key={entry.id}>{entry.label}</li>
            ))}
        </ol>
      </details>
    </>
  );
}

function MacrosTab({
  controller,
  mode,
  onMidiLearn,
}: {
  controller: VisualLaboratoryController;
  mode: VisualParameters["mode"];
  onMidiLearn: (target: MidiLearnTarget) => void;
}) {
  const targets = targetOptions(mode);
  const patchMacro = (
    index: number,
    changes: Partial<(typeof controller.state.macros)[number]>,
  ) =>
    controller.setMacros(
      controller.state.macros.map((macro, macroIndex) =>
        macroIndex === index ? { ...macro, ...changes } : macro,
      ),
    );
  return (
    <>
      <LabHeading
        title="Performance macros"
        description="Each macro can move several shared and experience-specific controls."
      />
      {controller.state.macros.map((macro, index) => (
        <details className="macro-card" key={macro.id} open={index === 0}>
          <summary>
            <b>{macro.name}</b>
            <span>
              {Math.round(macro.value)}% · {macro.assignments.length} targets
            </span>
          </summary>
          <div className="macro-name-row">
            <input
              value={macro.name}
              aria-label={`Macro ${index + 1} name`}
              onChange={(event) =>
                patchMacro(index, { name: event.target.value })
              }
            />
            <button
              onClick={() =>
                onMidiLearn({
                  type: "parameter",
                  target: `macro-${index + 1}` as MidiLearnTarget["target"],
                  label: macro.name,
                })
              }
            >
              MIDI Learn
            </button>
          </div>
          <Range
            label="Macro value"
            value={macro.value}
            onChange={(value) => patchMacro(index, { value })}
          />
          {macro.assignments.map((assignment) => (
            <MacroAssignmentEditor
              key={assignment.id}
              assignment={assignment}
              targets={targets}
              onChange={(changes) =>
                patchMacro(index, {
                  assignments: macro.assignments.map((item) =>
                    item.id === assignment.id ? { ...item, ...changes } : item,
                  ),
                })
              }
              onRemove={() =>
                patchMacro(index, {
                  assignments: macro.assignments.filter(
                    (item) => item.id !== assignment.id,
                  ),
                })
              }
            />
          ))}
          <button
            className="add-route"
            onClick={() =>
              patchMacro(index, {
                assignments: [
                  ...macro.assignments,
                  {
                    id: `assignment-${Date.now().toString(36)}`,
                    target: targets[0][0],
                    min: 20,
                    max: 90,
                    invert: false,
                    curve: "s-curve",
                    weight: 100,
                  },
                ],
              })
            }
          >
            + Add target
          </button>
        </details>
      ))}
      <button onClick={controller.resetMacros}>Reset all macros</button>
    </>
  );
}

function MacroAssignmentEditor({
  assignment,
  targets,
  onChange,
  onRemove,
}: {
  assignment: MacroAssignment;
  targets: Array<[string, string]>;
  onChange: (changes: Partial<MacroAssignment>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="assignment-card">
      <select
        value={assignment.target}
        onChange={(event) => onChange({ target: event.target.value })}
      >
        {targets.map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
      <div className="assignment-grid">
        <label>
          Min{" "}
          <input
            type="number"
            min="0"
            max="100"
            value={assignment.min}
            onChange={(event) => onChange({ min: Number(event.target.value) })}
          />
        </label>
        <label>
          Max{" "}
          <input
            type="number"
            min="0"
            max="100"
            value={assignment.max}
            onChange={(event) => onChange({ max: Number(event.target.value) })}
          />
        </label>
        <label>
          Curve{" "}
          <select
            value={assignment.curve}
            onChange={(event) =>
              onChange({ curve: event.target.value as MacroCurve })
            }
          >
            {macroCurves.map((curve) => (
              <option key={curve}>{curve}</option>
            ))}
          </select>
        </label>
        <label>
          Weight{" "}
          <input
            type="number"
            min="0"
            max="100"
            value={assignment.weight}
            onChange={(event) =>
              onChange({ weight: Number(event.target.value) })
            }
          />
        </label>
      </div>
      <div className="assignment-actions">
        <label>
          <input
            type="checkbox"
            checked={assignment.invert}
            onChange={(event) => onChange({ invert: event.target.checked })}
          />{" "}
          Invert
        </label>
        <button onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}

function ModulationTab({
  controller,
  mode,
}: {
  controller: VisualLaboratoryController;
  mode: VisualParameters["mode"];
}) {
  const targets = [
    ...targetOptions(mode),
    ["morph", "Morph"],
    ...controller.state.macros.map((macro) => [
      macro.id,
      `Macro · ${macro.name}`,
    ]),
    ["palette-position", "Palette position"],
  ] as Array<[string, string]>;
  const updateRoute = (id: string, changes: Partial<ModulationRoute>) =>
    controller.setRoutes(
      controller.state.modulationRoutes.map((route) =>
        route.id === id ? { ...route, ...changes } : route,
      ),
    );
  return (
    <>
      <LabHeading
        title="Modulation"
        description="Automatic and music-derived movement. Routes are bounded for comfort and performance."
      />
      <div className="route-summary">
        <b>
          {
            controller.state.modulationRoutes.filter((route) => route.enabled)
              .length
          }
        </b>
        <span>active of 16 maximum</span>
      </div>
      {controller.state.modulationRoutes.map((route, index) => (
        <details className="route-card" key={route.id} open={index === 0}>
          <summary>
            <input
              type="checkbox"
              checked={route.enabled}
              onChange={(event) =>
                updateRoute(route.id, { enabled: event.target.checked })
              }
              onClick={(event) => event.stopPropagation()}
            />
            <b>{route.source.replaceAll("-", " ")}</b>
            <span>
              →{" "}
              {targets.find(([value]) => value === route.target)?.[1] ??
                route.target}
            </span>
          </summary>
          <div className="route-grid">
            <label>
              Source{" "}
              <select
                value={route.source}
                onChange={(event) =>
                  updateRoute(route.id, {
                    source: event.target.value as ModulationSource,
                  })
                }
              >
                {modulationSources.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            </label>
            <label>
              Shape{" "}
              <select
                value={route.shape}
                onChange={(event) =>
                  updateRoute(route.id, {
                    shape: event.target.value as LfoShape,
                  })
                }
              >
                {lfoShapes.map((shape) => (
                  <option key={shape}>{shape}</option>
                ))}
              </select>
            </label>
            <label>
              Target{" "}
              <select
                value={route.target}
                onChange={(event) =>
                  updateRoute(route.id, { target: event.target.value })
                }
              >
                {targets.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Polarity{" "}
              <select
                value={route.polarity}
                onChange={(event) =>
                  updateRoute(route.id, {
                    polarity: event.target.value as ModulationPolarity,
                  })
                }
              >
                <option value="unipolar">Unipolar</option>
                <option value="bipolar">Bipolar</option>
              </select>
            </label>
          </div>
          <Range
            label="Amount"
            min={-100}
            max={100}
            value={route.amount}
            onChange={(amount) => updateRoute(route.id, { amount })}
          />
          <Range
            label="Smoothing"
            value={route.smoothing}
            onChange={(smoothing) => updateRoute(route.id, { smoothing })}
          />
          <div className="route-bounds">
            <label>
              Minimum{" "}
              <input
                type="number"
                min="0"
                max="100"
                value={route.min}
                onChange={(event) =>
                  updateRoute(route.id, { min: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Maximum{" "}
              <input
                type="number"
                min="0"
                max="100"
                value={route.max}
                onChange={(event) =>
                  updateRoute(route.id, { max: Number(event.target.value) })
                }
              />
            </label>
            <button
              onClick={() =>
                controller.setRoutes(
                  controller.state.modulationRoutes.filter(
                    (item) => item.id !== route.id,
                  ),
                )
              }
            >
              Remove
            </button>
          </div>
        </details>
      ))}
      <button
        className="add-route primary-button"
        disabled={controller.state.modulationRoutes.length >= 16}
        onClick={() =>
          controller.setRoutes([
            ...controller.state.modulationRoutes,
            {
              id: `route-${Date.now().toString(36)}`,
              enabled: true,
              source: "lfo-slow",
              shape: "sine",
              target: "shared.rotation",
              amount: 18,
              polarity: "bipolar",
              smoothing: 60,
              min: 0,
              max: 100,
            },
          ])
        }
      >
        + Add modulation route
      </button>
    </>
  );
}

function InstrumentsTab({
  controller,
}: {
  controller: VisualLaboratoryController;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  return (
    <>
      <LabHeading
        title="Visual Instruments"
        description="Complete playable designs: scenes, morph, macros, modulation, and palette."
      />
      <div className="instrument-toolbar">
        <button
          className="primary-button"
          onClick={() => {
            const name = window.prompt("Name this Visual Instrument");
            if (name?.trim()) controller.saveNew(name.trim());
          }}
        >
          Save New
        </button>
        <button
          disabled={
            !controller.currentInstrument ||
            controller.currentInstrument.builtIn
          }
          onClick={controller.updateCurrent}
        >
          Update Current
        </button>
        <button
          onClick={() => {
            const name = window.prompt(
              "Save current design as",
              controller.currentInstrument
                ? `${controller.currentInstrument.name} Variation`
                : "New Visual Instrument",
            );
            if (name?.trim()) controller.saveNew(name.trim());
          }}
        >
          Save As
        </button>
        <button onClick={() => importRef.current?.click()}>Import JSON</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const item = controller.importJson(await file.text());
              setMessage(`Imported ${item.name}.`);
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Import failed.",
              );
            }
            event.target.value = "";
          }}
        />
      </div>
      <label className="instrument-overlay-toggle">
        <span>
          <b>Performance overlay</b>
          <small>
            Briefly show instrument, Morph, and macro values in Clean view.
          </small>
        </span>
        <input
          type="checkbox"
          checked={controller.state.overlayEnabled}
          onChange={(event) =>
            controller.setOverlayEnabled(event.target.checked)
          }
        />
      </label>
      {message && (
        <p className="lab-message" role="status">
          {message}
        </p>
      )}
      <div className="instrument-list">
        {[...controller.instruments]
          .sort((a, b) => Number(b.favorite) - Number(a.favorite))
          .map((instrument) => (
            <article
              key={instrument.id}
              className={
                controller.currentInstrumentId === instrument.id ? "active" : ""
              }
            >
              <button
                className="instrument-main"
                onClick={() => controller.loadInstrument(instrument)}
              >
                <span>{instrument.favorite ? "★" : "☆"}</span>
                <span>
                  <b>{instrument.name}</b>
                  <small>
                    {instrument.state.sceneA.params.mode}
                    {instrument.state.sceneA.params.mode !==
                    instrument.state.sceneB.params.mode
                      ? ` ↔ ${instrument.state.sceneB.params.mode}`
                      : ""}{" "}
                    · {instrument.mood ?? "custom"}
                  </small>
                </span>
              </button>
              <div className="instrument-actions">
                <button
                  onClick={() => controller.duplicateInstrument(instrument)}
                >
                  Duplicate
                </button>
                <button onClick={() => controller.exportInstrument(instrument)}>
                  Export
                </button>
                <button onClick={() => controller.toggleFavorite(instrument)}>
                  {instrument.favorite ? "Unfavorite" : "Favorite"}
                </button>
                {!instrument.builtIn && (
                  <>
                    <button
                      onClick={() => {
                        const name = window.prompt(
                          "Rename instrument",
                          instrument.name,
                        );
                        if (name?.trim())
                          controller.renameInstrument(
                            instrument.id,
                            name.trim(),
                          );
                      }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete ${instrument.name}?`))
                          controller.deleteInstrument(instrument.id);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
      </div>
    </>
  );
}

function PaletteTab({
  controller,
  params,
}: {
  controller: VisualLaboratoryController;
  params: VisualParameters;
}) {
  const allPalettes = controller.palettes;
  const { setPalettePreview } = controller;
  const editScene = controller.state.editScene;
  const source =
    allPalettes.find((palette) => palette.id === params.paletteId) ??
    allPalettes[0];
  const [draft, setDraft] = useState<ColorPalette>({
    ...source,
    colors: [...source.colors],
  });
  const [rotation, setRotation] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [temperature, setTemperature] = useState(0);
  const [editing, setEditing] = useState<
    { kind: "stop"; index: number } | { kind: "background" } | null
  >(null);
  const preview = useMemo(
    () =>
      transformPalette(draft, rotation, saturation, brightness, temperature),
    [brightness, draft, rotation, saturation, temperature],
  );
  useEffect(() => {
    setDraft({ ...source, colors: [...source.colors] });
    setRotation(0);
    setSaturation(100);
    setBrightness(100);
    setTemperature(0);
    setEditing(null);
  }, [source]);
  useEffect(() => {
    setPalettePreview({
      palette: preview,
      scene: editScene,
      sourcePaletteId: source.id,
    });
  }, [editScene, preview, setPalettePreview, source.id]);
  useEffect(() => () => setPalettePreview(null), [setPalettePreview]);

  const materialize = (
    nextDraft: ColorPalette,
    label = "Palette color edit",
  ) => {
    const transformed = transformPalette(
      nextDraft,
      rotation,
      saturation,
      brightness,
      temperature,
    );
    const saved = controller.commitPaletteEdit(transformed, source.id, label);
    setDraft(saved);
    setRotation(0);
    setSaturation(100);
    setBrightness(100);
    setTemperature(0);
    setEditing(null);
  };

  const save = () => {
    materialize(draft, "Saved custom palette");
  };

  return (
    <>
      <LabHeading
        title="Palette Laboratory"
        description="Build a compact, reusable color system without interrupting the artwork."
      />
      <label className="lab-field">
        Starting palette
        <select
          value={source.id}
          onChange={(event) => {
            const next = allPalettes.find(
              (palette) => palette.id === event.target.value,
            );
            if (next) {
              setEditing(null);
              controller.updateShared(
                { paletteId: next.id },
                "Palette selected",
              );
              setDraft({ ...next, colors: [...next.colors] });
            }
          }}
        >
          {allPalettes.map((palette) => (
            <option value={palette.id} key={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
      </label>
      <label className="lab-field">
        Palette name{" "}
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <div className="color-stop-list">
        {draft.colors.map((color, index) => (
          <div key={`stop-${index}`} className="color-stop">
            <button
              className="color-swatch-button"
              style={{ background: color }}
              aria-label={`Edit color stop ${index + 1}, ${color}`}
              aria-expanded={
                editing?.kind === "stop" && editing.index === index
              }
              onClick={() => setEditing({ kind: "stop", index })}
            />
            <span>{color}</span>
            <button
              disabled={index === 0}
              onClick={() => {
                const colors = [...draft.colors];
                [colors[index - 1], colors[index]] = [
                  colors[index],
                  colors[index - 1],
                ];
                setDraft({ ...draft, colors });
              }}
            >
              ↑
            </button>
            <button
              disabled={index === draft.colors.length - 1}
              onClick={() => {
                const colors = [...draft.colors];
                [colors[index + 1], colors[index]] = [
                  colors[index],
                  colors[index + 1],
                ];
                setDraft({ ...draft, colors });
              }}
            >
              ↓
            </button>
            <button
              disabled={draft.colors.length <= 2}
              onClick={() =>
                setDraft({
                  ...draft,
                  colors: draft.colors.filter(
                    (_, colorIndex) => colorIndex !== index,
                  ),
                })
              }
            >
              ×
            </button>
            {editing?.kind === "stop" && editing.index === index && (
              <PaletteColorPicker
                value={color}
                label={`Color stop ${index + 1}`}
                onPreview={(nextColor) =>
                  setDraft((current) => ({
                    ...current,
                    colors: current.colors.map((item, colorIndex) =>
                      colorIndex === index ? nextColor : item,
                    ),
                  }))
                }
                onDone={(nextColor) =>
                  materialize({
                    ...draft,
                    colors: draft.colors.map((item, colorIndex) =>
                      colorIndex === index ? nextColor : item,
                    ),
                  })
                }
                onCancel={() => setEditing(null)}
              />
            )}
          </div>
        ))}
      </div>
      <button
        disabled={draft.colors.length >= 8}
        onClick={() =>
          setDraft({
            ...draft,
            colors: [...draft.colors, draft.colors.at(-1) ?? "#ffffff"],
          })
        }
      >
        + Add stop
      </button>
      <div className="background-color-row">
        <span>Background</span>
        <button
          className="color-swatch-button"
          style={{ background: draft.background }}
          aria-label={`Edit background color, ${draft.background}`}
          aria-expanded={editing?.kind === "background"}
          onClick={() => setEditing({ kind: "background" })}
        />
        <code>{draft.background}</code>
        {editing?.kind === "background" && (
          <PaletteColorPicker
            value={draft.background}
            label="Background"
            onPreview={(background) =>
              setDraft((current) => ({ ...current, background }))
            }
            onDone={(background) => materialize({ ...draft, background })}
            onCancel={() => setEditing(null)}
          />
        )}
      </div>
      <Range
        label="Hue rotation"
        min={-180}
        max={180}
        value={rotation}
        onChange={setRotation}
      />
      <Range
        label="Saturation"
        min={20}
        max={160}
        value={saturation}
        onChange={setSaturation}
      />
      <Range
        label="Brightness"
        min={35}
        max={145}
        value={brightness}
        onChange={setBrightness}
      />
      <Range
        label="Temperature"
        min={-60}
        max={60}
        value={temperature}
        onChange={setTemperature}
      />
      <div
        className="palette-preview"
        style={{
          background: `linear-gradient(90deg, ${preview.colors.join(",")})`,
        }}
      />
      <button className="primary-button" onClick={save}>
        {builtInPalettes.some((palette) => palette.id === draft.id)
          ? "Duplicate as custom palette"
          : "Save custom palette"}
      </button>
    </>
  );
}

function targetOptions(
  mode: VisualParameters["mode"],
): Array<[string, string]> {
  return [
    ...sharedControls.map(
      ({ key, label }) =>
        [`shared.${key}`, `Core · ${label}`] as [string, string],
    ),
    ...definitionsForMode(mode).map(
      (item) =>
        [
          `advanced.${item.id}`,
          `${experiences.find((experience) => experience.id === mode)?.name} · ${item.label}`,
        ] as [string, string],
    ),
    ...["velocity", "register", "rhythm", "tension", "attack", "release"].map(
      (key) => [`response.${key}`, `Response · ${key}`] as [string, string],
    ),
  ];
}

function LabHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="lab-section-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function Range({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="lab-range" title={description}>
      <span>
        <span>
          <b>{label}</b>
          {description && <small>{description}</small>}
        </span>
        <output>{Math.round(value)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
