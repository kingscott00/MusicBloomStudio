import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { palettes } from "../presets/palettes";
import { defaultParams } from "../presets/presets";
import type {
  ColorPalette,
  MidiParameterTarget,
  RandomizerLocks,
  VisualParameters,
} from "../types";
import { defaultMacros } from "../lab/definitions";
import {
  captureScene,
  copyScene,
  createExampleInstruments,
  createHistory,
  importInstrument,
  loadCustomInstruments,
  loadLaboratoryState,
  loadScene,
  mutateLaboratory,
  pushHistory,
  redoHistory,
  saveCustomInstruments,
  saveLaboratoryState,
  sceneFromParameters,
  serializeInstrument,
  swapScenes,
  undoHistory,
} from "../lab/state";
import type {
  LaboratoryHistory,
  LaboratoryRenderState,
  LaboratoryState,
  MacroControl,
  ModulationRoute,
  MutationStrength,
  VisualInstrument,
} from "../lab/types";

interface Snapshot {
  laboratory: LaboratoryState;
  params: VisualParameters;
}

const INSTRUMENT_FAVORITES_KEY = "music-bloom-visual-instrument-favorites-v1";

const downloadJson = (name: string, json: string) => {
  const blob = new Blob([json], { type: "application/json" });
  const link = document.createElement("a");
  link.download = name;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
};

