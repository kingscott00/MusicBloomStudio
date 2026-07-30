import type { VisualMode, VisualParameters } from "../types";
import { clamp } from "../utils/math";
import type {
  AdvancedControlDefinition,
  AdvancedValues,
  ExperienceAdvancedDefinitions,
  MacroControl,
  MusicalResponseSettings,
} from "./types";

const control = (
  id: string,
  label: string,
  group: AdvancedControlDefinition["group"],
  description: string,
  defaultValue = 50,
): AdvancedControlDefinition => ({
  id,
  label,
  group,
  description,
  defaultValue,
});

export const advancedDefinitions: ExperienceAdvancedDefinitions = {
  bloom: [
    control(
      "bloom.petalCount",
      "Petal count",
      "Form",
      "Layers around each bloom",
      58,
    ),
    control(
      "bloom.curvature",
      "Petal curvature",
      "Form",
      "How strongly petals curl",
      64,
    ),
    control(
      "bloom.core",
      "Inner-core size",
      "Form",
      "Weight of the luminous center",
      45,
    ),
    control(
      "bloom.tendrils",
      "Tendril length",
      "Motion",
      "Reach of drifting filaments",
      62,
    ),
    control(
      "bloom.breath",
      "Breathing depth",
      "Motion",
      "Slow organic expansion",
      55,
    ),
    control(
      "bloom.shedding",
      "Release shedding",
      "Musical Response",
      "Particles released at note-off",
      48,
    ),
  ],
  orbit: [
    control(
      "orbit.rings",
      "Ring count",
      "Form",
      "Number of orbital layers",
      55,
    ),
    control(
      "orbit.eccentricity",
      "Orbital eccentricity",
      "Form",
      "Stretch circular paths",
      42,
    ),
    control(
      "orbit.gravity",
      "Gravity strength",
      "Motion",
      "Pull toward the central mass",
      60,
    ),
    control(
      "orbit.spread",
      "Orbiter spread",
      "Composition",
      "Distance between orbital bodies",
      55,
    ),
    control(
      "orbit.precession",
      "Precession",
      "Motion",
      "Independent ring rotation",
      48,
    ),
    control(
      "orbit.releaseDrift",
      "Release drift",
      "Musical Response",
      "How released bodies escape",
      45,
    ),
  ],
  ribbons: [
    control(
      "ribbons.width",
      "Ribbon width",
      "Form",
      "Thickness of each luminous strand",
      52,
    ),
    control(
      "ribbons.strands",
      "Strand count",
      "Form",
      "Parallel melodic voices",
      58,
    ),
    control(
      "ribbons.turbulence",
      "Flow turbulence",
      "Motion",
      "Organic lateral movement",
      43,
    ),
    control(
      "ribbons.steering",
      "Melodic steering",
      "Musical Response",
      "Pitch motion bends the flow",
      72,
    ),
    control(
      "ribbons.twist",
      "Twist",
      "Motion",
      "Rotation through the ribbon body",
      50,
    ),
    control(
      "ribbons.unravel",
      "Release unraveling",
      "Musical Response",
      "How strands loosen after release",
      56,
    ),
  ],
  constellation: [
    control(
      "constellation.stars",
      "Star density",
      "Form",
      "Number of persistent points",
      58,
    ),
    control(
      "constellation.links",
      "Connection distance",
      "Composition",
      "Reach of constellation links",
      48,
    ),
    control(
      "constellation.pulse",
      "Pulse radius",
      "Musical Response",
      "Size of note-on ripples",
      64,
    ),
    control(
      "constellation.cluster",
      "Cluster strength",
      "Composition",
      "Gravity between related stars",
      56,
    ),
    control(
      "constellation.depth",
      "Spatial depth",
      "Form",
      "Parallax separation",
      60,
    ),
    control(
      "constellation.fragment",
      "Release fragmentation",
      "Musical Response",
      "Stars dispersed at release",
      42,
    ),
  ],
  jellyfish: [
    control(
      "jellyfish.bell",
      "Bell size",
      "Form",
      "Scale of each translucent bell",
      58,
    ),
    control(
      "jellyfish.translucency",
      "Bell translucency",
      "Light",
      "Layered depth through the body",
      65,
    ),
    control(
      "jellyfish.tendrils",
      "Tendril count",
      "Form",
      "Filaments beneath each bell",
      60,
    ),
    control(
      "jellyfish.curl",
      "Tendril curl",
      "Motion",
      "Amount of lyrical curling",
      55,
    ),
    control(
      "jellyfish.drift",
      "Swimming drift",
      "Motion",
      "Slow collective travel",
      44,
    ),
    control(
      "jellyfish.spacing",
      "School spacing",
      "Composition",
      "Distance between organisms",
      52,
    ),
  ],
  geometry: [
    control(
      "geometry.layers",
      "Ring layers",
      "Form",
      "Nested harmonic structures",
      60,
    ),
    control(
      "geometry.order",
      "Polygon order",
      "Form",
      "Geometric rotational order",
      55,
    ),
    control(
      "geometry.lattice",
      "Lattice complexity",
      "Form",
      "Density of connecting lines",
      48,
    ),
    control(
      "geometry.spacing",
      "Radial spacing",
      "Composition",
      "Air between structures",
      57,
    ),
    control(
      "geometry.closure",
      "Harmonic closure",
      "Musical Response",
      "How completely figures resolve",
      70,
    ),
    control(
      "geometry.fracture",
      "Fracture amount",
      "Musical Response",
      "Tension-driven discontinuity",
      24,
    ),
  ],
  nebula: [
    control(
      "nebula.spread",
      "Cloud spread",
      "Composition",
      "Width of the cosmic field",
      62,
    ),
    control(
      "nebula.dust",
      "Dust density",
      "Form",
      "Fine particulate detail",
      58,
    ),
    control(
      "nebula.birth",
      "Star birth rate",
      "Musical Response",
      "New highlights on attacks",
      52,
    ),
    control(
      "nebula.turbulence",
      "Turbulence",
      "Motion",
      "Cloud deformation",
      46,
    ),
    control(
      "nebula.core",
      "Core brightness",
      "Light",
      "Radiance of dense regions",
      64,
    ),
    control(
      "nebula.parallax",
      "Depth parallax",
      "Motion",
      "Separation of depth layers",
      56,
    ),
  ],
  forest: [
    control(
      "forest.depth",
      "Branch depth",
      "Form",
      "Recursive growth detail",
      54,
    ),
    control(
      "forest.angle",
      "Branch angle",
      "Form",
      "Spread of each branching fork",
      48,
    ),
    control(
      "forest.growth",
      "Growth speed",
      "Motion",
      "Rate of new structure",
      42,
    ),
    control(
      "forest.roots",
      "Root visibility",
      "Composition",
      "Weight below the horizon",
      38,
    ),
    control(
      "forest.spores",
      "Leaf & spore density",
      "Form",
      "Fine canopy life",
      62,
    ),
    control(
      "forest.wind",
      "Wind sway",
      "Motion",
      "Collective breathing motion",
      52,
    ),
  ],
  metal: [
    control(
      "metal.tension",
      "Surface tension",
      "Form",
      "Cohesion of the liquid membrane",
      65,
    ),
    control(
      "metal.sharpness",
      "Reflective sharpness",
      "Light",
      "Definition of chrome highlights",
      68,
    ),
    control(
      "metal.ripples",
      "Ripple frequency",
      "Motion",
      "Fine waves across the surface",
      50,
    ),
    control(
      "metal.thickness",
      "Membrane thickness",
      "Form",
      "Visual mass of the fluid",
      58,
    ),
    control(
      "metal.deformation",
      "Deformation strength",
      "Musical Response",
      "Warping from harmonic tension",
      54,
    ),
    control(
      "metal.flow",
      "Metallic flow",
      "Motion",
      "Speed of reflective currents",
      44,
    ),
  ],
  portal: [
    control(
      "portal.depth",
      "Tunnel depth",
      "Form",
      "Layers receding into space",
      68,
    ),
    control(
      "portal.spacing",
      "Ring spacing",
      "Form",
      "Distance between gate rings",
      48,
    ),
    control(
      "portal.pull",
      "Perspective pull",
      "Motion",
      "Forward gravitational motion",
      57,
    ),
    control("portal.width", "Gate width", "Composition", "Opening scale", 55),
    control(
      "portal.travel",
      "Pulse travel speed",
      "Musical Response",
      "Attack pulses through the tunnel",
      62,
    ),
    control(
      "portal.collapse",
      "Collapse speed",
      "Musical Response",
      "Release contraction",
      44,
    ),
  ],
};

