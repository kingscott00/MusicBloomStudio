import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyContinuousMapping,
  createMappingRuntime,
  exportMappingProfiles,
  findMappingConflicts,
  importMappingProfiles,
  loadMappingProfiles,
  messageMatchesMapping,
  parameterDefinitions,
  resetMappingPickup,
  saveMappingProfiles,
  shouldTriggerMidiAction,
  type MappingRuntime,
} from "../midi/mappings";
import type {
  MidiActionTarget,
  MidiControlMessage,
  MidiDevice,
  MidiMapping,
  MidiMappingProfile,
  MidiParameterTarget,
  VisualParameters,
} from "../types";

export interface MidiLearnTarget {
  type: "parameter" | "action";
  target: MidiParameterTarget | MidiActionTarget;
  label: string;
}

interface PendingConflict {
  candidate: MidiMapping;
  conflicts: MidiMapping[];
}

interface Feedback {
  id: number;
  label: string;
  value: string;
}

interface UseMidiMappingsOptions {
  params: VisualParameters;
  selectedDevice?: MidiDevice;
  onParameterChange: (changes: Partial<VisualParameters>) => void;
  onAction: (action: MidiActionTarget) => void;
}

const ACTIVE_PROFILE_KEY = "music-bloom-midi-active-profile-v1";
const FEEDBACK_KEY = "music-bloom-midi-feedback-v1";

