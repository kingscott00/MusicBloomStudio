import { useState } from "react";
import { getPalette } from "../presets/palettes";
import type { Preset } from "../types";
import { Icon } from "./Icon";

interface PresetBrowserProps {
  presets: Preset[];
  activeId: string;
  onApply: (preset: Preset) => void;
  onSave: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PresetBrowser({
  presets,
  activeId,
  onApply,
  onSave,
  onRename,
  onDelete,
}: PresetBrowserProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  const submitSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    setName("");
    setSaveOpen(false);
  };

  return (
    <section
      className="presets-card glass-card"
      aria-labelledby="presets-heading"
    >
      <div className="preset-topline">
        <div>
          <span className="section-kicker">
            <Icon name="presets" size={15} /> PRESETS
          </span>
          <h2 id="presets-heading">Curated atmospheres</h2>
        </div>
        {!saveOpen && (
          <button
            className="button quiet compact"
            onClick={() => setSaveOpen(true)}
          >
            + Save current
          </button>
        )}
        {saveOpen && (
          <form className="save-preset-form" onSubmit={submitSave}>
            <label className="sr-only" htmlFor="preset-name">
              Preset name
            </label>
            <input
              id="preset-name"
              autoFocus
              placeholder="Preset name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button className="button primary compact" type="submit">
              Save
            </button>
            <button
              className="icon-button small"
              type="button"
              aria-label="Cancel saving preset"
              onClick={() => setSaveOpen(false)}
            >
              <Icon name="close" size={15} />
            </button>
          </form>
        )}
      </div>
      <div className="preset-scroll">
        {presets.map((preset) => {
          const palette = getPalette(preset.params.paletteId);
          return (
            <article
              className={`preset-tile ${activeId === preset.id ? "active" : ""}`}
              key={preset.id}
            >
              <button className="preset-main" onClick={() => onApply(preset)}>
                <span
                  className="preset-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${palette.colors.join(",")})`,
                  }}
                >
                  <span className={`mini-mark ${preset.params.mode}`} />
                </span>
                {renaming === preset.id ? (
                  <input
                    autoFocus
                    defaultValue={preset.name}
                    aria-label="Rename preset"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onRename(
                          preset.id,
                          event.currentTarget.value.trim() || preset.name,
                        );
                        setRenaming(null);
                      }
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    onBlur={(event) => {
                      onRename(
                        preset.id,
                        event.currentTarget.value.trim() || preset.name,
                      );
                      setRenaming(null);
                    }}
                  />
                ) : (
                  <span>
                    <b>{preset.name}</b>
                    <small>{preset.params.mode}</small>
                  </span>
                )}
              </button>
              {!preset.builtIn && renaming !== preset.id && (
                <div className="preset-actions">
                  <button
                    title="Rename preset"
                    aria-label={`Rename ${preset.name}`}
                    onClick={() => setRenaming(preset.id)}
                  >
                    Edit
                  </button>
                  <button
                    title="Delete preset"
                    aria-label={`Delete ${preset.name}`}
                    onClick={() => onDelete(preset.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
