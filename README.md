# Music Bloom Studio

Music Bloom Studio is a browser-based generative-art instrument. Play a connected MIDI keyboard—or the built-in mouse, touch, and computer keyboard piano—and notes become flowers, orbital systems, ribbons, constellations, jellyfish, mandalas, nebulae, fractal forests, liquid metal, and dimensional portals.

The app is local-first: it has no backend, account, analytics, or external API. Visual settings, the preferred MIDI device, custom presets, palettes, laboratory state, and Visual Instruments are stored in browser `localStorage`.

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

Use **Surprise Me** to create a curated, deterministic visual recipe. The recipe
number is shown beside the button and is retained when the result is saved as a
custom preset. Enter a recipe number and choose **Replay** to reproduce it.
Randomization uses experience-specific ranges and keeps the current quality and
reduced-motion preferences. Compact locks can preserve the experience, palette,
density, motion, trails, glow, or symmetry while the remaining qualities
change.

Twenty built-in showcase presets provide a restrained and an immersive
direction for every visual experience. Featured presets surface the strongest
starting points; favorites are stored locally. Presets can also be filtered by
experience.

## MIDI Performance Controls

Open **MIDI Performance Controls**, select a visual parameter or action, choose
**Learn**, then move a hardware control. Notes and sustain continue through the
musical performance path and are never treated as Learn gestures.

- Learn standard Control Change messages, modulation wheel, pitch bend, and
  channel pressure.
- Map density, speed, rotation, symmetry, trails, glow, bloom,
  responsiveness, background light, or idle motion.
- Map buttons to Surprise Me, adjacent presets or experiences, and Reset
  Visuals.
- Set input/output ranges, inversion, smoothing, pickup or direct takeover,
  and permanent or momentary pitch-wheel behavior.
- Keep device-specific mapping profiles locally, or export/import them as
  JSON.

The optional developer simulator is available only in a development build at
`?midi-sim=1`; it is not included in the normal production interface.

## Visual Laboratory

Choose **Open Visual Laboratory** for the optional advanced instrument-building
workspace. The artwork remains visible, MIDI notes and sustain remain live, and
the current design carries into the active edit scene.

- Capture complete Scene A and Scene B states, then morph continuously between
  them. Matching experiences interpolate parameters and palettes; different
  experiences remain active together and use a bounded equal-power crossfade.
- Shape six distinctive advanced controls for every experience, plus shared
  Core and Musical Response controls.
- Configure eight named performance macros. Each macro can target multiple
  shared or experience-specific parameters with min/max ranges, inversion,
  weight, and linear, ease-in, ease-out, or S-curve response.
- Add up to sixteen automatic or music-derived modulation routes, including
  three LFO speeds, smooth random drift, velocity, register, held-note count,
  rhythm, chord tension, attack, held, release, and sustain.
- Use deterministic Subtle, Moderate, or Wild mutation while respecting the
  existing randomizer locks. Undo/redo history is bounded and coalesces rapid
  slider changes.
- Use **Surprise Me** on only the current scene or generate a complete,
  performance-ready A/B instrument. Surprise recipes respect visual locks,
  never overwrite saved instruments, and expose copy, replay, and new-seed
  controls separately from mutation recipes.
- Save the full design as a versioned Visual Instrument, or export/import it as
  validated JSON. Curated example instruments demonstrate same-mode morphing,
  cross-experience dissolves, macros, and musical modulation.
- Build custom two-to-eight-stop palettes with reordering, hue rotation,
  saturation, brightness, and temperature controls. The in-app HSV editor
  previews color directly in the artwork while dragging; Done creates one
  undoable history entry and Cancel restores the original color.

Morph and Macro 1–8 are available to MIDI Learn. Button mappings can move
between instruments, mutate, or load either scene. A saved instrument can be
performed in Clean or Fullscreen view with an optional compact overlay.

## Musical mapping

- Pitch class moves through the selected palette.
- Register influences vertical position, orbit size, and scale.
- Velocity influences light, bloom impulse, and particle size.
- Harmony changes geometry and visual tension.
- Seventh and ninth chords add layers.
- Note density and timing increase activity.
- Sustain extends note state and slows visual decay.
- Quiet and idle states retain a subtle breathing form.

The renderer uses explicit attack, held-note, release, sustain, rhythmic,
velocity, and chord-stability envelopes. Note attacks are delivered to the
active generator independently from the sorted held-note collection, so short
notes and downward melodic motion remain visually immediate.

Chord detection includes major, minor, diminished, augmented, suspended, sixth, seventh, ninth, added ninth, and power chords, including inversions where the pitch collection is unambiguous.

## Browser support

Web MIDI is expected to work in current Chromium-based desktop browsers, including Google Chrome and Microsoft Edge. Browser/device policies can vary. Safari and Firefox may not expose Web MIDI. The on-screen piano and all non-MIDI features work without MIDI support.

## Architecture

```text
src/
  components/   React interface and canvas host
  hooks/        Performance, Web MIDI lifecycle, and mapping orchestration
  lab/          Scenes, morphing, macros, modulation, mutation, history, instruments
  midi/         Raw MIDI parsing and live-control mapping math
  music/        Held notes, sustain, naming, chord detection, analysis
  presets/      Palettes and local preset persistence
  types/        Shared strict TypeScript contracts
  utils/        Color and math helpers
  visuals/      Ten generators behind a shared interface
```

The animation loop and generator state live outside React rendering. React updates only when musical or interface state changes. Canvas sizing is handled with `ResizeObserver`, pixel density is capped, hidden tabs stop drawing, and all MIDI and animation listeners are cleaned up.

The visual engine consumes per-note musical lifecycles that separate attack,
held duration, release, and sustain-linger energy. Every sounding pitch remains
a simultaneous visual voice. Stabilized chord roots, qualities, inversions, and
extensions map to physical profiles—openness, curvature, instability,
directional pull, crystalline stretch, halos, and outer layers—rather than only
changing color.

Adaptive quality is enabled by default. It tunes effective pixel density and
generator detail when active-frame performance falls, caps fullscreen
resolution more conservatively, and reduces calm idle scenes to approximately
30 FPS (18 FPS with reduced motion). Per-particle radial gradients were replaced
with cheaper layered light primitives, and every generator has a bounded
population. Quality-aware active caps (90/60 FPS) also prevent high-refresh
displays from doing unnecessary canvas work. The compact Performance &
Diagnostics section exposes Auto/High/Balanced/Low quality and an optional live
monitor for renderer statistics, held notes, chord identity, and musical
envelopes.

The visual system follows the project’s
[Harmonic Bioluminescence](docs/ALGORITHMIC_PHILOSOPHY.md) generative-art
philosophy.

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