export function useMidiMappings({
  params,
  selectedDevice,
  onParameterChange,
  onAction,
}: UseMidiMappingsOptions) {
  const [profiles, setProfiles] = useState(loadMappingProfiles);
  const [activeProfileId, setActiveProfileId] = useState(
    () => localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "",
  );
  const [learning, setLearning] = useState<MidiLearnTarget | null>(null);
  const [pendingConflict, setPendingConflict] =
    useState<PendingConflict | null>(null);
  const [latestMessage, setLatestMessage] = useState<MidiControlMessage | null>(
    null,
  );
  const [recentMessages, setRecentMessages] = useState<MidiControlMessage[]>(
    [],
  );
  const [feedbackEnabled, setFeedbackEnabled] = useState(
    () => localStorage.getItem(FEEDBACK_KEY) !== "off",
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [waitingMappingIds, setWaitingMappingIds] = useState<string[]>([]);
  const paramsRef = useRef(params);
  const profilesRef = useRef(profiles);
  const activeProfileIdRef = useRef(activeProfileId);
  const learningRef = useRef(learning);
  const onParameterChangeRef = useRef(onParameterChange);
  const onActionRef = useRef(onAction);
  const runtimeRef = useRef(new Map<string, MappingRuntime>());
  const actionValuesRef = useRef(new Map<string, number>());
  const pendingChangesRef = useRef<Partial<VisualParameters>>({});
  const updateFrameRef = useRef<number | null>(null);
  const lastInspectorUpdateRef = useRef(0);
  const feedbackIdRef = useRef(0);
  const waitingRef = useRef(new Set<string>());
  paramsRef.current = params;
  profilesRef.current = profiles;
  activeProfileIdRef.current = activeProfileId;
  learningRef.current = learning;
  onParameterChangeRef.current = onParameterChange;
  onActionRef.current = onAction;

  useEffect(() => {
    saveMappingProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    localStorage.setItem(FEEDBACK_KEY, feedbackEnabled ? "on" : "off");
  }, [feedbackEnabled]);

  useEffect(() => {
    if (!selectedDevice) return;
    const current = profiles.find(
      (profile) =>
        profile.id === activeProfileId &&
        profile.deviceId === selectedDevice.id,
    );
    if (current) return;
    setActiveProfileId(
      profiles.find((profile) => profile.deviceId === selectedDevice.id)?.id ??
        "",
    );
  }, [activeProfileId, profiles, selectedDevice]);

  useEffect(
    () => () => {
      if (updateFrameRef.current !== null)
        cancelAnimationFrame(updateFrameRef.current);
    },
    [],
  );

  const activeProfile = useMemo(
    () =>
      profiles.find((profile) => profile.id === activeProfileId) ??
      profiles.find((profile) => profile.deviceId === selectedDevice?.id) ??
      null,
    [activeProfileId, profiles, selectedDevice?.id],
  );

  const addMapping = useCallback(
    (candidate: MidiMapping, replaceIds: string[] = []) => {
      setProfiles((current) => {
        let profile = current.find(
          (item) =>
            item.id === activeProfileIdRef.current &&
            item.deviceId === candidate.deviceId,
        );
        let next = current;
        if (!profile) {
          profile = {
            id: `profile-${Date.now().toString(36)}`,
            name: candidate.deviceName || "Performance controls",
            deviceId: candidate.deviceId,
            deviceName: candidate.deviceName,
            mappings: [],
          };
          next = [...current, profile];
          setActiveProfileId(profile.id);
        }
        return next.map((item) =>
          item.id === profile.id
            ? {
                ...item,
                mappings: [
                  ...item.mappings.filter(
                    (mapping) => !replaceIds.includes(mapping.id),
                  ),
                  candidate,
                ],
              }
            : item,
        );
      });
      runtimeRef.current.set(candidate.id, createMappingRuntime());
      setFeedback({
        id: ++feedbackIdRef.current,
        label: "MIDI Learn",
        value: `${candidate.source === "cc" ? `CC ${candidate.controller}` : candidate.source} assigned`,
      });
    },
    [],
  );

  const handleControl = useCallback(
    (message: MidiControlMessage) => {
      const now = performance.now();
      if (now - lastInspectorUpdateRef.current > 55) {
        lastInspectorUpdateRef.current = now;
        setLatestMessage(message);
        setRecentMessages((current) => [message, ...current].slice(0, 8));
      }

      const learn = learningRef.current;
      if (learn) {
        const definition =
          learn.type === "parameter"
            ? parameterDefinitions[learn.target as MidiParameterTarget]
            : { min: 0, max: 1 };
        const candidate: MidiMapping = {
          id: `mapping-${Date.now().toString(36)}`,
          targetType: learn.type,
          target: learn.target,
          deviceId: message.deviceId,
          deviceName: message.deviceName,
          source: message.source,
          channel: message.channel,
          controller: message.controller,
          inputMin: 0,
          inputMax: 127,
          outputMin: definition.min,
          outputMax: definition.max,
          invert: false,
          smoothing: learn.type === "parameter" ? "light" : "none",
          takeover: learn.type === "parameter" ? "pickup" : "jump",
          pitchMode: "permanent",
        };
        const profile =
          profilesRef.current.find(
            (item) =>
              item.id === activeProfileIdRef.current &&
              item.deviceId === message.deviceId,
          ) ??
          profilesRef.current.find(
            (item) => item.deviceId === message.deviceId,
          );
        const conflicts = findMappingConflicts(
          profile?.mappings ?? [],
          candidate,
        );
        setLearning(null);
        if (conflicts.length) setPendingConflict({ candidate, conflicts });
        else addMapping(candidate);
        return;
      }

      const profile =
        profilesRef.current.find(
          (item) =>
            item.id === activeProfileIdRef.current &&
            item.deviceId === message.deviceId,
        ) ??
        profilesRef.current.find((item) => item.deviceId === message.deviceId);
      if (!profile) return;

      let feedbackLabel = "";
      let feedbackValue = "";
      const waiting = new Set(waitingRef.current);
      for (const mapping of profile.mappings) {
        if (!messageMatchesMapping(mapping, message)) continue;
        if (mapping.targetType === "action") {
          const previous = actionValuesRef.current.get(mapping.id) ?? 0;
          actionValuesRef.current.set(mapping.id, message.value);
          if (shouldTriggerMidiAction(previous, message.value))
            onActionRef.current(mapping.target as MidiActionTarget);
          continue;
        }
        const target = mapping.target as MidiParameterTarget;
        const runtime =
          runtimeRef.current.get(mapping.id) ?? createMappingRuntime();
        runtimeRef.current.set(mapping.id, runtime);
        const current =
          (pendingChangesRef.current[target] as number | undefined) ??
          paramsRef.current[target];
        const result = applyContinuousMapping(
          mapping,
          message,
          current,
          runtime,
        );
        if (result.waitingForPickup) waiting.add(mapping.id);
        else waiting.delete(mapping.id);
        if (result.value !== null) {
          pendingChangesRef.current[target] = Math.round(result.value);
          feedbackLabel = parameterDefinitions[target].label;
          feedbackValue = String(Math.round(result.value));
        }
      }
      if (
        waiting.size !== waitingRef.current.size ||
        [...waiting].some((id) => !waitingRef.current.has(id))
      ) {
        waitingRef.current = waiting;
        setWaitingMappingIds([...waiting]);
      }
      if (
        Object.keys(pendingChangesRef.current).length &&
        updateFrameRef.current === null
      ) {
        updateFrameRef.current = requestAnimationFrame(() => {
          updateFrameRef.current = null;
          const changes = pendingChangesRef.current;
          pendingChangesRef.current = {};
          onParameterChangeRef.current(changes);
          if (feedbackEnabled && feedbackLabel)
            setFeedback({
              id: ++feedbackIdRef.current,
              label: feedbackLabel,
              value: feedbackValue,
            });
        });
      }
    },
    [addMapping, feedbackEnabled],
  );

  const beginLearn = useCallback((target: MidiLearnTarget) => {
    setPendingConflict(null);
    setLearning(target);
  }, []);

  const cancelLearn = useCallback(() => setLearning(null), []);

  const resolveConflict = useCallback(
    (choice: "replace" | "keep" | "cancel") => {
      if (!pendingConflict) return;
      if (choice !== "cancel")
        addMapping(
          pendingConflict.candidate,
          choice === "replace"
            ? pendingConflict.conflicts.map((mapping) => mapping.id)
            : [],
        );
      setPendingConflict(null);
    },
    [addMapping, pendingConflict],
  );

  const updateMapping = useCallback(
    (id: string, changes: Partial<MidiMapping>) =>
      setProfiles((current) =>
        current.map((profile) => ({
          ...profile,
          mappings: profile.mappings.map((mapping) =>
            mapping.id === id ? { ...mapping, ...changes } : mapping,
          ),
        })),
      ),
    [],
  );

  const removeMapping = useCallback((id: string) => {
    setProfiles((current) =>
      current.map((profile) => ({
        ...profile,
        mappings: profile.mappings.filter((mapping) => mapping.id !== id),
      })),
    );
    runtimeRef.current.delete(id);
  }, []);

  const armPickup = useCallback(() => {
    for (const runtime of runtimeRef.current.values())
      resetMappingPickup(runtime);
    waitingRef.current.clear();
    setWaitingMappingIds([]);
  }, []);

  const createProfile = useCallback(
    (name: string) => {
      if (!selectedDevice) return;
      const profile: MidiMappingProfile = {
        id: `profile-${Date.now().toString(36)}`,
        name,
        deviceId: selectedDevice.id,
        deviceName: selectedDevice.name,
        mappings: [],
      };
      setProfiles((current) => [...current, profile]);
      setActiveProfileId(profile.id);
    },
    [selectedDevice],
  );

  const renameProfile = useCallback((name: string) => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === activeProfileIdRef.current
          ? { ...profile, name }
          : profile,
      ),
    );
  }, []);

  const resetProfile = useCallback(() => {
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === activeProfileIdRef.current
          ? { ...profile, mappings: [] }
          : profile,
      ),
    );
    runtimeRef.current.clear();
    waitingRef.current.clear();
    setWaitingMappingIds([]);
  }, []);

  const replaceProfilesFromJson = useCallback((json: string) => {
    const imported = importMappingProfiles(json);
    setProfiles(imported);
    setActiveProfileId(imported[0].id);
    runtimeRef.current.clear();
  }, []);

  return {
    profiles,
    deviceProfiles: profiles.filter(
      (profile) => profile.deviceId === selectedDevice?.id,
    ),
    activeProfile,
    activeProfileId,
    setActiveProfileId,
    learning,
    pendingConflict,
    latestMessage,
    recentMessages,
    feedback,
    feedbackEnabled,
    setFeedbackEnabled,
    waitingMappingIds,
    handleControl,
    beginLearn,
    cancelLearn,
    resolveConflict,
    updateMapping,
    removeMapping,
    armPickup,
    createProfile,
    renameProfile,
    resetProfile,
    exportJson: () => exportMappingProfiles(profiles),
    importJson: replaceProfilesFromJson,
  };
}
