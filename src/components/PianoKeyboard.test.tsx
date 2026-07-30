import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MusicalState } from "../types";
import { PianoKeyboard } from "./PianoKeyboard";

const quietMusic = { notes: [] } as unknown as MusicalState;

function SustainHarness({ onSustain }: { onSustain: (down: boolean) => void }) {
  const [sustain, setSustain] = useState(false);
  return (
    <PianoKeyboard
      music={quietMusic}
      onNoteOn={() => undefined}
      onNoteOff={() => undefined}
      onSustain={(down) => {
        setSustain(down);
        onSustain(down);
      }}
      simulatedSustain={sustain}
    />
  );
}

describe("computer sustain control", () => {
  it("holds Spacebar sustain until keyup and exposes its active state", () => {
    const onSustain = vi.fn();
    render(<SustainHarness onSustain={onSustain} />);

    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    expect(onSustain).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText("Space sustain on")).not.toBeNull();

    fireEvent.keyUp(document.body, { code: "Space", key: " " });
    expect(onSustain).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText("Hold Space · sustain")).not.toBeNull();
  });

  it("does not intercept Spacebar on an interactive piano button", () => {
    const onSustain = vi.fn();
    render(<SustainHarness onSustain={onSustain} />);
    const pianoKey = screen.getByRole("button", { name: "MIDI note 60" });

    fireEvent.keyDown(pianoKey, { code: "Space", key: " " });

    expect(onSustain).not.toHaveBeenCalled();
  });
});
