import type { MusicalState } from "../types";
import { noteName } from "../music/notes";

interface PerformanceDisplayProps {
  music: MusicalState;
  preferFlats: boolean;
}

export function PerformanceDisplay({
  music,
  preferFlats,
}: PerformanceDisplayProps) {
  return (
    <section className="performance-card glass-card" aria-live="polite">
      <div className="chord-row">
        <div>
          <span className="eyebrow">HARMONY</span>
          <strong className="chord-name">{music.chord.label}</strong>
        </div>
        <div className="sustain-readout">
          <span className={`pedal ${music.sustain ? "active" : ""}`} />
          <span>{music.sustain ? "Sustain on" : "Sustain off"}</span>
        </div>
      </div>
      <div className="note-list">
        {music.notes.length === 0 ? (
          <span className="empty-notes">Play a note to begin</span>
        ) : (
          music.notes.map((held) => (
            <span
              className={`note-chip ${held.sustained ? "sustained" : ""}`}
              key={held.note}
            >
              <b>{noteName(held.note, preferFlats)}</b>
              <small>{held.velocity}</small>
            </span>
          ))
        )}
      </div>
    </section>
  );
}
