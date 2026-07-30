import type {
  ColorPalette,
  MusicalState,
  VisualDynamics,
  VisualParameters,
} from "../types";
import { mixColor } from "../utils/color";
import { clamp, hashNoise, lerp } from "../utils/math";
import { applyAdvancedParameters } from "./definitions";
import type {
  AdvancedValues,
  LaboratoryRenderState,
  LaboratoryScene,
  LfoShape,
  MacroAssignment,
  MacroCurve,
  ModulationRoute,
  ResolvedLaboratoryFrame,
} from "./types";

const numericParameterKeys: Array<keyof VisualParameters> = [
  "density",
  "speed",
  "rotation",
  "symmetry",
  "trails",
  "glow",
  "bloom",
  "responsiveness",
  "background",
  "idle",
  "recipeSeed",
];

export function applyMacroCurve(value: number, curve: MacroCurve): number {
  const t = clamp(value, 0, 1);
  if (curve === "ease-in") return t * t;
  if (curve === "ease-out") return 1 - (1 - t) ** 2;
  if (curve === "s-curve") return t * t * (3 - 2 * t);
  return t;
}

export function scaleMacroAssignment(
  macroValue: number,
  assignment: MacroAssignment,
): number {
  let t = applyMacroCurve(macroValue / 100, assignment.curve);
  if (assignment.invert) t = 1 - t;
  const target = lerp(assignment.min, assignment.max, t);
  const center = (assignment.min + assignment.max) / 2;
  return lerp(center, target, clamp(assignment.weight / 100, 0, 1));
}

function assignTarget(
  scene: LaboratoryScene,
  target: string,
  value: number,
): LaboratoryScene {
  if (target.startsWith("shared.")) {
    const key = target.slice(7) as keyof VisualParameters;
    if (!numericParameterKeys.includes(key)) return scene;
    const min = key === "symmetry" ? 3 : 0;
    const max =
      key === "symmetry" ? 14 : key === "recipeSeed" ? 999_999_999 : 100;
    return {
      ...scene,
      params: { ...scene.params, [key]: clamp(Math.round(value), min, max) },
    };
  }
  if (target.startsWith("advanced."))
    return {
      ...scene,
      advanced: {
        ...scene.advanced,
        [target.slice(9)]: clamp(value, 0, 100),
      },
    };
  if (target.startsWith("response."))
    return {
      ...scene,
      response: {
        ...scene.response,
        [target.slice(9)]: clamp(value, 0, 100),
      },
    };
  if (target === "palette-position")
    return {
      ...scene,
      advanced: {
        ...scene.advanced,
        "global.palettePosition": clamp(value, 0, 100),
      },
    };
  return scene;
}

export function applyMacros(scene: LaboratoryScene): LaboratoryScene {
  let resolved = scene;
  for (const macro of scene.macros)
    for (const assignment of macro.assignments)
      resolved = assignTarget(
        resolved,
        assignment.target,
        scaleMacroAssignment(macro.value, assignment),
      );
  return resolved;
}

export function evaluateLfo(shape: LfoShape, phase: number, seed = 0): number {
  const p = ((phase % 1) + 1) % 1;
  if (shape === "triangle") return 1 - Math.abs(p * 4 - 2);
  if (shape === "saw") return p * 2 - 1;
  if (shape === "square") return p < 0.5 ? 1 : -1;
  if (shape === "smooth-random") {
    const step = Math.floor(phase);
    const t = phase - step;
    const eased = t * t * (3 - 2 * t);
    return lerp(
      hashNoise(step + seed) * 2 - 1,
      hashNoise(step + seed + 1) * 2 - 1,
      eased,
    );
  }
  return Math.sin(p * Math.PI * 2);
}

