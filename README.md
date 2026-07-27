# Music Bloom Studio

Music Bloom Studio is a browser-based generative-art instrument. Play a connected MIDI keyboard—or the built-in mouse, touch, and computer keyboard piano—and notes become evolving flowers, orbital systems, ribbons, and constellations.

The app is local-first: it has no backend, account, analytics, or external API. Visual settings, the preferred MIDI device, and custom presets are stored in browser `localStorage`.

## Stack

- React 19 + TypeScript (strict mode)
- Vite
- HTML Canvas 2D with `requestAnimationFrame`
- Web MIDI API
- Vitest
- Plain CSS

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://127.0.0.1:5173`).

## Quality checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

## Playing

1. Connect and power on a MIDI keyboard.
2. Open the app in Chrome or Edge on desktop.
3. Select **Connect MIDI** and grant browser permission.
4. Choose an input if multiple devices are present.
5. Play notes and use the sustain pedal normally.

No hardware is required for testing. Click or touch the on-screen piano, or use:

```text
A W S E D F T G Y H U J K
```

The row maps chromatically from C4 through C5.

## Musical mapping

- Pitch class moves through the selected palette.
- Register influences vertical position, orbit size, and scale.
- Velocity influences light, bloom impulse, and particle size.
- Harmony changes geometry and visual tension.
- Seventh and ninth chords add layers.
- Note density and timing increase activity.
- Sustain extends note state and slows visual decay.
- Quiet and idle states retain a subtle breathing form.

Chord detection includes major, minor, diminished, augmented, suspended, sixth, seventh, ninth, added ninth, and power chords, including inversions where the pitch collection is unambiguous.

## Browser support

Web MIDI is expected to work in current Chromium-based desktop browsers, including Google Chrome and Microsoft Edge. Browser/device policies can vary. Safari and Firefox may not expose Web MIDI. The on-screen piano and all non-MIDI features work without MIDI support.

## Architecture

```text
src/
  components/   React interface and canvas host
  hooks/        Performance and Web MIDI lifecycle
  midi/         Raw MIDI parsing
  music/        Held notes, sustain, naming, chord detection, analysis
  presets/      Palettes and local preset persistence
  types/        Shared strict TypeScript contracts
  utils/        Color and math helpers
  visuals/      Four generators behind a shared interface
```

The animation loop and generator state live outside React rendering. React updates only when musical or interface state changes. Canvas sizing is handled with `ResizeObserver`, pixel density is capped, hidden tabs stop drawing, and all MIDI and animation listeners are cleaned up.

## Capture and comfort

- Save the current canvas as PNG.
- Clean view hides the interface until Escape.
- Fullscreen opens an artwork-only view.
- Reduced motion can be set manually and honors the OS preference on first run.
- The visuals avoid hard cuts and rapid brightness changes.

## Known limitations

- Browsers require MIDI permission from a user gesture.
- iOS browsers do not provide general Web MIDI support.
- The v1 canvas export captures artwork only, without interface chrome.
- Video export, audio synthesis, MIDI output, DAW sync, and imported preset files are intentionally out of scope.
