import type { ColorPalette } from "../types";

export const palettes: ColorPalette[] = [
  {
    id: "moonlight",
    name: "Moonlight",
    colors: ["#a8c7fa", "#d7e7ff", "#8f9ee8", "#eef7ff"],
    background: "#050713",
  },
  {
    id: "aurora",
    name: "Aurora",
    colors: ["#61ffd0", "#5aa7ff", "#be7dff", "#d9ff8c"],
    background: "#03100f",
  },
  {
    id: "ocean",
    name: "Deep ocean",
    colors: ["#27d4d0", "#1d6fe8", "#4145a7", "#a6f6ff"],
    background: "#020910",
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: ["#ff7b54", "#ffca70", "#d96bb4", "#7e5bef"],
    background: "#13070c",
  },
  {
    id: "neon",
    name: "Neon",
    colors: ["#00f0ff", "#ff4fd8", "#9cff57", "#8e7dff"],
    background: "#06050c",
  },
  {
    id: "forest",
    name: "Forest mist",
    colors: ["#7dc9a8", "#d6e6c3", "#5b8c78", "#b6a5d6"],
    background: "#060d0b",
  },
  {
    id: "embers",
    name: "Fire & embers",
    colors: ["#ffb348", "#ff5a36", "#ffd28b", "#b52332"],
    background: "#110503",
  },
  {
    id: "silver",
    name: "Silver",
    colors: ["#f1f4f8", "#aeb8c5", "#6f7a8a", "#d9e1eb"],
    background: "#080a0d",
  },
  {
    id: "violet",
    name: "Violet & blue",
    colors: ["#9a77ff", "#5b8cff", "#d3a7ff", "#66d9ff"],
    background: "#080616",
  },
  {
    id: "gold",
    name: "Warm gold",
    colors: ["#ffd37a", "#f2a94a", "#fff0bb", "#d67c35"],
    background: "#100b04",
  },
];

export const getPalette = (
  id: string,
  customPalettes: ColorPalette[] = [],
): ColorPalette =>
  [...customPalettes, ...palettes].find((palette) => palette.id === id) ??
  palettes[0];
