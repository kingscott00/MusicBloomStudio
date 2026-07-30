import { useEffect, useState } from "react";
import { pitchClassName } from "../music/notes";
import { palettes } from "../presets/palettes";
import { experiences } from "../visuals/experiences";
import type { RenderMetrics, RenderQuality, VisualParameters } from "../types";
import { Icon } from "./Icon";

interface VisualControlsProps {
  params: VisualParameters;
  onChange: (changes: Partial<VisualParameters>) => void;
  onReset: () => void;
  metrics: RenderMetrics;
  diagnosticsOpen: boolean;
  onDiagnosticsChange: (open: boolean) => void;
  onRandomize: (seed?: number) => void;
}

const sliders: Array<{
  key: keyof VisualParameters;
  label: string;
  min?: number;
  max?: number;
}> = [
  { key: "density", label: "Visual density" },
  { key: "speed", label: "Movement speed" },
  { key: "rotation", label: "Rotation" },
  { key: "symmetry", label: "Symmetry", min: 3, max: 14 },
  { key: "trails", label: "Trail length" },
  { key: "glow", label: "Glow" },
  { key: "bloom", label: "Bloom strength" },
  { key: "responsiveness", label: "Responsiveness" },
  { key: "background", label: "Background light" },
  { key: "idle", label: "Idle animation" },
];