export function evaluateModulationSource(
  route: Pick<ModulationRoute, "source" | "shape">,
  music: MusicalState,
  dynamics: VisualDynamics,
  time: number,
  seed = 0,
): number {
  switch (route.source) {
    case "lfo-slow":
      return evaluateLfo(route.shape, time / 18_000, seed);
    case "lfo-medium":
      return evaluateLfo(route.shape, time / 6_000, seed);
    case "lfo-fast":
      return evaluateLfo(route.shape, time / 1_800, seed);
    case "random-drift":
      return evaluateLfo("smooth-random", time / 8_000, seed);
    case "velocity":
      return clamp(music.rollingAverageVelocity / 127, 0, 1) * 2 - 1;
    case "register":
      return clamp((music.averageRegister - 36) / 60, 0, 1) * 2 - 1;
    case "held-count":
      return clamp(music.notes.length / 8, 0, 1) * 2 - 1;
    case "rhythm":
      return clamp(music.rhythmicActivity, 0, 1) * 2 - 1;
    case "tension":
      return clamp(music.tension, 0, 1) * 2 - 1;
    case "attack":
      return dynamics.attack * 2 - 1;
    case "held":
      return dynamics.held * 2 - 1;
    case "release":
      return dynamics.release * 2 - 1;
    case "sustain":
      return music.sustain ? 1 : -1;
  }
}

export function applyModulationValue(
  base: number,
  sourceValue: number,
  route: Pick<ModulationRoute, "amount" | "polarity" | "min" | "max">,
): number {
  const source =
    route.polarity === "unipolar"
      ? clamp((sourceValue + 1) / 2, 0, 1)
      : clamp(sourceValue, -1, 1);
  return clamp(base + source * route.amount, route.min, route.max);
}

function evaluateSmoothedSource(
  route: ModulationRoute,
  music: MusicalState,
  dynamics: VisualDynamics,
  time: number,
  seed: number,
): number {
  const current = evaluateModulationSource(route, music, dynamics, time, seed);
  if (route.smoothing <= 0) return current;
  const earlier = evaluateModulationSource(
    route,
    music,
    dynamics,
    time - route.smoothing * 18,
    seed,
  );
  return lerp(current, earlier, clamp(route.smoothing / 140, 0, 0.72));
}

function currentTargetValue(
  scene: LaboratoryScene,
  target: string,
): number | null {
  if (target.startsWith("shared.")) {
    const value = scene.params[target.slice(7) as keyof VisualParameters];
    return typeof value === "number" ? value : null;
  }
  if (target.startsWith("advanced."))
    return scene.advanced[target.slice(9)] ?? 50;
  if (target.startsWith("response.")) {
    const value =
      scene.response[target.slice(9) as keyof typeof scene.response];
    return typeof value === "number" ? value : null;
  }
  if (target === "palette-position")
    return scene.advanced["global.palettePosition"] ?? 50;
  return null;
}

export function applyModulation(
  scene: LaboratoryScene,
  routes: ModulationRoute[],
  music: MusicalState,
  dynamics: VisualDynamics,
  time: number,
): LaboratoryScene {
  let resolved = scene;
  routes.slice(0, 16).forEach((route, index) => {
    if (
      !route.enabled ||
      route.target === "morph" ||
      route.target.startsWith("macro-")
    )
      return;
    const base = currentTargetValue(resolved, route.target);
    if (base === null) return;
    const source = evaluateSmoothedSource(
      route,
      music,
      dynamics,
      time,
      index * 37,
    );
    resolved = assignTarget(
      resolved,
      route.target,
      applyModulationValue(base, source, route),
    );
  });
  return resolved;
}

export function interpolatePalette(
  a: ColorPalette,
  b: ColorPalette,
  amount: number,
): ColorPalette {
  const count = Math.max(a.colors.length, b.colors.length);
  const colors = Array.from({ length: count }, (_, index) =>
    mixColor(
      a.colors[index % a.colors.length],
      b.colors[index % b.colors.length],
      amount,
    ),
  );
  return {
    id: `morph-${a.id}-${b.id}`,
    name: `${a.name} / ${b.name}`,
    colors,
    background: mixColor(a.background, b.background, amount),
  };
}

