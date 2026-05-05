import { useState, useEffect, useRef, useCallback } from "react";

const TTS_DISABLED_KEY = "kero_tts_disabled_until";

export function isTTSDisabled(): boolean {
  const until = localStorage.getItem(TTS_DISABLED_KEY);
  if (!until) return false;
  return new Date(until) > new Date();
}

/**
 * Smart Voice Assistant using Web Speech API
 * Selects the most natural-sounding voice available on the device
 * Supports English and Kinyarwanda
 */

function getBestVoice(lang: "en" | "ki"): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  if (lang === "ki") {
    // 1) True Kinyarwanda voice if available
    const rwVoice = voices.find(v => v.lang.toLowerCase().startsWith("rw"));
    if (rwVoice) return rwVoice;

    // 2) Swahili - phonetically the closest Bantu language to Kinyarwanda
    //    (vowels a/e/i/o/u, similar syllable structure) - sounds far more natural
    //    than English when reading Kinyarwanda text.
    const swVoice = voices.find(v => v.lang.toLowerCase().startsWith("sw"));
    if (swVoice) return swVoice;

    // 3) Other African / Bantu-adjacent locales
    const africanLocales = ["zu", "xh", "yo", "ig", "ha", "am", "so"];
    for (const code of africanLocales) {
      const v = voices.find(v => v.lang.toLowerCase().startsWith(code));
      if (v) return v;
    }

    // 4) French (widely-trained, handles Kinyarwanda vowels better than US English)
    const frVoice = voices.find(v => v.lang.toLowerCase().startsWith("fr"));
    if (frVoice) return frVoice;
    // fall through to English fallback below
  }

  // Prefer premium / natural voices
  const naturalKeywords = ["natural", "premium", "enhanced", "neural", "wavenet"];
  const englishVoices = voices.filter(v => v.lang.startsWith("en"));

  for (const keyword of naturalKeywords) {
    const premium = englishVoices.find(v => v.name.toLowerCase().includes(keyword));
    if (premium) return premium;
  }

  const branded = englishVoices.find(v =>
    v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Samantha")
  );
  if (branded) return branded;

  const nonDefault = englishVoices.find(v => !v.localService);
  if (nonDefault) return nonDefault;

  if (englishVoices.length) return englishVoices[0];
  return voices[0];
}

export function useVoiceAssistant() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [disabled, setDisabled] = useState(isTTSDisabled());
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const supported = "speechSynthesis" in window && !isTTSDisabled();
    setIsSupported(supported);
    setDisabled(isTTSDisabled());
    if (!supported) return;

    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) setVoicesLoaded(true);
    };

    loadVoices();
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, lang: "en" | "ki" = "en") => {
    if (!isSupported) return;

    // Stop any current speech
    speechSynthesis.cancel();

    // Clean text: remove markdown, emojis, bullets
    const cleanText = text
      .replace(/[#*_~`]/g, "")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ", ")
      .replace(/•/g, "")
      .replace(/\d+\./g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = getBestVoice(lang);
    if (voice) utterance.voice = voice;

    // Set BCP-47 lang hint - improves pronunciation even when voice is a fallback
    utterance.lang = lang === "ki" ? (voice?.lang || "sw-KE") : (voice?.lang || "en-US");

    // Slower, slightly lower pitch for Kinyarwanda - sounds more like a respectful elder advisor
    utterance.rate = lang === "ki" ? 0.78 : 0.92;
    utterance.pitch = lang === "ki" ? 0.95 : 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [isSupported]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggle = useCallback((text: string, lang: "en" | "ki" = "en") => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text, lang);
    }
  }, [isSpeaking, speak, stop]);

  return { speak, stop, toggle, isSpeaking, isSupported, disabled };
}
