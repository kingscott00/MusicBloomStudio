import type { MidiDevice, MidiStatus } from "../types";
import { Icon } from "./Icon";

interface MidiPanelProps {
  status: MidiStatus;
  devices: MidiDevice[];
  selectedId: string;
  error: string;
  onRequest: () => void;
  onSelect: (id: string) => void;
}

const statusText: Record<MidiStatus, string> = {
  idle: "MIDI not connected",
  requesting: "Requesting permission…",
  connected: "MIDI connected",
  disconnected: "No device found",
  denied: "MIDI access denied",
  unsupported: "Web MIDI unsupported",
};

export function MidiPanel({
  status,
  devices,
  selectedId,
  error,
  onRequest,
  onSelect,
}: MidiPanelProps) {
  const active = devices.find((device) => device.id === selectedId);
  return (
    <section className="midi-card glass-card" aria-labelledby="midi-heading">
      <div className="section-heading">
        <div className="section-kicker">
          <Icon name="midi" size={16} /> MIDI INPUT
        </div>
        <span className={`status-dot ${status}`} aria-hidden="true" />
      </div>
      <h2 id="midi-heading">{statusText[status]}</h2>
      <p className="muted">
        {active
          ? [active.manufacturer, active.name].filter(Boolean).join(" · ")
          : "Connect a keyboard or use the piano below."}
      </p>
      {devices.length > 0 && (
        <label className="field-label">
          Input device
          <select
            value={selectedId}
            onChange={(event) => onSelect(event.target.value)}
          >
            {devices.map((device) => (
              <option value={device.id} key={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {status !== "connected" && status !== "unsupported" && (
        <button
          className="button primary wide"
          onClick={onRequest}
          disabled={status === "requesting"}
        >
          <Icon name="midi" />{" "}
          {status === "denied" ? "Try MIDI access again" : "Connect MIDI"}
        </button>
      )}
      {(error || status === "unsupported") && (
        <p className="inline-error">
          {error || "Try Chrome, Edge, or another Chromium browser on desktop."}
        </p>
      )}
    </section>
  );
}