export function interpolateScenes(
  a: LaboratoryScene,
  b: LaboratoryScene,
  amount: number,
): LaboratoryScene {
  const t = clamp(amount, 0, 1);
  const params = { ...a.params };
  for (const key of numericParameterKeys)
    params[key] = lerp(
      Number(a.params[key]),
      Number(b.params[key]),
      t,
    ) as never;
  params.symmetry = Math.round(params.symmetry);
  params.recipeSeed = t < 0.5 ? a.params.recipeSeed : b.params.recipeSeed;
  params.paletteId = t < 0.5 ? a.params.paletteId : b.params.paletteId;
  params.mode = t < 0.5 ? a.params.mode : b.params.mode;
  params.autoMotion = t < 0.5 ? a.params.autoMotion : b.params.autoMotion;
  params.reducedMotion = a.params.reducedMotion || b.params.reducedMotion;
  params.quality = t < 0.5 ? a.params.quality : b.params.quality;

  const advancedKeys = new Set([
    ...Object.keys(a.advanced),
    ...Object.keys(b.advanced),
  ]);
  const advanced: AdvancedValues = {};
  for (const key of advancedKeys)
    advanced[key] = lerp(a.advanced[key] ?? 50, b.advanced[key] ?? 50, t);

  return {
    version: 1,
    params,
    advanced,
    response: {
      velocity: lerp(a.response.velocity, b.response.velocity, t),
      register: lerp(a.response.register, b.response.register, t),
      rhythm: lerp(a.response.rhythm, b.response.rhythm, t),
      tension: lerp(a.response.tension, b.response.tension, t),
      attack: lerp(a.response.attack, b.response.attack, t),
      release: lerp(a.response.release, b.response.release, t),
    },
    macros: t < 0.5 ? a.macros : b.macros,
    modulationRoutes: t < 0.5 ? a.modulationRoutes : b.modulationRoutes,
  };
}

function resolveScene(
  scene: LaboratoryScene,
  music: MusicalState,
  dynamics: VisualDynamics,
  time: number,
): LaboratoryScene {
  const routedMacros = scene.macros.map((macro, macroIndex) => {
    const route = scene.modulationRoutes.find(
      (item) => item.enabled && item.target === macro.id,
    );
    if (!route) return macro;
    const source = evaluateSmoothedSource(
      route,
      music,
      dynamics,
      time,
      700 + macroIndex,
    );
    return {
      ...macro,
      value: applyModulationValue(macro.value, source, route),
    };
  });
  const macrosApplied = applyMacros({ ...scene, macros: routedMacros });
  const modulated = applyModulation(
    macrosApplied,
    scene.modulationRoutes,
    music,
    dynamics,
    time,
  );
  return {
    ...modulated,
    params: applyAdvancedParameters(
      modulated.params,
      modulated.advanced,
      modulated.response,
    ),
  };
}

export function resolveLaboratoryFrame(
  laboratory: LaboratoryRenderState,
  music: MusicalState,
  dynamics: VisualDynamics,
  time: number,
): ResolvedLaboratoryFrame {
  const withLiveMacroValues = (scene: LaboratoryScene): LaboratoryScene => ({
    ...scene,
    macros: scene.macros.map((macro) => ({
      ...macro,
      value:
        laboratory.macros.find((liveMacro) => liveMacro.id === macro.id)
          ?.value ?? macro.value,
    })),
  });
  const sceneA = withLiveMacroValues(laboratory.sceneA);
  const sceneB = withLiveMacroValues(laboratory.sceneB);
  let morph = clamp(laboratory.morph / 100, 0, 1);
  const morphRoute = laboratory.modulationRoutes.find(
    (route) => route.enabled && route.target === "morph",
  );
  if (morphRoute) {
    const source = evaluateSmoothedSource(
      morphRoute,
      music,
      dynamics,
      time,
      991,
    );
    morph = applyModulationValue(morph * 100, source, morphRoute) / 100;
  }
  const routeCount = new Set(
    [
      ...laboratory.modulationRoutes,
      ...sceneA.modulationRoutes,
      ...sceneB.modulationRoutes,
    ]
      .filter((route) => route.enabled)
      .map((route) => route.id),
  ).size;
  if (sceneA.params.mode === sceneB.params.mode) {
    const interpolated = interpolateScenes(sceneA, sceneB, morph);
    return {
      primary: resolveScene(interpolated, music, dynamics, time),
      secondary: null,
      primaryOpacity: 1,
      secondaryOpacity: 0,
      dualRender: false,
      activeRoutes: routeCount,
      morph,
    };
  }
  return {
    primary: resolveScene(sceneA, music, dynamics, time),
    secondary: resolveScene(sceneB, music, dynamics, time),
    primaryOpacity: Math.cos(morph * Math.PI * 0.5) ** 2,
    secondaryOpacity: Math.sin(morph * Math.PI * 0.5) ** 2,
    dualRender: true,
    activeRoutes: routeCount,
    morph,
  };
}