export function useVisualLaboratory(
  params: VisualParameters,
  onParamsChange: (params: VisualParameters) => void,
  randomizerLocks: RandomizerLocks,
) {
  const [state, setState] = useState(() => loadLaboratoryState(params));
  const [isOpen, setIsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [currentInstrumentId, setCurrentInstrumentId] = useState("");
  const [favoriteInstrumentIds, setFavoriteInstrumentIds] = useState<string[]>(
    () => {
      try {
        const value = JSON.parse(
          localStorage.getItem(INSTRUMENT_FAVORITES_KEY) ?? "[]",
        ) as unknown;
        return Array.isArray(value)
          ? value.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    },
  );
  const [customInstruments, setCustomInstruments] = useState(
    loadCustomInstruments,
  );
  const [history, setHistory] = useState<LaboratoryHistory<Snapshot>>(() =>
    createHistory({ laboratory: state, params }),
  );
  const stateRef = useRef(state);
  const paramsRef = useRef(params);
  const historyRef = useRef(history);
  stateRef.current = state;
  paramsRef.current = params;
  historyRef.current = history;

  const exampleInstruments = useMemo(
    () => createExampleInstruments(defaultParams),
    [],
  );
  const instruments = useMemo(
    () =>
      [...exampleInstruments, ...customInstruments].map((instrument) => ({
        ...instrument,
        favorite: favoriteInstrumentIds.includes(instrument.id),
      })),
    [customInstruments, exampleInstruments, favoriteInstrumentIds],
  );

  useEffect(() => {
    saveLaboratoryState(state);
  }, [state]);

  useEffect(() => {
    localStorage.setItem(
      INSTRUMENT_FAVORITES_KEY,
      JSON.stringify(favoriteInstrumentIds),
    );
  }, [favoriteInstrumentIds]);

  useEffect(() => {
    if (!isOpen || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, isOpen]);

  const commit = useCallback(
    (
      nextState: LaboratoryState,
      nextParams: VisualParameters,
      label: string,
      coalesceKey?: string,
      markDirty = true,
    ) => {
      setState(nextState);
      onParamsChange(nextParams);
      const nextHistory = pushHistory(
        historyRef.current,
        { laboratory: nextState, params: nextParams },
        label,
        coalesceKey,
      );
      stateRef.current = nextState;
      paramsRef.current = nextParams;
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      if (markDirty) setDirty(true);
    },
    [onParamsChange],
  );

  const open = useCallback(() => {
    const entered = captureScene(
      stateRef.current,
      stateRef.current.editScene,
      paramsRef.current,
    );
    entered.morph = entered.editScene === "A" ? 0 : 100;
    const nextHistory = createHistory({
      laboratory: entered,
      params: paramsRef.current,
    });
    setState(entered);
    setHistory(nextHistory);
    setDirty(false);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (
      dirty &&
      !window.confirm("Leave the Visual Laboratory with unsaved changes?")
    )
      return;
    setIsOpen(false);
  }, [dirty]);

  const updateShared = useCallback(
    (changes: Partial<VisualParameters>, label = "Parameter adjustment") => {
      const nextParams = { ...paramsRef.current, ...changes };
      const key = stateRef.current.editScene === "A" ? "sceneA" : "sceneB";
      const nextState = {
        ...stateRef.current,
        [key]: {
          ...stateRef.current[key],
          params: nextParams,
        },
      };
      commit(
        nextState,
        nextParams,
        label,
        `shared-${Object.keys(changes).join("-")}`,
      );
    },
    [commit],
  );

  const updateAdvanced = useCallback(
    (id: string, value: number) => {
      const advanced = { ...stateRef.current.currentAdvanced, [id]: value };
      const key = stateRef.current.editScene === "A" ? "sceneA" : "sceneB";
      const nextState = {
        ...stateRef.current,
        currentAdvanced: advanced,
        [key]: { ...stateRef.current[key], advanced },
      };
      commit(
        nextState,
        paramsRef.current,
        "Advanced control",
        `advanced-${id}`,
      );
    },
    [commit],
  );

  const updateResponse = useCallback(
    (id: keyof LaboratoryState["response"], value: number) => {
      const response = { ...stateRef.current.response, [id]: value };
      const key = stateRef.current.editScene === "A" ? "sceneA" : "sceneB";
      const nextState = {
        ...stateRef.current,
        response,
        [key]: { ...stateRef.current[key], response },
      };
      commit(
        nextState,
        paramsRef.current,
        "Musical response",
        `response-${id}`,
      );
    },
    [commit],
  );

  const setMorph = useCallback(
    (value: number) =>
      commit(
        { ...stateRef.current, morph: value },
        paramsRef.current,
        "Morph",
        "morph",
      ),
    [commit],
  );

  const capture = useCallback(
    (slot: "A" | "B") =>
      commit(
        captureScene(stateRef.current, slot, paramsRef.current),
        paramsRef.current,
        `Captured Scene ${slot}`,
      ),
    [commit],
  );

  const restoreScene = useCallback(
    (slot: "A" | "B") => {
      const loaded = loadScene(stateRef.current, slot);
      commit(loaded.state, loaded.params, `Loaded Scene ${slot}`);
    },
    [commit],
  );

  const swap = useCallback(
    () =>
      commit(
        swapScenes(stateRef.current),
        paramsRef.current,
        "Swapped Scenes A/B",
      ),
    [commit],
  );
  const copy = useCallback(
    (from: "A" | "B") =>
      commit(
        copyScene(stateRef.current, from),
        paramsRef.current,
        `Copied Scene ${from}`,
      ),
    [commit],
  );

  const setMacros = useCallback(
    (macros: MacroControl[], label = "Macro change", key = "macros") => {
      const sceneKey = stateRef.current.editScene === "A" ? "sceneA" : "sceneB";
      const nextState = {
        ...stateRef.current,
        macros,
        [sceneKey]: { ...stateRef.current[sceneKey], macros },
      };
      commit(nextState, paramsRef.current, label, key);
    },
    [commit],
  );

  const setRoutes = useCallback(
    (routes: ModulationRoute[]) => {
      const limited = routes.slice(0, 16);
      const sceneKey = stateRef.current.editScene === "A" ? "sceneA" : "sceneB";
      const nextState = {
        ...stateRef.current,
        modulationRoutes: limited,
        [sceneKey]: {
          ...stateRef.current[sceneKey],
          modulationRoutes: limited,
        },
      };
      commit(nextState, paramsRef.current, "Modulation change", "modulation");
    },
    [commit],
  );

  const mutate = useCallback(
    (strength: MutationStrength, direction = 1) => {
      const result = mutateLaboratory(
        stateRef.current,
        paramsRef.current,
        randomizerLocks,
        strength,
        Math.max(0, stateRef.current.mutationIndex + direction),
      );
      const key = result.state.editScene === "A" ? "sceneA" : "sceneB";
      result.state[key] = sceneFromParameters(result.params, result.state);
      commit(result.state, result.params, `${strength} mutation`);
    },
    [commit, randomizerLocks],
  );

  const applyHistory = useCallback(
    (direction: "undo" | "redo") => {
      const result =
        direction === "undo"
          ? undoHistory(historyRef.current)
          : redoHistory(historyRef.current);
      setHistory(result.history);
      setState(result.state.laboratory);
      onParamsChange(result.state.params);
      setDirty(true);
    },
    [onParamsChange],
  );

  const returnToEntry = useCallback(() => {
    const snapshot = historyRef.current.entryState;
    setState(snapshot.laboratory);
    onParamsChange(snapshot.params);
    setDirty(false);
  }, [onParamsChange]);

  const saveNew = useCallback(
    (name: string, description = "") => {
      const instrument: VisualInstrument = {
        version: 1,
        id: `instrument-${Date.now().toString(36)}`,
        name,
        builtIn: false,
        favorite: false,
        modifiedAt: new Date().toISOString(),
        description,
        state: stateRef.current,
        randomizerLocks,
      };
      const next = [...customInstruments, instrument];
      setCustomInstruments(next);
      saveCustomInstruments(next);
      setCurrentInstrumentId(instrument.id);
      setDirty(false);
    },
    [customInstruments, randomizerLocks],
  );

  const updateCurrent = useCallback(() => {
    const instrument = customInstruments.find(
      (item) => item.id === currentInstrumentId,
    );
    if (!instrument) return;
    const next = customInstruments.map((item) =>
      item.id === currentInstrumentId
        ? {
            ...item,
            state: stateRef.current,
            modifiedAt: new Date().toISOString(),
          }
        : item,
    );
    setCustomInstruments(next);
    saveCustomInstruments(next);
    setDirty(false);
  }, [currentInstrumentId, customInstruments]);

  const loadInstrument = useCallback(
    (instrument: VisualInstrument) => {
      if (
        dirty &&
        !window.confirm("Load this instrument and discard unsaved edits?")
      )
        return;
      setState(instrument.state);
      onParamsChange(instrument.state.sceneA.params);
      setCurrentInstrumentId(instrument.id);
      setDirty(false);
      setHistory(
        createHistory({
          laboratory: instrument.state,
          params: instrument.state.sceneA.params,
        }),
      );
    },
    [dirty, onParamsChange],
  );

  const mutateInstrumentList = useCallback((next: VisualInstrument[]) => {
    setCustomInstruments(next);
    saveCustomInstruments(next);
  }, []);

  const duplicateInstrument = useCallback(
    (instrument: VisualInstrument) => {
      const copyItem = {
        ...instrument,
        id: `instrument-${Date.now().toString(36)}`,
        name: `${instrument.name} Copy`,
        builtIn: false,
        modifiedAt: new Date().toISOString(),
      };
      mutateInstrumentList([...customInstruments, copyItem]);
    },
    [customInstruments, mutateInstrumentList],
  );

  const renameInstrument = useCallback(
    (id: string, name: string) =>
      mutateInstrumentList(
        customInstruments.map((item) =>
          item.id === id
            ? { ...item, name, modifiedAt: new Date().toISOString() }
            : item,
        ),
      ),
    [customInstruments, mutateInstrumentList],
  );

  const deleteInstrument = useCallback(
    (id: string) => {
      mutateInstrumentList(customInstruments.filter((item) => item.id !== id));
      setFavoriteInstrumentIds((current) =>
        current.filter((favoriteId) => favoriteId !== id),
      );
      if (currentInstrumentId === id) setCurrentInstrumentId("");
    },
    [currentInstrumentId, customInstruments, mutateInstrumentList],
  );

  const toggleFavorite = useCallback((instrument: VisualInstrument) => {
    setFavoriteInstrumentIds((current) =>
      current.includes(instrument.id)
        ? current.filter((id) => id !== instrument.id)
        : [...current, instrument.id],
    );
  }, []);

  const importJson = useCallback(
    (json: string) => {
      const imported = {
        ...importInstrument(json),
        id: `instrument-${Date.now().toString(36)}`,
        builtIn: false,
      };
      mutateInstrumentList([...customInstruments, imported]);
      if (imported.favorite)
        setFavoriteInstrumentIds((current) => [...current, imported.id]);
      return imported;
    },
    [customInstruments, mutateInstrumentList],
  );

  const exportInstrument = useCallback((instrument: VisualInstrument) => {
    downloadJson(
      `${instrument.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.music-bloom.json`,
      serializeInstrument(instrument),
    );
  }, []);

  const setCustomPalettes = useCallback(
    (customPalettes: ColorPalette[]) => {
      const nextState = { ...stateRef.current, customPalettes };
      commit(nextState, paramsRef.current, "Palette change");
    },
    [commit],
  );

  const setMidiParameter = useCallback(
    (target: MidiParameterTarget, value: number) => {
      if (target === "morph") setMorph(value);
      else if (target.startsWith("macro-")) {
        const macros = stateRef.current.macros.map((macro) =>
          macro.id === target ? { ...macro, value } : macro,
        );
        setMacros(macros, "MIDI macro", `midi-${target}`);
      }
    },
    [setMacros, setMorph],
  );

  const renderState: LaboratoryRenderState = {
    enabled: isOpen || Boolean(currentInstrumentId),
    sceneA: state.sceneA,
    sceneB: state.sceneB,
    morph: state.morph,
    macros: state.macros,
    modulationRoutes: state.modulationRoutes,
    customPalettes: state.customPalettes,
  };

  return {
    state,
    isOpen,
    dirty,
    history,
    instruments,
    currentInstrumentId,
    currentInstrument: instruments.find(
      (item) => item.id === currentInstrumentId,
    ),
    palettes: [...palettes, ...state.customPalettes],
    renderState,
    open,
    close,
    updateShared,
    updateAdvanced,
    updateResponse,
    setMorph,
    capture,
    restoreScene,
    swap,
    copy,
    setMacros,
    resetMacros: () => setMacros(defaultMacros(), "Reset macros"),
    setRoutes,
    mutate,
    undo: () => applyHistory("undo"),
    redo: () => applyHistory("redo"),
    returnToEntry,
    saveNew,
    updateCurrent,
    loadInstrument,
    duplicateInstrument,
    renameInstrument,
    deleteInstrument,
    toggleFavorite,
    importJson,
    exportInstrument,
    setCustomPalettes,
    setMidiParameter,
    setOverlayEnabled: (overlayEnabled: boolean) =>
      setState((current) => ({ ...current, overlayEnabled })),
  };
}

export type VisualLaboratoryController = ReturnType<typeof useVisualLaboratory>;