export function VisualControls({
  params,
  onChange,
  onReset,
  metrics,
  diagnosticsOpen,
  onDiagnosticsChange,
  onRandomize,
}: VisualControlsProps) {
  const [performanceOpen, setPerformanceOpen] = useState(true);
  const [recipeInput, setRecipeInput] = useState(String(params.recipeSeed));
  useEffect(
    () => setRecipeInput(String(params.recipeSeed)),
    [params.recipeSeed],
  );
  const replayRecipe = () => {
    const seed = Number(recipeInput);
    if (Number.isInteger(seed) && seed >= 0 && seed <= 999_999_999)
      onRandomize(seed);
    else setRecipeInput(String(params.recipeSeed));
  };
  return (
    <section
      className="controls-card glass-card"
      aria-labelledby="controls-heading"
    >
      <div className="section-heading">
        <div className="section-kicker">
          <Icon name="sliders" size={16} /> VISUAL CONTROLS
        </div>
        <button className="text-button" onClick={onReset}>
          <Icon name="reset" size={15} /> Reset
        </button>
      </div>
      <h2 id="controls-heading" className="sr-only">
        Visual controls
      </h2>
      <div className="randomizer-block">
        <button
          className="surprise-button"
          onClick={() => onRandomize()}
          title="Create a curated visual recipe"
        >
          <span aria-hidden="true">✦</span>
          Surprise Me
        </button>
        <form
          className="recipe-form"
          onSubmit={(event) => {
            event.preventDefault();
            replayRecipe();
          }}
        >
          <label htmlFor="recipe-seed">Recipe</label>
          <input
            id="recipe-seed"
            aria-label="Recipe seed"
            inputMode="numeric"
            value={recipeInput}
            onChange={(event) =>
              setRecipeInput(event.target.value.replace(/\D/g, "").slice(0, 9))
            }
          />
          <button type="submit" title="Replay this recipe">
            Replay
          </button>
        </form>
      </div>
      <div className="experience-browser">
        <span className="experience-family">FOUNDATIONS</span>
        <div className="mode-grid foundation-grid">
          {experiences
            .filter((experience) => experience.family === "foundations")
            .map((experience) => (
              <ExperienceButton
                key={experience.id}
                active={params.mode === experience.id}
                name={experience.name}
                description={experience.description}
                onClick={() => onChange({ mode: experience.id })}
              />
            ))}
        </div>
        <span className="experience-family">VISUAL WORLDS</span>
        <div className="mode-grid worlds-grid">
          {experiences
            .filter((experience) => experience.family === "worlds")
            .map((experience) => (
              <ExperienceButton
                key={experience.id}
                active={params.mode === experience.id}
                name={experience.name}
                description={experience.description}
                onClick={() => onChange({ mode: experience.id })}
              />
            ))}
        </div>
      </div>
      <label className="field-label">
        Color palette
        <select
          value={params.paletteId}
          onChange={(event) => onChange({ paletteId: event.target.value })}
        >
          {palettes.map((palette) => (
            <option value={palette.id} key={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
      </label>
      <div className="performance-diagnostics">
        <button
          className="performance-diagnostics-heading"
          onClick={() => setPerformanceOpen((open) => !open)}
          aria-expanded={performanceOpen}
        >
          <span>Performance &amp; Diagnostics</span>
          <span>{performanceOpen ? "Collapse" : "Expand"}</span>
        </button>
        {performanceOpen && (
          <div className="performance-diagnostics-body">
            <label className="field-label">
              Rendering quality
              <select
                value={params.quality}
                onChange={(event) =>
                  onChange({
                    quality: event.target.value as RenderQuality,
                  })
                }
              >
                <option value="auto">Auto · adaptive</option>
                <option value="high">High</option>
                <option value="balanced">Balanced</option>
                <option value="low">Low</option>
              </select>
            </label>
            <Toggle
              label="Performance Monitor"
              checked={diagnosticsOpen}
              onChange={onDiagnosticsChange}
            />
            {diagnosticsOpen && (
              <div className="metrics-grid" aria-live="polite">
                <Metric label="FPS" value={String(metrics.fps)} />
                <Metric
                  label="Frame cost"
                  value={`${metrics.frameCostMs.toFixed(1)} ms`}
                />
                <Metric
                  label="Effective quality"
                  value={metrics.qualityLabel}
                />
                <Metric
                  label="Render scale"
                  value={`${Math.round(metrics.qualityScale * 100)}%`}
                />
                <Metric
                  label="Active elements"
                  value={String(metrics.activeElements)}
                />
                <Metric label="Held notes" value={String(metrics.heldNotes)} />
                <Metric
                  label="Chord root"
                  value={
                    metrics.chordRoot === null
                      ? "—"
                      : pitchClassName(metrics.chordRoot)
                  }
                />
                <Metric label="Chord quality" value={metrics.chordQuality} />
                <Metric
                  label="Attack"
                  value={metrics.attackEnergy.toFixed(2)}
                />
                <Metric label="Held" value={metrics.heldEnergy.toFixed(2)} />
                <Metric
                  label="Release"
                  value={metrics.releaseEnergy.toFixed(2)}
                />
                <Metric
                  label="Sustain"
                  value={metrics.sustainEnergy.toFixed(2)}
                />
                <Metric
                  label="Phases"
                  value={`${metrics.attackingNotes}A · ${metrics.heldPhaseNotes}H · ${metrics.sustainedNotes}S · ${metrics.releasingNotes}R`}
                />
                <Metric
                  label="Longest hold"
                  value={`${(metrics.longestHeldDuration / 1000).toFixed(1)}s`}
                />
                <Metric
                  label="Pedal sources"
                  value={
                    [
                      metrics.physicalSustain && "MIDI",
                      metrics.simulatedSustain && "Space",
                    ]
                      .filter(Boolean)
                      .join(" + ") || "Off"
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="control-sliders">
        {sliders.map(({ key, label, min = 0, max = 100 }) => (
          <label className="range-control" key={key}>
            <span>
              {label}
              <output>{params[key] as number}</output>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              value={params[key] as number}
              onChange={(event) =>
                onChange({ [key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
      </div>
      <div className="toggle-list">
        <Toggle
          label="Automatic composition drift"
          checked={params.autoMotion}
          onChange={(checked) => onChange({ autoMotion: checked })}
        />
        <Toggle
          label="Reduced motion"
          checked={params.reducedMotion}
          onChange={(checked) => onChange({ reducedMotion: checked })}
        />
      </div>
    </section>
  );
}

function ExperienceButton({
  active,
  name,
  description,
  onClick,
}: {
  active: boolean;
  name: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`mode-button ${active ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <b>{name}</b>
      <small>{description}</small>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="metric">
      <small>{label}</small>
      <b>{value}</b>
    </span>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
