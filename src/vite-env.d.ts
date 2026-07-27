/// <reference types="vite/client" />

interface MIDIMessageEvent extends Event {
  readonly data: Uint8Array;
}

interface MIDIConnectionEvent extends Event {
  readonly port: MIDIInput;
}

interface MIDIInput extends EventTarget {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer: string | null;
  readonly state: "connected" | "disconnected";
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

interface MIDIAccess extends EventTarget {
  readonly inputs: Map<string, MIDIInput>;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
}

interface Navigator {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
}
