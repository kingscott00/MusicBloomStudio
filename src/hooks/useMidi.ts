import { useCallback, useEffect, useRef, useState } from "react";
import { parseMidiMessage } from "../midi/parser";
import type {
  MidiControlMessage,
  MidiDevice,
  MidiStatus,
  NoteEvent,
} from "../types";

const DEVICE_KEY = "music-bloom-midi-device";

interface UseMidiOptions {
  onNote: (event: NoteEvent) => void;
  onSustain: (down: boolean) => void;
  onControl?: (message: MidiControlMessage) => void;
  onDisconnect: () => void;
}

export function useMidi({
  onNote,
  onSustain,
  onControl,
  onDisconnect,
}: UseMidiOptions) {
  const [status, setStatus] = useState<MidiStatus>(() =>
    navigator.requestMIDIAccess ? "idle" : "unsupported",
  );
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [selectedId, setSelectedId] = useState(
    () => localStorage.getItem(DEVICE_KEY) ?? "",
  );
  const [error, setError] = useState("");
  const accessRef = useRef<MIDIAccess | null>(null);
  const callbacksRef = useRef({
    onNote,
    onSustain,
    onControl,
    onDisconnect,
  });
  callbacksRef.current = { onNote, onSustain, onControl, onDisconnect };

  const bindInput = useCallback((id: string) => {
    const access = accessRef.current;
    if (!access) return;
    for (const input of access.inputs.values()) input.onmidimessage = null;
    const input = access.inputs.get(id);
    if (!input || input.state !== "connected") {
      setStatus("disconnected");
      callbacksRef.current.onDisconnect();
      return;
    }
    input.onmidimessage = (message) => {
      if (!message.data) return;
      const timestamp = performance.now();
      const parsed = parseMidiMessage(message.data, timestamp);
      if (parsed.kind === "note") callbacksRef.current.onNote(parsed.event);
      if (parsed.kind === "sustain") {
        callbacksRef.current.onSustain(parsed.down);
        callbacksRef.current.onControl?.({
          source: "cc",
          deviceId: input.id,
          deviceName: input.name || "Unnamed MIDI input",
          channel: parsed.channel,
          controller: parsed.controller,
          rawValue: parsed.value,
          value: parsed.value,
          timestamp,
        });
      }
      if (parsed.kind === "control")
        callbacksRef.current.onControl?.({
          source: "cc",
          deviceId: input.id,
          deviceName: input.name || "Unnamed MIDI input",
          channel: parsed.channel,
          controller: parsed.controller,
          rawValue: parsed.value,
          value: parsed.value,
          timestamp,
        });
      if (parsed.kind === "pitchbend")
        callbacksRef.current.onControl?.({
          source: "pitchbend",
          deviceId: input.id,
          deviceName: input.name || "Unnamed MIDI input",
          channel: parsed.channel,
          controller: null,
          rawValue: parsed.value,
          value: (parsed.value / 16_383) * 127,
          timestamp,
        });
      if (parsed.kind === "pressure")
        callbacksRef.current.onControl?.({
          source: "pressure",
          deviceId: input.id,
          deviceName: input.name || "Unnamed MIDI input",
          channel: parsed.channel,
          controller: null,
          rawValue: parsed.value,
          value: parsed.value,
          timestamp,
        });
    };
    setStatus("connected");
    setSelectedId(id);
    localStorage.setItem(DEVICE_KEY, id);
  }, []);

  const refresh = useCallback(() => {
    const access = accessRef.current;
    if (!access) return;
    const nextDevices = [...access.inputs.values()].map((input) => ({
      id: input.id,
      name: input.name || "Unnamed MIDI input",
      manufacturer: input.manufacturer || "",
      state: input.state,
    }));
    setDevices(nextDevices);
    const preferred = localStorage.getItem(DEVICE_KEY) ?? selectedId;
    const nextId = nextDevices.some(
      (device) => device.id === preferred && device.state === "connected",
    )
      ? preferred
      : (nextDevices.find((device) => device.state === "connected")?.id ?? "");
    if (nextId) bindInput(nextId);
    else {
      setStatus("disconnected");
      callbacksRef.current.onDisconnect();
    }
  }, [bindInput, selectedId]);

  const requestAccess = useCallback(async () => {
    if (!navigator.requestMIDIAccess) {
      setStatus("unsupported");
      setError("Web MIDI is not available in this browser.");
      return;
    }
    setStatus("requesting");
    setError("");
    try {
      accessRef.current = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current.onstatechange = refresh;
      refresh();
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "MIDI permission was not granted.";
      setStatus("denied");
      setError(message);
    }
  }, [refresh]);

  const selectDevice = useCallback(
    (id: string) => {
      callbacksRef.current.onDisconnect();
      bindInput(id);
    },
    [bindInput],
  );

  useEffect(
    () => () => {
      if (accessRef.current) {
        accessRef.current.onstatechange = null;
        for (const input of accessRef.current.inputs.values())
          input.onmidimessage = null;
      }
    },
    [],
  );

  return {
    status,
    devices,
    selectedId,
    error,
    requestAccess,
    selectDevice,
  };
}
