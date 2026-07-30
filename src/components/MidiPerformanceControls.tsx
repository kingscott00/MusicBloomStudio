import { useMemo, useRef, useState } from "react";
import type { useMidiMappings } from "../hooks/useMidiMappings";
import { messageMatchesMapping, parameterDefinitions } from "../midi/mappings";
import type {
  MidiActionTarget,
  MidiControlMessage,
  MidiDevice,
  MidiMapping,
  MidiParameterTarget,
} from "../types";
import { Icon } from "./Icon";

type MidiMappingsController = ReturnType<typeof useMidiMappings>;

interface MidiPerformanceControlsProps {
  device?: MidiDevice;
  controller: MidiMappingsController;
  showDeveloperSimulator: boolean;
}

const actionDefinitions: Record<MidiActionTarget, string> = {
  surprise: "Surprise Me",
  "previous-preset": "Previous preset",
  "next-preset": "Next preset",
  "previous-experience": "Previous experience",
  "next-experience": "Next experience",
  reset: "Reset Visuals",
};

const learnOptions = [
  ...Object.entries(parameterDefinitions).map(([value, definition]) => ({
    value: `parameter:${value}`,
    label: definition.label,
  })),
  ...Object.entries(actionDefinitions).map(([value, label]) => ({
    value: `action:${value}`,
    label: `Action · ${label}`,
  })),
];

