import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  beginColorEdit,
  cancelColorEdit,
  confirmColorEdit,
  hexToHsv,
  hsvToHex,
  isPickerInteraction,
  normalizeHex,
  updateColorEdit,
} from "../lab/paletteLab";

interface Props {
  value: string;
  label: string;
  onPreview: (color: string) => void;
  onDone: (color: string) => void;
  onCancel: () => void;
}

export function PaletteColorPicker({
  value,
  label,
  onPreview,
  onDone,
  onCancel,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState(() => beginColorEdit(value));
  const [hexDraft, setHexDraft] = useState(session.value);
  const [hsv, setHsv] = useState(() => hexToHsv(session.value));
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const applyHsv = useCallback(
    (next: typeof hsv) => {
      const color = hsvToHex(next);
      setHsv(next);
      setHexDraft(color);
      setSession((current) => {
        const updated = updateColorEdit(current, color);
        sessionRef.current = updated;
        return updated;
      });
      onPreview(color);
    },
    [onPreview],
  );

  const finish = useCallback(() => {
    onDone(confirmColorEdit(sessionRef.current));
  }, [onDone]);

  const cancel = useCallback(() => {
    onPreview(cancelColorEdit(sessionRef.current));
    onCancel();
  }, [onCancel, onPreview]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!isPickerInteraction(rootRef.current, event.target)) finish();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [cancel, finish]);

  const updatePlane = useCallback(
    (element: HTMLElement, clientX: number, clientY: number) => {
      const bounds = element.getBoundingClientRect();
      if (
        !Number.isFinite(clientX) ||
        !Number.isFinite(clientY) ||
        bounds.width <= 0 ||
        bounds.height <= 0
      )
        return;
      applyHsv({
        ...hsv,
        s: Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)),
        v: Math.min(1, Math.max(0, 1 - (clientY - bounds.top) / bounds.height)),
      });
    },
    [applyHsv, hsv],
  );

  const hueColor = useMemo(() => hsvToHex({ h: hsv.h, s: 1, v: 1 }), [hsv.h]);

  return (
    <div
      className="palette-color-picker"
      ref={rootRef}
      role="dialog"
      aria-label={`${label} color editor`}
    >
      <div className="picker-heading">
        <span>{label}</span>
        <div
          className="picker-swatches"
          aria-label="Original and current color"
        >
          <i
            title={`Original ${session.original}`}
            style={{ background: session.original }}
          />
          <i
            title={`Current ${session.value}`}
            style={{ background: session.value }}
          />
        </div>
      </div>
      <div
        className="picker-saturation"
        style={{ backgroundColor: hueColor }}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updatePlane(event.currentTarget, event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            updatePlane(event.currentTarget, event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.02;
          if (
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          )
            return;
          event.preventDefault();
          applyHsv({
            ...hsv,
            s:
              event.key === "ArrowLeft"
                ? hsv.s - step
                : event.key === "ArrowRight"
                  ? hsv.s + step
                  : hsv.s,
            v:
              event.key === "ArrowDown"
                ? hsv.v - step
                : event.key === "ArrowUp"
                  ? hsv.v + step
                  : hsv.v,
          });
        }}
      >
        <span
          className="picker-cursor"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <label className="picker-hue">
        <span>Hue</span>
        <input
          type="range"
          min="0"
          max="359"
          value={Math.round(hsv.h)}
          onChange={(event) =>
            applyHsv({ ...hsv, h: Number(event.target.value) })
          }
        />
      </label>
      <label className="picker-hex">
        <span>Hex</span>
        <input
          value={hexDraft}
          spellCheck={false}
          aria-invalid={!normalizeHex(hexDraft)}
          onChange={(event) => {
            const next = event.target.value;
            const normalized = normalizeHex(next);
            setHexDraft(next);
            if (normalized) {
              setHsv(hexToHsv(normalized));
              setSession((current) => updateColorEdit(current, normalized));
              onPreview(normalized);
            }
          }}
          onBlur={() => setHexDraft(sessionRef.current.value)}
        />
      </label>
      <div className="picker-actions">
        <button onClick={cancel}>Cancel</button>
        <button className="primary-button" onClick={finish}>
          Done
        </button>
      </div>
    </div>
  );
}
