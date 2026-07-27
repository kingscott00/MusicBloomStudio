import { palettes } from "../presets/palettes";
import type { VisualMode, VisualParameters } from "../types";
import { Icon } from "./Icon";

interface VisualControlsProps {
  params: VisualParameters;
  onChange: (changes: Partial<VisualParameters>) => void;
  onReset: () => void;
}

const modes: Array<{ id: VisualMode; label: string; description: string }> = [
  { id: "bloom", label: "Bloom", description: "Petals & tendrils" },
  { id: "orbit", label: "Orbit", description: "Moons & rings" },
  { id: "ribbons", label: "Ribbons", description: "Flowing strands" },
  { id: "constellation", label: "Stars", description: "Points & paths" },
];

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
}: VisualControlsProps) {
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
      <div className="mode-grid">
        {modes.map((mode) => (
          <button
            className={`mode-button ${params.mode === mode.id ? "active" : ""}`}
            onClick={() => onChange({ mode: mode.id })}
            key={mode.id}
          >
            <b>{mode.label}</b>
            <small>{mode.description}</small>
          </button>
        ))}
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
