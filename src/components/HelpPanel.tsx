import { Icon } from "./Icon";

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <header>
          <div>
            <span className="eyebrow">GUIDE</span>
            <h2 id="help-title">Play music. Shape light.</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close help"
          >
            <Icon name="close" />
          </button>
        </header>
        <p className="help-intro">
          Music Bloom Studio turns every note, chord, gesture, and pause into
          evolving generative artwork. Nothing is recorded or uploaded—the
          instrument runs entirely in your browser.
        </p>
        <div className="help-grid">
          <HelpSection number="01" title="Connect your keyboard">
            Connect your MIDI controller by USB, then choose <b>Connect MIDI</b>
            . Your browser will ask for permission. Select the input by name if
            you have more than one. Web MIDI works best in Chrome or Edge on
            desktop.
          </HelpSection>
          <HelpSection number="02" title="Play without hardware">
            Use the piano along the bottom with mouse or touch. On a computer
            keyboard, play the white and black notes with{" "}
            <b>A W S E D F T G Y H U J K</b>. These notes use exactly the same
            visual and chord system as MIDI.
          </HelpSection>
          <HelpSection number="03" title="How music becomes light">
            Pitch selects color; register changes altitude and scale; velocity
            adds brightness and impulse. Chord quality shapes geometry, while
            note density, timing, intervals, and rhythmic activity guide
            movement and complexity.
          </HelpSection>
          <HelpSection number="04" title="Sustain & lingering forms">
            A MIDI sustain pedal keeps released notes alive in the harmony and
            lets particles, ribbons, and petals linger. Releasing the pedal
            clears notes that are no longer physically held.
          </HelpSection>
          <HelpSection number="05" title="Make it yours">
            Try the four visual modes, then tune density, movement, symmetry,
            trails, glow, and response. Curated presets are protected; your
            custom presets are saved locally and can be renamed or deleted.
          </HelpSection>
          <HelpSection number="06" title="If a device is missing">
            Confirm the controller is powered on and connected before granting
            permission. Try reconnecting it, pressing Connect MIDI again, or
            reloading the page. Close other music software that may hold the
            device. Safari and Firefox may not expose Web MIDI.
          </HelpSection>
        </div>
        <footer>
          <span>
            Tip: use Clean view, then move between presets while you play.
          </span>
          <button className="button primary" onClick={onClose}>
            Begin playing
          </button>
        </footer>
      </section>
    </div>
  );
}

function HelpSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}
