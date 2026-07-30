import type { VisualMode } from "../types";

export interface ExperienceDefinition {
  id: VisualMode;
  name: string;
  description: string;
  family: "foundations" | "worlds";
}

export const experiences: ExperienceDefinition[] = [
  {
    id: "bloom",
    name: "Bloom",
    description: "living petals & tendrils",
    family: "foundations",
  },
  {
    id: "orbit",
    name: "Orbit",
    description: "moons & celestial rings",
    family: "foundations",
  },
  {
    id: "ribbons",
    name: "Ribbons",
    description: "lyrical flowing strands",
    family: "foundations",
  },
  {
    id: "constellation",
    name: "Stars",
    description: "points, paths & memory",
    family: "foundations",
  },
  {
    id: "jellyfish",
    name: "Dreaming Jellyfish",
    description: "bioluminescent drifters",
    family: "worlds",
  },
  {
    id: "geometry",
    name: "Sacred Geometry",
    description: "luminous harmonic mandalas",
    family: "worlds",
  },
  {
    id: "nebula",
    name: "Nebula",
    description: "cosmic clouds & starlight",
    family: "worlds",
  },
  {
    id: "forest",
    name: "Fractal Forest",
    description: "enchanted branching growth",
    family: "worlds",
  },
  {
    id: "metal",
    name: "Liquid Metal",
    description: "chrome tides & tension",
    family: "worlds",
  },
  {
    id: "portal",
    name: "Portal",
    description: "dimensional gates & depth",
    family: "worlds",
  },
];

export const getExperience = (id: VisualMode): ExperienceDefinition =>
  experiences.find((experience) => experience.id === id) ?? experiences[0];
