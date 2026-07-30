import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PaletteColorPicker } from "./PaletteColorPicker";

function setup() {
  const onPreview = vi.fn();
  const onDone = vi.fn();
  const onCancel = vi.fn();
  render(
    <PaletteColorPicker
      value="#336699"
      label="Color stop 1"
      onPreview={onPreview}
      onDone={onDone}
      onCancel={onCancel}
    />,
  );
  return { onPreview, onDone, onCancel };
}

describe("PaletteColorPicker", () => {
  it("restores the original color on Cancel", () => {
    const callbacks = setup();
    fireEvent.change(screen.getByLabelText("Hex"), {
      target: { value: "#ff0000" },
    });
    fireEvent.click(screen.getByText("Cancel"));
    expect(callbacks.onPreview).toHaveBeenLastCalledWith("#336699");
    expect(callbacks.onDone).not.toHaveBeenCalled();
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
  });

  it("confirms a new color with Done", () => {
    const callbacks = setup();
    fireEvent.change(screen.getByLabelText("Hex"), {
      target: { value: "#ff0000" },
    });
    fireEvent.click(screen.getByText("Done"));
    expect(callbacks.onDone).toHaveBeenCalledOnce();
    expect(callbacks.onDone).toHaveBeenCalledWith("#ff0000");
  });

  it("does not close for internal pointer input and confirms on outside click", () => {
    const callbacks = setup();
    const hex = screen.getByLabelText("Hex");
    fireEvent.change(hex, { target: { value: "#ff0000" } });
    fireEvent.pointerDown(hex);
    expect(callbacks.onDone).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(callbacks.onDone).toHaveBeenCalledOnce();
    expect(callbacks.onDone).toHaveBeenCalledWith("#ff0000");
  });

  it("keeps the editor open while pointer-dragging from blue to red", () => {
    const callbacks = setup();
    const plane = screen.getByRole("slider", {
      name: "Saturation and brightness",
    });
    Object.defineProperties(plane, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: () => true },
      getBoundingClientRect: {
        value: () => ({
          left: 0,
          top: 0,
          width: 100,
          height: 100,
          right: 100,
          bottom: 100,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      },
    });
    fireEvent.change(screen.getByLabelText("Hue"), {
      target: { value: "0" },
    });
    const pointerEvent = (type: string) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperties(event, {
        pointerId: { value: 1 },
        clientX: { value: 100 },
        clientY: { value: 0 },
      });
      return event;
    };
    fireEvent(plane, pointerEvent("pointerdown"));
    fireEvent(plane, pointerEvent("pointermove"));
    expect(callbacks.onPreview).toHaveBeenLastCalledWith("#ff0000");
    expect(callbacks.onDone).not.toHaveBeenCalled();
    expect(screen.getByText("Done")).toBeTruthy();
  });
});
