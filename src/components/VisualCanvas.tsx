import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getPalette } from "../presets/palettes";
import { interpolatePalette, resolveLaboratoryFrame } from "../lab/engine";
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
import type { LaboratoryRenderState, LaboratoryScene } from "../lab/types";
import { rgba } from "../utils/color";
import { clamp, lerp } from "../utils/math";
import { BloomGenerator } from "../visuals/BloomGenerator";
import { ConstellationGenerator } from "../visuals/ConstellationGenerator";
import { ForestGenerator } from "../visuals/ForestGenerator";
import { GeometryGenerator } from "../visuals/GeometryGenerator";
import { JellyfishGenerator } from "../visuals/JellyfishGenerator";
import { MetalGenerator } from "../visuals/MetalGenerator";
import { NebulaGenerator } from "../visuals/NebulaGenerator";
import { OrbitGenerator } from "../visuals/OrbitGenerator";
import { PortalGenerator } from "../visuals/PortalGenerator";
import { RibbonsGenerator } from "../visuals/RibbonsGenerator";

export interface VisualCanvasHandle {
  savePng: () => void;
  reset: () => void;
}

interface VisualCanvasProps {
  music: MusicalState;
  params: VisualParameters;
  physicalSustain: boolean;
  simulatedSustain: boolean;
  onMetrics?: (metrics: RenderMetrics) => void;
  laboratory?: LaboratoryRenderState;
}

const qualityPreset: Record<Exclude<RenderQuality, "auto">, number> = {
  high: 1,
  balanced: 0.76,
  low: 0.52,
};

