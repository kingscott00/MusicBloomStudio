import { useState } from "react";
import { getPalette } from "../presets/palettes";
import type { Preset, VisualMode } from "../types";
import { getExperience } from "../visuals/experiences";
import { Icon } from "./Icon";

interface PresetBrowserProps {
  presets: Preset[];
  activeId: string;
  onApply: (preset: Preset) => void;
  onSave: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
}

type PresetFilter = "all" | "featured" | "favorites" | VisualMode;

export function PresetBrowser({
  presets,
  activeId,
  onApply,
  onSave,
  onRename,
  onDelete,
  favoriteIds,
  onToggleFavorite,
}: PresetBrowserProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [filter, setFilter] = useState<PresetFilter>("featured");
  const filtered = presets.filter((preset) => {
    if (filter === "all") return true;
    if (filter === "featured") return preset.featured;
    if (filter === "favorites") return favoriteIds.includes(preset.id);
    return preset.params.mode === filter;
  });

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
      <div className="preset-filters" aria-label="Filter presets">
        {(["featured", "favorites", "all"] as const).map((value) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
          >
            {value === "featured"
              ? "Featured"
              : value === "favorites"
                ? `Favorites${favoriteIds.length ? ` ${favoriteIds.length}` : ""}`
                : "All"}
          </button>
        ))}
        <select
          value={
            ["all", "featured", "favorites"].includes(filter) ? "" : filter
          }
          onChange={(event) =>
            setFilter((event.target.value || "featured") as PresetFilter)
          }
          aria-label="Filter by experience"
        >
          <option value="">Experience</option>
          {Array.from(new Set(presets.map((preset) => preset.params.mode))).map(
            (mode) => (
              <option value={mode} key={mode}>
                {getExperience(mode).name}
              </option>
            ),
          )}
        </select>
      </div>
      <div className="preset-scroll">
        {!filtered.length && (
          <p className="preset-empty">
            No favorites yet. Use the star on any atmosphere to keep it here.
          </p>
        )}
        {filtered.map((preset) => {
          const palette = getPalette(preset.params.paletteId);
          const favorite = favoriteIds.includes(preset.id);
          return (
            <article
              className={`preset-tile ${activeId === preset.id ? "active" : ""}`}
              key={preset.id}
            >
              <button className="preset-main" onClick={() => onApply(preset)}>
                <span
                  className={`preset-swatch swatch-${preset.params.mode}`}
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
                    <small>
                      {getExperience(preset.params.mode).name}
                      {preset.featured ? " · Featured" : ""}
                    </small>
                  </span>
                )}
              </button>
              <button
                className={`favorite-button ${favorite ? "active" : ""}`}
                onClick={() => onToggleFavorite(preset.id)}
                aria-label={`${favorite ? "Remove" : "Add"} ${preset.name} ${favorite ? "from" : "to"} favorites`}
                aria-pressed={favorite}
                title={favorite ? "Remove favorite" : "Add favorite"}
              >
                {favorite ? "★" : "☆"}
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
