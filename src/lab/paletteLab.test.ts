import { beforeEach, describe, expect, it } from "vitest";
import { createHistory, pushHistory } from "./state";
import {
  beginColorEdit,
  cancelColorEdit,
  confirmColorEdit,
  hexToHsv,
  hsvToHex,
  loadCustomPalettes,
  normalizeHex,
  saveCustomPalettes,
  transformPalette,
  updateColorEdit,
  validatePalette,
} from "./paletteLab";

const palette = {
  id: "custom-night",
  name: "Custom Night",
  colors: ["#336699", "#ffcc88"],
  background: "#05070c",
};

describe("custom palette serialization", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips valid custom palettes through local storage", () => {
    saveCustomPalettes([palette]);
    expect(loadCustomPalettes()).toEqual([palette]);
  });

  it("rejects invalid color stops and unsafe palette sizes", () => {
    expect(validatePalette({ ...palette, colors: ["red"] })).toBeNull();
    expect(
      validatePalette({
        ...palette,
        colors: Array.from({ length: 9 }, () => "#ffffff"),
      }),
    ).toBeNull();
  });

  it("applies deterministic rotation, saturation, brightness, and temperature", () => {
    const first = transformPalette(palette, 30, 120, 90, 20);
    const second = transformPalette(palette, 30, 120, 90, 20);
    expect(first).toEqual(second);
    expect(first.colors).not.toEqual(palette.colors);
    expect(first.background).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("cancels to the original color and confirms the new color", () => {
    const session = updateColorEdit(beginColorEdit("#336699"), "#ff0033");
    expect(confirmColorEdit(session)).toBe("#ff0033");
    expect(cancelColorEdit(session)).toBe("#336699");
  });

  it("normalizes hex input and round-trips HSV colors", () => {
    expect(normalizeHex("#f03")).toBe("#ff0033");
    expect(normalizeHex("invalid")).toBeNull();
    expect(hsvToHex(hexToHsv("#2a75e8"))).toBe("#2a75e8");
  });

  it("coalesces a whole color-edit session into one history operation", () => {
    let session = beginColorEdit("#336699");
    ["#4a6699", "#8c5199", "#ff0000"].forEach((color) => {
      session = updateColorEdit(session, color);
    });
    const initial = { color: session.original };
    const history = pushHistory(
      createHistory(initial),
      { color: confirmColorEdit(session) },
      "Palette color edit",
    );
    expect(history.entries).toHaveLength(2);
    expect(history.entries[1].state.color).toBe("#ff0000");
  });
});
