import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RouteInstruction } from "../types/api";

const VOICE_ENABLED_KEY = "delivery.route.voice.enabled";
const VOICE_VOLUME_KEY = "delivery.route.voice.volume";
const DEFAULT_VOLUME = 0.8;
const MIN_VOLUME = 0.2;
const MAX_SPOKEN_STEPS = 5;

type SpeakOptions = {
  force?: boolean;
};

type UseVoiceDirectionsOptions = {
  orderId: number;
  routeTitle: string;
  instructions: RouteInstruction[];
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(MIN_VOLUME, Math.round(value * 100) / 100));
}

function normalizeSpeechKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function spokenDistance(distanceMeters: number): string | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} metros`;
  return `${(distanceMeters / 1000).toLocaleString("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} kilometros`;
}

function spokenDuration(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const rounded = Math.round(minutes);
  return rounded === 1 ? "1 minuto" : `${rounded} minutos`;
}

function buildInstructionSentence(instruction: RouteInstruction): string {
  const details = [
    spokenDistance(instruction.distance_meters),
    spokenDuration(instruction.duration_minutes)
  ].filter(Boolean);
  if (!details.length) return instruction.instruction;
  return `${instruction.instruction}. Tramo de ${details.join(", ")}.`;
}

function limitSpeechText(value: string): string {
  const maxLength = Math.min(Speech.maxSpeechInputLength ?? 3500, 3500);
  return value.slice(0, maxLength);
}

export function useVoiceDirections({ orderId, routeTitle, instructions }: UseVoiceDirectionsOptions) {
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [voiceEnabled, setVoiceEnabledState] = useState(true);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const lastAutoInstructionKey = useRef<string | null>(null);

  const currentInstruction = instructions[0] ?? null;
  const volumePercent = Math.round(volume * 100);

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      const [storedEnabled, storedVolume] = await Promise.all([
        AsyncStorage.getItem(VOICE_ENABLED_KEY),
        AsyncStorage.getItem(VOICE_VOLUME_KEY)
      ]);
      if (!active) return;
      setVoiceEnabledState(storedEnabled !== "false");
      setVolumeState(clampVolume(storedVolume ? Number(storedVolume) : DEFAULT_VOLUME));
      setPreferencesLoaded(true);
    }

    void loadPreferences();
    return () => {
      active = false;
      void Speech.stop();
    };
  }, []);

  const stop = useCallback(() => {
    void Speech.stop().finally(() => setIsSpeaking(false));
  }, []);

  const speakText = useCallback(
    async (text: string, options: SpeakOptions = {}) => {
      if (!options.force && !voiceEnabled) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      setSpeechError(null);
      await Speech.stop();
      Speech.speak(limitSpeechText(trimmed), {
        language: "es-AR",
        pitch: 1,
        rate: 0.94,
        volume,
        onStart: () => setIsSpeaking(true),
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => {
          setIsSpeaking(false);
          setSpeechError("No se pudo reproducir la indicacion por voz.");
        }
      });
    },
    [voiceEnabled, volume]
  );

  const speakCurrentInstruction = useCallback(
    (options: SpeakOptions = { force: true }) => {
      if (!currentInstruction) return;
      void speakText(`${routeTitle}. Proxima indicacion. ${buildInstructionSentence(currentInstruction)}`, options);
    },
    [currentInstruction, routeTitle, speakText]
  );

  const speakRouteOverview = useCallback(() => {
    if (!instructions.length) return;
    const steps = instructions
      .slice(0, MAX_SPOKEN_STEPS)
      .map((instruction, index) => `Paso ${index + 1}. ${buildInstructionSentence(instruction)}`)
      .join(" ");
    void speakText(`${routeTitle}. ${steps}`, { force: true });
  }, [instructions, routeTitle, speakText]);

  useEffect(() => {
    if (!preferencesLoaded || !voiceEnabled || !currentInstruction) return;
    const autoKey = `${orderId}:${routeTitle}:${normalizeSpeechKey(currentInstruction.instruction)}`;
    if (lastAutoInstructionKey.current === autoKey) return;
    lastAutoInstructionKey.current = autoKey;
    const timer = setTimeout(() => {
      speakCurrentInstruction({ force: false });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    currentInstruction,
    orderId,
    preferencesLoaded,
    routeTitle,
    speakCurrentInstruction,
    voiceEnabled
  ]);

  const setVoiceEnabled = useCallback(
    (nextEnabled: boolean) => {
      setVoiceEnabledState(nextEnabled);
      void AsyncStorage.setItem(VOICE_ENABLED_KEY, nextEnabled ? "true" : "false");
      if (!nextEnabled) {
        stop();
      } else {
        lastAutoInstructionKey.current = null;
      }
    },
    [stop]
  );

  const setVolume = useCallback((nextVolume: number) => {
    const normalized = clampVolume(nextVolume);
    setVolumeState(normalized);
    void AsyncStorage.setItem(VOICE_VOLUME_KEY, String(normalized));
  }, []);

  const increaseVolume = useCallback(() => setVolume(volume + 0.2), [setVolume, volume]);
  const decreaseVolume = useCallback(() => setVolume(volume - 0.2), [setVolume, volume]);

  return useMemo(
    () => ({
      currentInstruction,
      decreaseVolume,
      increaseVolume,
      isSpeaking,
      setVoiceEnabled,
      setVolume,
      speechError,
      speakCurrentInstruction,
      speakRouteOverview,
      stop,
      toggleVoice: () => setVoiceEnabled(!voiceEnabled),
      voiceEnabled,
      volume,
      volumePercent
    }),
    [
      currentInstruction,
      decreaseVolume,
      increaseVolume,
      isSpeaking,
      setVoiceEnabled,
      setVolume,
      speechError,
      speakCurrentInstruction,
      speakRouteOverview,
      stop,
      voiceEnabled,
      volume,
      volumePercent
    ]
  );
}
