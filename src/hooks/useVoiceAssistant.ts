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

  /**
   * Phrase types let us tune rate/pitch/pauses per section so Kero sounds like
   * a real young Rwandan advisor — warm on greetings, urgent on emergencies,
   * calm and clear on recommendations, uplifting on encouragement.
   */
  type PhraseType = "greeting" | "emergency" | "solution" | "encouragement" | "default";

  const getProsody = (lang: "en" | "ki", type: PhraseType) => {
    if (lang !== "ki") {
      // English defaults — keep close to natural conversational
      const en: Record<PhraseType, { rate: number; pitch: number; gapMs: number }> = {
        greeting:      { rate: 0.95, pitch: 1.10, gapMs: 280 },
        emergency:     { rate: 1.00, pitch: 1.05, gapMs: 200 },
        solution:      { rate: 0.92, pitch: 1.00, gapMs: 260 },
        encouragement: { rate: 0.90, pitch: 1.08, gapMs: 320 },
        default:       { rate: 0.92, pitch: 1.00, gapMs: 240 },
      };
      return en[type];
    }
    // Kinyarwanda — tuned to mimic a young (~teenage) Rwandan advisor:
    // a touch faster than an elder, slightly higher pitch, with emotional
    // variation and clear pauses between lines so each sentence lands.
    const ki: Record<PhraseType, { rate: number; pitch: number; gapMs: number }> = {
      greeting:      { rate: 0.86, pitch: 1.18, gapMs: 380 }, // warm, smiling
      emergency:     { rate: 0.92, pitch: 1.10, gapMs: 240 }, // urgent but clear
      solution:      { rate: 0.82, pitch: 1.02, gapMs: 360 }, // calm, instructional
      encouragement: { rate: 0.84, pitch: 1.15, gapMs: 420 }, // hopeful, uplifting
      default:       { rate: 0.84, pitch: 1.06, gapMs: 320 },
    };
    return ki[type];
  };

  // Split text into natural speech lines so Kero reads sentence-by-sentence
  // (like a human advisor) instead of one long monotone block.
  const splitIntoLines = (text: string): string[] => {
    return text
      .replace(/[#*_~`•]/g, "")
      .replace(/\d+\./g, "")
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);
  };

  const speakLines = useCallback(
    (lines: string[], lang: "en" | "ki", type: PhraseType) => {
      if (!isSupported || !lines.length) return;
      speechSynthesis.cancel();

      const voice = getBestVoice(lang);
      const { rate, pitch, gapMs } = getProsody(lang, type);
      const baseLang = lang === "ki" ? (voice?.lang || "sw-KE") : (voice?.lang || "en-US");

      setIsSpeaking(true);
      let cancelled = false;

      const speakIndex = (i: number) => {
        if (cancelled || i >= lines.length) {
          if (!cancelled) setIsSpeaking(false);
          return;
        }
        const line = lines[i];
        const utt = new SpeechSynthesisUtterance(line);
        if (voice) utt.voice = voice;
        utt.lang = baseLang;
        // Subtle per-line variation so it doesn't feel robotic
        const jitter = (Math.random() - 0.5) * 0.06;
        utt.rate = Math.max(0.6, Math.min(1.2, rate + jitter));
        utt.pitch = Math.max(0.6, Math.min(1.4, pitch + jitter));
        utt.volume = 1.0;

        utt.onend = () => {
          // Pause between lines so each sentence lands like a human advisor
          window.setTimeout(() => speakIndex(i + 1), gapMs);
        };
        utt.onerror = () => {
          if (!cancelled) setIsSpeaking(false);
        };

        utteranceRef.current = utt;
        speechSynthesis.speak(utt);
      };

      // Allow stop() to break the chain
      const origCancel = speechSynthesis.cancel.bind(speechSynthesis);
      (speechSynthesis as any)._keroCancel = () => {
        cancelled = true;
        origCancel();
      };

      speakIndex(0);
    },
    [isSupported]
  );

  const speak = useCallback(
    (text: string, lang: "en" | "ki" = "en", type: PhraseType = "default") => {
      const lines = splitIntoLines(text);
      speakLines(lines, lang, type);
    },
    [speakLines]
  );

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