export const defaultResponse: MusicalResponseSettings = {
  velocity: 72,
  register: 64,
  rhythm: 60,
  tension: 56,
  attack: 78,
  release: 62,
};

export function defaultAdvancedValues(): AdvancedValues {
  return Object.values(advancedDefinitions)
    .flat()
    .reduce<AdvancedValues>((values, definition) => {
      values[definition.id] = definition.defaultValue;
      return values;
    }, {});
}

export function definitionsForMode(
  mode: VisualMode,
): AdvancedControlDefinition[] {
  return advancedDefinitions[mode];
}

const centered = (value: number | undefined): number =>
  ((value ?? 50) - 50) / 50;

export function applyAdvancedParameters(
  params: VisualParameters,
  advanced: AdvancedValues,
  response: MusicalResponseSettings,
): VisualParameters {
  const values = advancedDefinitions[params.mode].map(
    (definition) => advanced[definition.id] ?? definition.defaultValue,
  );
  const c = values.map(centered);
  let density = params.density;
  let speed = params.speed;
  let rotation = params.rotation;
  let symmetry = params.symmetry;
  let trails = params.trails;
  let glow = params.glow;
  let bloom = params.bloom;
  let idle = params.idle;

  switch (params.mode) {
    case "bloom":
      symmetry += c[0] * 4;
      bloom += c[1] * 16 + c[2] * 10;
      trails += c[3] * 18;
      speed += c[4] * 13;
      density += c[5] * 14;
      break;
    case "orbit":
      density += c[0] * 18;
      symmetry += c[0] * 3;
      rotation += c[1] * 14 + c[4] * 16;
      bloom += c[2] * 10;
      idle += c[3] * 14;
      trails += c[5] * 18;
      break;
    case "ribbons":
      bloom += c[0] * 14;
      density += c[1] * 20;
      speed += c[2] * 16;
      rotation += c[3] * 14 + c[4] * 18;
      trails += c[5] * 20;
      break;
    case "constellation":
      density += c[0] * 22;
      symmetry += c[1] * 3;
      glow += c[2] * 18;
      bloom += c[3] * 10;
      speed += c[4] * 12;
      trails += c[5] * 16;
      break;
    case "jellyfish":
      bloom += c[0] * 18 + c[1] * 10;
      density += c[2] * 20;
      rotation += c[3] * 18;
      speed += c[4] * 14;
      idle += c[5] * 14;
      break;
    case "geometry":
      density += c[0] * 18 + c[2] * 12;
      symmetry += c[1] * 4;
      bloom += c[3] * 12;
      trails += c[4] * 14;
      rotation += c[5] * 18;
      break;
    case "nebula":
      bloom += c[0] * 16 + c[4] * 12;
      density += c[1] * 20 + c[2] * 10;
      speed += c[3] * 16;
      rotation += c[5] * 14;
      break;
    case "forest":
      density += c[0] * 20 + c[4] * 18;
      symmetry += c[1] * 3;
      speed += c[2] * 15 + c[5] * 12;
      bloom += c[3] * 12;
      break;
    case "metal":
      bloom += c[0] * 12 + c[3] * 12;
      glow += c[1] * 20;
      rotation += c[2] * 16 + c[4] * 12;
      speed += c[5] * 16;
      break;
    case "portal":
      density += c[0] * 18;
      symmetry += c[1] * 3;
      speed += c[2] * 16 + c[4] * 14;
      bloom += c[3] * 14;
      trails += c[5] * 18;
      break;
  }

  return {
    ...params,
    density: clamp(Math.round(density), 0, 100),
    speed: clamp(Math.round(speed), 0, 100),
    rotation: clamp(Math.round(rotation), 0, 100),
    symmetry: clamp(Math.round(symmetry), 3, 14),
    trails: clamp(Math.round(trails), 0, 100),
    glow: clamp(Math.round(glow), 0, 100),
    bloom: clamp(Math.round(bloom), 0, 100),
    idle: clamp(Math.round(idle), 0, 100),
    responsiveness: clamp(
      Math.round(
        params.responsiveness +
          (response.attack - 50) * 0.16 +
          (response.velocity - 50) * 0.1,
      ),
      0,
      100,
    ),
  };
}

export const defaultMacros = (): MacroControl[] =>
  [
    "Depth",
    "Chaos",
    "Radiance",
    "Breath",
    "Tension",
    "Drift",
    "Bloom",
    "Dissolve",
  ].map((name, index) => ({
    id: `macro-${index + 1}`,
    name,
    value: index === 2 || index === 3 ? 58 : 50,
    assignments: [],
  }));
