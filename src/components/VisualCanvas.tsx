import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getPalette } from "../presets/palettes";
import { calculateVisualVoices } from "../music/envelopes";
import type {
  HeldNote,
  MusicalState,
  RenderMetrics,
  RenderQuality,
  VisualDynamics,
  VisualGenerator,
  VisualMode,
  VisualParameters,
} from "../types";
import { rgba } from "../utils/color";
import { clamp, lerp } from "../utils/math";
import { BloomGenerator } from "../visuals/BloomGenerator";
import { ConstellationGenerator } from "../visuals/ConstellationGenerator";
import { OrbitGenerator } from "../visuals/OrbitGenerator";
import { RibbonsGenerator } from "../visuals/RibbonsGenerator";

export interface VisualCanvasHandle {
  savePng: () => void;
  reset: () => void;
}

interface VisualCanvasProps {
  music: MusicalState;
  params: VisualParameters;
  onMetrics?: (metrics: RenderMetrics) => void;
}

const qualityPreset: Record<Exclude<RenderQuality, "auto">, number> = {
  high: 1,
  balanced: 0.76,
  low: 0.52,
};

export const VisualCanvas = forwardRef<VisualCanvasHandle, VisualCanvasProps>(
  function VisualCanvas({ music, params, onMetrics }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const musicRef = useRef(music);
    const paramsRef = useRef(params);
    const metricsRef = useRef(onMetrics);
    const lastSequence = useRef(music.sequence);
    const generators = useRef<Record<VisualMode, VisualGenerator>>({
      bloom: new BloomGenerator(),
      orbit: new OrbitGenerator(),
      ribbons: new RibbonsGenerator(),
      constellation: new ConstellationGenerator(),
    });
    musicRef.current = music;
    paramsRef.current = params;
    metricsRef.current = onMetrics;

    useImperativeHandle(ref, () => ({
      savePng: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = `music-bloom-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      },
      reset: () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        for (const generator of Object.values(generators.current))
          generator.reset(canvas.clientWidth, canvas.clientHeight);
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;

      let animationFrame = 0;
      let previous = performance.now();
      let lastRendered = 0;
      let visible = !document.hidden;
      let cssWidth = 1;
      let cssHeight = 1;
      let appliedRatio = 0;
      let adaptiveScale = 0.86;
      let lowFpsSamples = 0;
      let highFpsSamples = 0;
      let frameCounter = 0;
      let metricsStartedAt = previous;
      let lastMetricsAt = previous;
      let attackEnvelope = 0;
      let heldEnvelope = 0;
      let releaseEnvelope = 0;
      let sustainEnvelope = 0;
      let rhythmEnvelope = 0;
      let velocityEnvelope = 0.25;
      let lastMode = paramsRef.current.mode;
      let modeTransition = 0;

      const getQualityScale = (): number => {
        const setting = paramsRef.current.quality;
        return setting === "auto" ? adaptiveScale : qualityPreset[setting];
      };

      const getPixelRatio = (): number => {
        const quality = getQualityScale();
        const fullscreenPenalty = document.fullscreenElement ? 0.88 : 1;
        const ceiling =
          paramsRef.current.quality === "high"
            ? 2
            : paramsRef.current.quality === "low"
              ? 1
              : 1.6;
        return Math.max(
          1,
          Math.min(
            ceiling,
            (window.devicePixelRatio || 1) *
              (0.72 + quality * 0.38) *
              fullscreenPenalty,
          ),
        );
      };

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = getPixelRatio();
        cssWidth = Math.max(1, rect.width);
        cssHeight = Math.max(1, rect.height);
        appliedRatio = ratio;
        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(cssHeight * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.fillStyle = getPalette(paramsRef.current.paletteId).background;
        context.fillRect(0, 0, cssWidth, cssHeight);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();

      const onVisibility = () => {
        visible = !document.hidden;
        previous = performance.now();
        lastRendered = 0;
      };
      const onFullscreen = () => resize();
      document.addEventListener("visibilitychange", onVisibility);
      document.addEventListener("fullscreenchange", onFullscreen);

      const emitMetrics = (
        time: number,
        fps: number,
        calm: boolean,
        musicState: MusicalState,
        dynamics: VisualDynamics,
      ) => {
        const currentParams = paramsRef.current;
        if (currentParams.quality === "auto" && !calm) {
          if (fps < 47) {
            lowFpsSamples += 1;
            highFpsSamples = 0;
          } else if (fps > 57) {
            highFpsSamples += 1;
            lowFpsSamples = 0;
          } else {
            lowFpsSamples = Math.max(0, lowFpsSamples - 1);
            highFpsSamples = Math.max(0, highFpsSamples - 1);
          }
          if (lowFpsSamples >= 3 && adaptiveScale > 0.54) {
            adaptiveScale = Math.max(0.52, adaptiveScale - 0.12);
            lowFpsSamples = 0;
          } else if (highFpsSamples >= 5 && adaptiveScale < 1) {
            adaptiveScale = Math.min(1, adaptiveScale + 0.08);
            highFpsSamples = 0;
          }
        }

        const qualityScale = getQualityScale();
        const activeElements =
          generators.current[currentParams.mode].getActiveCount();
        metricsRef.current?.({
          fps: Math.round(fps),
          activeElements,
          qualityScale,
          qualityLabel:
            currentParams.quality === "auto"
              ? `Auto ${Math.round(qualityScale * 100)}%`
              : `${currentParams.quality[0].toUpperCase()}${currentParams.quality.slice(1)}`,
          heldNotes: musicState.notes.length,
          chordRoot: musicState.chord.root,
          chordQuality: musicState.chord.quality,
          attackEnergy: dynamics.attack,
          heldEnergy: dynamics.held,
          releaseEnergy: dynamics.release,
          sustainEnergy: dynamics.sustain,
        });
        lastMetricsAt = time;
        metricsStartedAt = time;
        frameCounter = 0;
      };

      const draw = (time: number) => {
        animationFrame = requestAnimationFrame(draw);
        if (!visible) return;

        const currentParams = paramsRef.current;
        const currentMusic = musicRef.current;
        const voices = calculateVisualVoices(currentMusic.noteLifecycles, time);
        const lastAttackAge = currentMusic.lastAttack
          ? Math.max(0, time - currentMusic.lastAttack.timestamp)
          : Number.POSITIVE_INFINITY;
        const liveRhythm = clamp(
          currentMusic.recentNotes.reduce(
            (sum, event) =>
              sum + Math.exp(-Math.max(0, time - event.timestamp) / 680),
            0,
          ) / 4.5,
          0,
          1,
        );
        const liveAttack = clamp(
          voices.reduce((sum, voice) => sum + voice.attack, 0) /
            Math.max(1, Math.sqrt(voices.length)),
          0,
          1,
        );
        const liveHeld = clamp(
          voices.reduce((sum, voice) => sum + voice.hold, 0) /
            Math.max(1, Math.sqrt(voices.length)),
          0,
          1,
        );
        const liveRelease = clamp(
          voices.reduce((sum, voice) => sum + voice.release, 0) /
            Math.max(1, Math.sqrt(voices.length)),
          0,
          1,
        );
        const liveSustain = clamp(
          voices.reduce((sum, voice) => sum + voice.sustain, 0) /
            Math.max(1, Math.sqrt(voices.length)),
          0,
          1,
        );
        const liveVelocity =
          (currentMusic.rollingAverageVelocity / 127) *
          (currentMusic.notes.length > 0 ? 1 : Math.exp(-lastAttackAge / 2600));
        if (currentParams.mode !== lastMode) {
          lastMode = currentParams.mode;
          modeTransition = 1;
        }
        const calm =
          voices.every((voice) => voice.energy < 0.025) &&
          attackEnvelope < 0.025 &&
          liveRhythm < 0.035;
        const activeFrameInterval =
          currentParams.quality === "low"
            ? 1000 / 60
            : currentParams.quality === "balanced"
              ? 1000 / 90
              : 1000 / 120;
        const targetFrameInterval = calm
          ? currentParams.reducedMotion
            ? 1000 / 18
            : 1000 / 30
          : currentParams.reducedMotion
            ? 1000 / 40
            : activeFrameInterval;
        // Tolerance avoids accidentally halving the frame rate when refresh
        // timing lands a fraction below the requested interval.
        if (time - lastRendered < Math.max(0, targetFrameInterval - 1)) return;

        const delta = Math.min(42, time - previous || 16.67);
        previous = time;
        lastRendered = time;
        frameCounter += 1;

        const desiredRatio = getPixelRatio();
        if (Math.abs(desiredRatio - appliedRatio) > 0.12) resize();

        if (currentMusic.sequence !== lastSequence.current) {
          if (currentMusic.lastAttack) {
            const attack = currentMusic.lastAttack;
            const triggered: HeldNote = currentMusic.notes.find(
              (note) => note.note === attack.note,
            ) ?? {
              note: attack.note,
              velocity: attack.velocity,
              startedAt: attack.timestamp,
              source: "screen",
              physicallyHeld: false,
              sustained: false,
            };
            generators.current[currentParams.mode].noteTriggered(
              triggered,
              currentMusic,
            );
            attackEnvelope = Math.max(
              attackEnvelope,
              0.28 + (attack.velocity / 127) * 0.72,
            );
          }
          lastSequence.current = currentMusic.sequence;
        }

        attackEnvelope = Math.max(
          liveAttack,
          attackEnvelope * Math.exp(-delta / 260),
        );
        const responseRate =
          (0.003 + currentParams.responsiveness * 0.00012) *
          (currentParams.reducedMotion ? 0.45 : 1);
        const smooth = 1 - Math.exp(-delta * responseRate);
        heldEnvelope = lerp(heldEnvelope, liveHeld, smooth);
        releaseEnvelope = lerp(releaseEnvelope, liveRelease, smooth * 0.7);
        sustainEnvelope = lerp(sustainEnvelope, liveSustain, smooth * 0.6);
        rhythmEnvelope = lerp(rhythmEnvelope, liveRhythm, smooth);
        velocityEnvelope = lerp(velocityEnvelope, liveVelocity, smooth * 0.8);
        const chordStability = clamp(
          (time - currentMusic.chordChangedAt) / 900,
          0,
          1,
        );
        const dynamics: VisualDynamics = {
          attack: attackEnvelope,
          held: heldEnvelope,
          release: releaseEnvelope,
          sustain: sustainEnvelope,
          rhythm: rhythmEnvelope,
          velocity: velocityEnvelope,
          intensity: clamp(
            0.1 +
              attackEnvelope * 0.45 +
              heldEnvelope * 0.28 +
              rhythmEnvelope * 0.22 +
              sustainEnvelope * 0.08,
            0,
            1,
          ),
          chordStability,
        };

        const palette = getPalette(currentParams.paletteId);
        const fade =
          Math.max(0.02, (108 - currentParams.trails) / 430) *
          (currentMusic.sustain ? 0.58 : 1);
        context.globalCompositeOperation = "source-over";
        context.shadowBlur = 0;
        context.fillStyle = rgba(palette.background, Math.min(0.29, fade));
        context.fillRect(0, 0, cssWidth, cssHeight);
        if (modeTransition > 0.01) {
          context.fillStyle = rgba(palette.background, modeTransition * 0.34);
          context.fillRect(0, 0, cssWidth, cssHeight);
          modeTransition *= Math.exp(-delta / 120);
        }
        if (currentParams.background > 0) {
          context.fillStyle = rgba(
            palette.colors[0],
            currentParams.background / 5000,
          );
          context.fillRect(0, 0, cssWidth, cssHeight);
        }

        const qualityScale = getQualityScale();
        generators.current[currentParams.mode].render(context, {
          width: cssWidth,
          height: cssHeight,
          time,
          delta,
          params: currentParams,
          music: currentMusic,
          colors: palette.colors,
          background: palette.background,
          qualityScale,
          dynamics,
          voices,
        });

        if (time - lastMetricsAt > 800) {
          const fps =
            (frameCounter * 1000) / Math.max(1, time - metricsStartedAt);
          emitMetrics(time, fps, calm, currentMusic, dynamics);
        }
      };

      animationFrame = requestAnimationFrame(draw);
      return () => {
        cancelAnimationFrame(animationFrame);
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("fullscreenchange", onFullscreen);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        className="art-canvas"
        aria-label="Live generative artwork responding to your notes"
      />
    );
  },
);
