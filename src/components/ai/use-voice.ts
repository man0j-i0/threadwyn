"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input via the Web Speech API.
 *
 * Deliberately not a cloud STT service: this is native, instant, free, needs no
 * key, and sends no audio anywhere. The trade-off is browser support — Chrome
 * and Edge are solid, Firefox is not — so `supported` is exposed and every
 * surface that uses this keeps a visible text input as the primary path. Voice
 * is an alternative way in, never the only one.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }
  >;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice({
  onFinal,
  lang = "en-IN",
}: {
  onFinal: (transcript: string) => void;
  lang?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  // Kept in a ref so the recognition callbacks always see the current handler
  // without having to tear down and rebuild the recogniser on every render.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("This browser doesn't support voice input. Chrome or Edge will work.");
      return;
    }

    setError(null);
    setInterim("");
    finalRef.current = "";

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current += text;
        else live += text;
      }
      setInterim(live);
    };

    recognition.onerror = (e) => {
      setListening(false);
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Microphone access was blocked. Allow it in your browser settings to use voice."
          : e.error === "no-speech"
            ? "I didn't catch that — try again."
            : "Voice input stopped unexpectedly. You can type instead.",
      );
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      if (text) onFinalRef.current(text);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setError("Voice input is already running.");
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  return { supported, listening, interim, error, start, stop, toggle, clearError: () => setError(null) };
}

/** Speech synthesis for reading a reply back. Off by default — nobody wants an
 *  office suddenly talking — and always interruptible. */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    // Strip markdown emphasis so the voice doesn't read asterisks aloud.
    const clean = text.replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.03;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { supported, speaking, speak, cancel };
}
