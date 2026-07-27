import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getPalette } from "../presets/palettes";
import type {
  MusicalState,
  VisualGenerator,
  VisualMode,
  VisualParameters,
} from "../types";
import { rgba } from "../utils/color";
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
}

export const VisualCanvas = forwardRef<VisualCanvasHandle, VisualCanvasProps>(
  function VisualCanvas({ music, params }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const musicRef = useRef(music);
    const paramsRef = useRef(params);
    const lastSequence = useRef(music.sequence);
    const generators = useRef<Record<VisualMode, VisualGenerator>>({
      bloom: new BloomGenerator(),
      orbit: new OrbitGenerator(),
      ribbons: new RibbonsGenerator(),
      constellation: new ConstellationGenerator(),
    });
    musicRef.current = music;
    paramsRef.current = params;

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
        const context = canvas.getContext("2d");
        context?.clearRect(0, 0, canvas.width, canvas.height);
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      let animationFrame = 0;
      let previous = performance.now();
      let visible = !document.hidden;
      let cssWidth = 1;
      let cssHeight = 1;

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        cssWidth = Math.max(1, rect.width);
        cssHeight = Math.max(1, rect.height);
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
      };
      document.addEventListener("visibilitychange", onVisibility);

      const draw = (time: number) => {
        animationFrame = requestAnimationFrame(draw);
        if (!visible) return;
        const delta = Math.min(40, time - previous);
        previous = time;
        const currentParams = paramsRef.current;
        const currentMusic = musicRef.current;
        const palette = getPalette(currentParams.paletteId);

        if (
          currentMusic.sequence !== lastSequence.current &&
          currentMusic.lastNote !== null
        ) {
          const triggered = currentMusic.notes.find(
            (note) => note.note === currentMusic.lastNote,
          );
          if (triggered)
            generators.current[currentParams.mode].noteTriggered(
              triggered,
              currentMusic,
            );
          lastSequence.current = currentMusic.sequence;
        }

        const fade =
          Math.max(0.012, (105 - currentParams.trails) / 580) *
          (currentMusic.sustain ? 0.6 : 1);
        context.globalCompositeOperation = "source-over";
        context.shadowBlur = 0;
        context.fillStyle = rgba(palette.background, Math.min(0.24, fade));
        context.fillRect(0, 0, cssWidth, cssHeight);
        if (currentParams.background > 0) {
          context.fillStyle = rgba(
            palette.colors[0],
            currentParams.background / 4200,
          );
          context.fillRect(0, 0, cssWidth, cssHeight);
        }

        generators.current[currentParams.mode].render(context, {
          width: cssWidth,
          height: cssHeight,
          time,
          delta,
          params: currentParams,
          music: currentMusic,
          colors: palette.colors,
          background: palette.background,
        });
      };
      animationFrame = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(animationFrame);
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
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