export const VisualCanvas = forwardRef<VisualCanvasHandle, VisualCanvasProps>(
  function VisualCanvas(
    { music, params, physicalSustain, simulatedSustain, onMetrics, laboratory },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const musicRef = useRef(music);
    const paramsRef = useRef(params);
    const metricsRef = useRef(onMetrics);
    const laboratoryRef = useRef(laboratory);
    const sustainSourcesRef = useRef({
      physical: physicalSustain,
      simulated: simulatedSustain,
    });
    const lastSequence = useRef(music.sequence);
    const generators = useRef<Record<VisualMode, VisualGenerator>>({
      bloom: new BloomGenerator(),
      orbit: new OrbitGenerator(),
      ribbons: new RibbonsGenerator(),
      constellation: new ConstellationGenerator(),
      jellyfish: new JellyfishGenerator(),
      geometry: new GeometryGenerator(),
      nebula: new NebulaGenerator(),
      forest: new ForestGenerator(),
      metal: new MetalGenerator(),
      portal: new PortalGenerator(),
    });
    musicRef.current = music;
    paramsRef.current = params;
    metricsRef.current = onMetrics;
    laboratoryRef.current = laboratory;
    sustainSourcesRef.current = {
      physical: physicalSustain,
      simulated: simulatedSustain,
    };

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
      let adaptiveScale = 0.84;
      let lowFpsSamples = 0;
      let highFpsSamples = 0;
      let frameCounter = 0;
      let renderCostTotal = 0;
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
      let cachedPaletteId = paramsRef.current.paletteId;
      let cachedPalette = getPalette(cachedPaletteId);
      let lastDualRender = false;
      let lastActiveRoutes = 0;
      let laboratoryFrameCost = 0;
      const layerA = document.createElement("canvas");
      const layerB = document.createElement("canvas");
      const layerContextA = layerA.getContext("2d");
      const layerContextB = layerB.getContext("2d");

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
          0.9,
          Math.min(
            ceiling,
            (window.devicePixelRatio || 1) *
              (0.48 + quality * 0.42) *
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
        layerA.width = canvas.width;
        layerA.height = canvas.height;
        layerB.width = canvas.width;
        layerB.height = canvas.height;
        layerContextA?.setTransform(ratio, 0, 0, ratio, 0, 0);
        layerContextB?.setTransform(ratio, 0, 0, ratio, 0, 0);
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
        voices: ReturnType<typeof calculateVisualVoices>,
      ) => {
        const currentParams = paramsRef.current;
        if (currentParams.quality === "auto" && !calm) {
          if (fps < 55) {
            lowFpsSamples += fps < 36 ? 3 : 1;
            highFpsSamples = 0;
          } else if (fps > 58) {
            highFpsSamples += 1;
            lowFpsSamples = 0;
          } else {
            lowFpsSamples = Math.max(0, lowFpsSamples - 1);
            highFpsSamples = Math.max(0, highFpsSamples - 1);
          }
          if (lowFpsSamples >= 2 && adaptiveScale > 0.44) {
            adaptiveScale = Math.max(
              0.42,
              adaptiveScale - (fps < 36 ? 0.18 : fps < 48 ? 0.12 : 0.08),
            );
            lowFpsSamples = 0;
          } else if (highFpsSamples >= 10 && adaptiveScale < 1) {
            adaptiveScale = Math.min(1, adaptiveScale + 0.04);
            highFpsSamples = 0;
          }
        }

        const qualityScale = getQualityScale();
        const laboratoryState = laboratoryRef.current;
        const activeModes = laboratoryState?.enabled
          ? new Set([
              laboratoryState.sceneA.params.mode,
              laboratoryState.sceneB.params.mode,
            ])
          : new Set([currentParams.mode]);
        const activeElements =
          [...activeModes].reduce(
            (total, mode) => total + generators.current[mode].getActiveCount(),
            0,
          ) + voices.length;
        let attackingNotes = 0;
        let heldPhaseNotes = 0;
        let sustainedNotes = 0;
        let releasingNotes = 0;
        let longestHeldDuration = 0;
        for (const voice of voices) {
          if (voice.phase === "attack") attackingNotes += 1;
          else if (voice.phase === "held") heldPhaseNotes += 1;
          else if (voice.phase === "sustain") sustainedNotes += 1;
          else releasingNotes += 1;
          if (voice.phase !== "release")
            longestHeldDuration = Math.max(
              longestHeldDuration,
              voice.heldDuration,
            );
        }
        const sustainSources = sustainSourcesRef.current;
        metricsRef.current?.({
          fps: Math.round(fps),
          frameCostMs: renderCostTotal / Math.max(1, frameCounter),
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
          attackingNotes,
          heldPhaseNotes,
          sustainedNotes,
          releasingNotes,
          longestHeldDuration,
          simulatedSustain: sustainSources.simulated,
          physicalSustain: sustainSources.physical,
          activeModulationRoutes: lastActiveRoutes,
          dualRender: lastDualRender,
          laboratoryFrameCostMs:
            laboratoryFrameCost / Math.max(1, frameCounter),
        });
        lastMetricsAt = time;
        metricsStartedAt = time;
        frameCounter = 0;
        renderCostTotal = 0;
        laboratoryFrameCost = 0;
      };

      const draw = (time: number) => {
        animationFrame = requestAnimationFrame(draw);
        if (!visible) return;

        const currentParams = paramsRef.current;
        const currentMusic = musicRef.current;
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
        const laboratoryState = laboratoryRef.current;
        const previewMode =
          laboratoryState?.enabled && laboratoryState.morph >= 50
            ? laboratoryState.sceneB.params.mode
            : laboratoryState?.enabled
              ? laboratoryState.sceneA.params.mode
              : currentParams.mode;
        if (previewMode !== lastMode) {
          lastMode = previewMode;
          modeTransition = 1;
        }
        const hasLiveLifecycle = currentMusic.noteLifecycles.some(
          (voice) =>
            voice.releasedAt === null || time - voice.releasedAt < 4200,
        );
        const calm =
          !hasLiveLifecycle && attackEnvelope < 0.025 && liveRhythm < 0.035;
        const activeFrameInterval =
          currentParams.quality === "high" ? 1000 / 90 : 1000 / 60;
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

        // Lifecycle objects are created only for frames that will actually be
        // rendered, avoiding work on skipped high-refresh callbacks.
        const voices = calculateVisualVoices(currentMusic.noteLifecycles, time);
        let attackTotal = 0;
        let heldTotal = 0;
        let releaseTotal = 0;
        let sustainTotal = 0;
        for (const voice of voices) {
          attackTotal += voice.attack;
          heldTotal += voice.hold;
          releaseTotal += voice.release;
          sustainTotal += voice.sustain;
        }
        const voiceDivisor = Math.max(1, Math.sqrt(voices.length));
        const liveAttack = clamp(attackTotal / voiceDivisor, 0, 1);
        const liveHeld = clamp(heldTotal / voiceDivisor, 0, 1);
        const liveRelease = clamp(releaseTotal / voiceDivisor, 0, 1);
        const liveSustain = clamp(sustainTotal / voiceDivisor, 0, 1);
        const liveVelocity =
          (currentMusic.rollingAverageVelocity / 127) *
          (currentMusic.notes.length > 0 ? 1 : Math.exp(-lastAttackAge / 2600));

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
            const triggerModes = laboratoryState?.enabled
              ? new Set([
                  laboratoryState.sceneA.params.mode,
                  laboratoryState.sceneB.params.mode,
                ])
              : new Set([currentParams.mode]);
            for (const mode of triggerModes)
              generators.current[mode].noteTriggered(triggered, currentMusic);
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

        const renderStartedAt = performance.now();
        const resolved = laboratoryState?.enabled
          ? resolveLaboratoryFrame(
              laboratoryState,
              currentMusic,
              dynamics,
              time,
            )
          : null;
        const primaryScene: LaboratoryScene | null = resolved?.primary ?? null;
        const effectiveParams = primaryScene?.params ?? currentParams;
        const customPalettes = laboratoryState?.customPalettes ?? [];
        const getRenderedPalette = (paletteId: string) =>
          laboratoryState?.palettePreview?.sourcePaletteId === paletteId
            ? laboratoryState.palettePreview.palette
            : getPalette(paletteId, customPalettes);
        if (!resolved && currentParams.paletteId !== cachedPaletteId) {
          cachedPaletteId = currentParams.paletteId;
          cachedPalette = getPalette(cachedPaletteId, customPalettes);
        }
        let palette = resolved
          ? getRenderedPalette(resolved.primary.params.paletteId)
          : cachedPalette;
        if (resolved && laboratoryState) {
          const paletteA = getRenderedPalette(
            laboratoryState.sceneA.params.paletteId,
          );
          const paletteB = getRenderedPalette(
            laboratoryState.sceneB.params.paletteId,
          );
          palette = interpolatePalette(paletteA, paletteB, resolved.morph);
        }
        const fade =
          Math.max(0.02, (108 - effectiveParams.trails) / 430) *
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
        if (effectiveParams.background > 0) {
          context.fillStyle = rgba(
            palette.colors[0],
            effectiveParams.background / 5000,
          );
          context.fillRect(0, 0, cssWidth, cssHeight);
        }

        const qualityScale = getQualityScale();
        const renderScene = (
          targetContext: CanvasRenderingContext2D,
          scene: LaboratoryScene | null,
          opacity = 1,
          internalQuality = qualityScale,
        ) => {
          const sceneParams = scene?.params ?? currentParams;
          let scenePalette =
            scene && resolved?.dualRender
              ? getRenderedPalette(scene.params.paletteId)
              : palette;
          const scenePaletteOffset = Math.round(
            scene?.advanced["global.palettePosition"] ?? 0,
          );
          if (scenePaletteOffset)
            scenePalette = {
              ...scenePalette,
              colors: scenePalette.colors.map(
                (_, index, colors) =>
                  colors[
                    (index +
                      Math.round((scenePaletteOffset / 100) * colors.length)) %
                      colors.length
                  ],
              ),
            };
          generators.current[sceneParams.mode].render(targetContext, {
            width: cssWidth,
            height: cssHeight,
            time,
            delta,
            params: sceneParams,
            music: currentMusic,
            colors: scenePalette.colors,
            background: scenePalette.background,
            qualityScale: internalQuality,
            dynamics,
            voices,
            advanced: scene?.advanced ?? {},
          });
          targetContext.globalAlpha = opacity;
        };
        lastDualRender = Boolean(
          resolved?.dualRender &&
          resolved.secondary &&
          layerContextA &&
          layerContextB,
        );
        lastActiveRoutes = resolved?.activeRoutes ?? 0;
        const labStartedAt = performance.now();
        if (
          resolved?.dualRender &&
          resolved.secondary &&
          layerContextA &&
          layerContextB
        ) {
          for (const layerContext of [layerContextA, layerContextB]) {
            layerContext.save();
            layerContext.setTransform(1, 0, 0, 1, 0, 0);
            layerContext.clearRect(0, 0, layerA.width, layerA.height);
            layerContext.restore();
          }
          // Two worlds share the same lifecycle input, but each receives a
          // bounded detail budget to avoid a 2x thermal cost.
          const dualQuality = qualityScale * 0.64;
          renderScene(layerContextA, resolved.primary, 1, dualQuality);
          renderScene(layerContextB, resolved.secondary, 1, dualQuality);
          context.save();
          context.globalCompositeOperation = "lighter";
          context.globalAlpha = resolved.primaryOpacity;
          context.drawImage(layerA, 0, 0, cssWidth, cssHeight);
          context.globalAlpha = resolved.secondaryOpacity;
          context.drawImage(layerB, 0, 0, cssWidth, cssHeight);
          context.restore();
        } else {
          renderScene(context, primaryScene, 1, qualityScale);
        }
        laboratoryFrameCost += performance.now() - labStartedAt;
        renderCostTotal += performance.now() - renderStartedAt;

        if (time - lastMetricsAt > 800) {
          const fps =
            (frameCounter * 1000) / Math.max(1, time - metricsStartedAt);
          emitMetrics(time, fps, calm, currentMusic, dynamics, voices);
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