export function MidiPerformanceControls({
  device,
  controller,
  showDeveloperSimulator,
}: MidiPerformanceControlsProps) {
  const [open, setOpen] = useState(false);
  const [learnSelection, setLearnSelection] = useState("parameter:density");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [profileEditing, setProfileEditing] = useState<"new" | "rename" | null>(
    null,
  );
  const [profileName, setProfileName] = useState("");
  const [importError, setImportError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const mappings = controller.activeProfile?.mappings ?? [];
  const [learnType, learnTarget] = learnSelection.split(":") as [
    "parameter" | "action",
    MidiParameterTarget | MidiActionTarget,
  ];

  const exportMappings = () => {
    const blob = new Blob([controller.exportJson()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "music-bloom-midi-mappings.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const submitProfileName = () => {
    const name = profileName.trim();
    if (!name) return;
    if (profileEditing === "new") controller.createProfile(name);
    else controller.renameProfile(name);
    setProfileEditing(null);
    setProfileName("");
  };

  return (
    <section className="midi-performance glass-card">
      <button
        className="midi-performance-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <Icon name="sliders" size={15} /> MIDI Performance Controls
        </span>
        <small>{open ? "Close" : `${mappings.length} mapped`}</small>
      </button>
      {open && (
        <div className="midi-performance-body">
          <div className="midi-live-status">
            <span
              className={`midi-activity ${controller.latestMessage ? "active" : ""}`}
              aria-hidden="true"
            />
            <span>
              <b>{device?.name ?? "No MIDI input selected"}</b>
              <small>
                {controller.latestMessage
                  ? describeMessage(controller.latestMessage)
                  : "Move a control to see its activity"}
              </small>
            </span>
          </div>

          <div className="profile-row">
            <label>
              Profile
              <select
                value={controller.activeProfileId}
                onChange={(event) =>
                  controller.setActiveProfileId(event.target.value)
                }
                disabled={!controller.deviceProfiles.length}
              >
                {!controller.deviceProfiles.length && (
                  <option value="">Created when you learn a control</option>
                )}
                {controller.deviceProfiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button
                onClick={() => {
                  setProfileEditing("new");
                  setProfileName(`${device?.name ?? "MIDI"} performance`);
                }}
                disabled={!device}
              >
                New
              </button>
              <button
                onClick={() => {
                  setProfileEditing("rename");
                  setProfileName(controller.activeProfile?.name ?? "");
                }}
                disabled={!controller.activeProfile}
              >
                Rename
              </button>
            </div>
          </div>
          {profileEditing && (
            <div className="profile-name-editor">
              <input
                autoFocus
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitProfileName();
                  if (event.key === "Escape") setProfileEditing(null);
                }}
                aria-label="Mapping profile name"
              />
              <button onClick={submitProfileName}>Save</button>
              <button onClick={() => setProfileEditing(null)}>Cancel</button>
            </div>
          )}

          <div className="learn-row">
            <label>
              Control the artwork
              <select
                value={learnSelection}
                onChange={(event) => setLearnSelection(event.target.value)}
              >
                {learnOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {controller.learning ? (
              <button
                className="learn-button listening"
                onClick={controller.cancelLearn}
              >
                Cancel Learn
              </button>
            ) : (
              <button
                className="learn-button"
                disabled={!device && !showDeveloperSimulator}
                onClick={() =>
                  controller.beginLearn({
                    type: learnType,
                    target: learnTarget,
                    label:
                      learnType === "parameter"
                        ? parameterDefinitions[
                            learnTarget as MidiParameterTarget
                          ].label
                        : actionDefinitions[learnTarget as MidiActionTarget],
                  })
                }
              >
                Learn
              </button>
            )}
          </div>
          <p
            className={`learn-prompt ${controller.learning ? "listening" : ""}`}
            aria-live="polite"
          >
            {controller.learning
              ? `Listening for ${controller.learning.label}… move a knob, slider, wheel, or button. Notes are ignored.`
              : "Choose Learn, then move a knob or slider on your MIDI controller."}
          </p>

          {controller.pendingConflict && (
            <div className="mapping-conflict" role="alert">
              <b>This control is already mapped.</b>
              <span>Replace it, or intentionally control both targets?</span>
              <div>
                <button onClick={() => controller.resolveConflict("replace")}>
                  Replace
                </button>
                <button onClick={() => controller.resolveConflict("keep")}>
                  Keep both
                </button>
                <button onClick={() => controller.resolveConflict("cancel")}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mapping-list">
            {mappings.map((mapping) => (
              <MappingRow
                key={mapping.id}
                mapping={mapping}
                latest={controller.latestMessage}
                waiting={controller.waitingMappingIds.includes(mapping.id)}
                onChange={(changes) =>
                  controller.updateMapping(mapping.id, changes)
                }
                onRemove={() => controller.removeMapping(mapping.id)}
              />
            ))}
          </div>

          <label className="midi-feedback-toggle">
            <input
              type="checkbox"
              checked={controller.feedbackEnabled}
              onChange={(event) =>
                controller.setFeedbackEnabled(event.target.checked)
              }
            />
            Show live value overlay
          </label>

          <div className="mapping-tools">
            <button
              onClick={() => setInspectorOpen((value) => !value)}
              aria-expanded={inspectorOpen}
            >
              {inspectorOpen ? "Hide inspector" : "MIDI inspector"}
            </button>
            <button
              onClick={exportMappings}
              disabled={!controller.profiles.length}
            >
              Export
            </button>
            <button onClick={() => importRef.current?.click()}>Import</button>
            <button
              onClick={() => {
                if (
                  controller.activeProfile &&
                  window.confirm(
                    `Reset all mappings in “${controller.activeProfile.name}”?`,
                  )
                )
                  controller.resetProfile();
              }}
              disabled={!mappings.length}
            >
              Reset profile
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  controller.importJson(await file.text());
                  setImportError("");
                } catch (error) {
                  setImportError(
                    error instanceof Error
                      ? error.message
                      : "Could not import mappings.",
                  );
                }
                event.target.value = "";
              }}
            />
          </div>
          {importError && <p className="inline-error">{importError}</p>}

          {inspectorOpen && (
            <div className="midi-inspector">
              <b>Recent controls</b>
              {controller.recentMessages.length ? (
                controller.recentMessages.map((message, index) => (
                  <code key={`${message.timestamp}-${index}`}>
                    {message.deviceName} · Ch {message.channel + 1} ·{" "}
                    {describeMessage(message)}
                  </code>
                ))
              ) : (
                <span>No eligible control messages yet.</span>
              )}
            </div>
          )}

          {showDeveloperSimulator && (
            <MidiControlSimulator
              device={device}
              onMessage={controller.handleControl}
            />
          )}
        </div>
      )}
    </section>
  );
}

function MappingRow({
  mapping,
  latest,
  waiting,
  onChange,
  onRemove,
}: {
  mapping: MidiMapping;
  latest: MidiControlMessage | null;
  waiting: boolean;
  onChange: (changes: Partial<MidiMapping>) => void;
  onRemove: () => void;
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const targetLabel =
    mapping.targetType === "parameter"
      ? parameterDefinitions[mapping.target as MidiParameterTarget].label
      : actionDefinitions[mapping.target as MidiActionTarget];
  const current =
    latest && messageMatchesMapping(mapping, latest)
      ? Math.round(latest.value)
      : null;
  return (
    <article className={`mapping-row ${waiting ? "waiting" : ""}`}>
      <div className="mapping-summary">
        <span>
          <b>{targetLabel}</b>
          <small>
            {sourceLabel(mapping)} · Ch {mapping.channel + 1}
            {waiting ? " · waiting for pickup" : ""}
          </small>
        </span>
        <output>{current ?? "—"}</output>
        <button onClick={() => setOptionsOpen((value) => !value)}>
          {optionsOpen ? "Done" : "Options"}
        </button>
        <button onClick={onRemove} aria-label={`Remove ${targetLabel} mapping`}>
          Remove
        </button>
      </div>
      {optionsOpen && (
        <div className="mapping-options">
          {mapping.targetType === "parameter" && (
            <>
              <label>
                Input
                <span>
                  <input
                    type="number"
                    min="0"
                    max="127"
                    value={mapping.inputMin}
                    onChange={(event) =>
                      onChange({ inputMin: Number(event.target.value) })
                    }
                  />
                  <input
                    type="number"
                    min="0"
                    max="127"
                    value={mapping.inputMax}
                    onChange={(event) =>
                      onChange({ inputMax: Number(event.target.value) })
                    }
                  />
                </span>
              </label>
              <label>
                Output
                <span>
                  <input
                    type="number"
                    value={mapping.outputMin}
                    onChange={(event) =>
                      onChange({ outputMin: Number(event.target.value) })
                    }
                  />
                  <input
                    type="number"
                    value={mapping.outputMax}
                    onChange={(event) =>
                      onChange({ outputMax: Number(event.target.value) })
                    }
                  />
                </span>
              </label>
              <label>
                Smoothing
                <select
                  value={mapping.smoothing}
                  onChange={(event) =>
                    onChange({
                      smoothing: event.target.value as MidiMapping["smoothing"],
                    })
                  }
                >
                  <option value="none">None</option>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                </select>
              </label>
              <label>
                Takeover
                <select
                  value={mapping.takeover}
                  onChange={(event) =>
                    onChange({
                      takeover: event.target.value as MidiMapping["takeover"],
                    })
                  }
                >
                  <option value="pickup">Pickup</option>
                  <option value="jump">Direct / jump</option>
                </select>
              </label>
              <label className="mapping-check">
                <input
                  type="checkbox"
                  checked={mapping.invert}
                  onChange={(event) =>
                    onChange({ invert: event.target.checked })
                  }
                />
                Invert
              </label>
              {mapping.source === "pitchbend" && (
                <label>
                  Wheel behavior
                  <select
                    value={mapping.pitchMode}
                    onChange={(event) =>
                      onChange({
                        pitchMode: event.target
                          .value as MidiMapping["pitchMode"],
                      })
                    }
                  >
                    <option value="permanent">Permanent control</option>
                    <option value="momentary">Momentary modulation</option>
                  </select>
                </label>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

function describeMessage(message: MidiControlMessage): string {
  if (message.source === "cc")
    return `CC ${message.controller} · ${Math.round(message.value)}`;
  if (message.source === "pitchbend") return `Pitch bend · ${message.rawValue}`;
  return `Pressure · ${Math.round(message.value)}`;
}

function sourceLabel(mapping: MidiMapping): string {
  if (mapping.source === "cc") return `CC ${mapping.controller}`;
  if (mapping.source === "pitchbend") return "Pitch bend";
  return "Channel pressure";
}

function MidiControlSimulator({
  device,
  onMessage,
}: {
  device?: MidiDevice;
  onMessage: (message: MidiControlMessage) => void;
}) {
  const [source, setSource] = useState<MidiControlMessage["source"]>("cc");
  const [controller, setController] = useState(21);
  const [value, setValue] = useState(64);
  const simulatedDevice = useMemo(
    () => ({
      id: device?.id ?? "developer-midi-simulator",
      name: device?.name ?? "Developer MIDI Simulator",
    }),
    [device],
  );
  const send = (nextValue: number) =>
    onMessage({
      source,
      deviceId: simulatedDevice.id,
      deviceName: simulatedDevice.name,
      channel: 0,
      controller: source === "cc" ? controller : null,
      rawValue:
        source === "pitchbend"
          ? Math.round((nextValue / 127) * 16_383)
          : nextValue,
      value: nextValue,
      timestamp: performance.now(),
    });
  return (
    <div className="midi-simulator">
      <b>Developer MIDI simulator</b>
      <select
        value={source}
        onChange={(event) =>
          setSource(event.target.value as MidiControlMessage["source"])
        }
      >
        <option value="cc">Control Change</option>
        <option value="pitchbend">Pitch bend</option>
        <option value="pressure">Channel pressure</option>
      </select>
      {source === "cc" && (
        <input
          aria-label="Simulated CC number"
          type="number"
          min="0"
          max="127"
          value={controller}
          onChange={(event) => setController(Number(event.target.value))}
        />
      )}
      <input
        aria-label="Simulated MIDI value"
        type="range"
        min="0"
        max="127"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          setValue(next);
          send(next);
        }}
      />
      <button
        onClick={() => {
          send(127);
          window.setTimeout(() => send(0), 80);
        }}
      >
        Button pulse
      </button>
    </div>
  );
}
