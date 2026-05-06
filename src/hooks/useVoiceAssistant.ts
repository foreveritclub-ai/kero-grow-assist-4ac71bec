import { useState, useEffect, useRef, useCallback } from "react";

const TTS_DISABLED_KEY = "kero_tts_disabled_until";
const TTS_LOG_KEY = "kero_tts_log";

export type PhraseType = "greeting" | "emergency" | "solution" | "encouragement" | "default";
export interface SpeechSection {
  type: PhraseType;
  text: string;
}
export interface TtsLogEntry {
  ts: string;
  lang: "en" | "ki";
  type: PhraseType;
  line: string;
  rate: number;
  pitch: number;
  gapMs: number;
}

export function isTTSDisabled(): boolean {
  const until = localStorage.getItem(TTS_DISABLED_KEY);
  if (!until) return false;
  return new Date(until) > new Date();
}

export function getTtsLog(): TtsLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(TTS_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function appendLog(entry: TtsLogEntry) {
  const log = getTtsLog();
  log.push(entry);
  // cap to last 200 entries
  const trimmed = log.slice(-200);
  localStorage.setItem(TTS_LOG_KEY, JSON.stringify(trimmed));
  // also surface to console for live tuning review
  // eslint-disable-next-line no-console
  console.log(`[Kero TTS] ${entry.lang} • ${entry.type} • r=${entry.rate.toFixed(2)} p=${entry.pitch.toFixed(2)} gap=${entry.gapMs}ms › ${entry.line}`);
}

function getBestVoice(lang: "en" | "ki"): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  if (lang === "ki") {
    const rwVoice = voices.find(v => v.lang.toLowerCase().startsWith("rw"));
    if (rwVoice) return rwVoice;
    const swVoice = voices.find(v => v.lang.toLowerCase().startsWith("sw"));
    if (swVoice) return swVoice;
    const africanLocales = ["zu", "xh", "yo", "ig", "ha", "am", "so"];
    for (const code of africanLocales) {
      const v = voices.find(v => v.lang.toLowerCase().startsWith(code));
      if (v) return v;
    }
    const frVoice = voices.find(v => v.lang.toLowerCase().startsWith("fr"));
    if (frVoice) return frVoice;
  }

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

/**
 * Base prosody per (lang, phrase type).
 * Kinyarwanda is tuned to sound like a young Rwandan advisor — warmer pitch,
 * slower cadence on instructions, urgent but clear on emergencies.
 */
function getProsody(lang: "en" | "ki", type: PhraseType) {
  if (lang !== "ki") {
    const en: Record<PhraseType, { rate: number; pitch: number; gapMs: number }> = {
      greeting:      { rate: 0.95, pitch: 1.10, gapMs: 320 },
      emergency:     { rate: 0.98, pitch: 1.08, gapMs: 480 }, // strong pauses
      solution:      { rate: 0.95, pitch: 1.00, gapMs: 220 }, // shorter pauses
      encouragement: { rate: 0.92, pitch: 1.10, gapMs: 360 },
      default:       { rate: 0.94, pitch: 1.02, gapMs: 260 },
    };
    return en[type];
  }
  const ki: Record<PhraseType, { rate: number; pitch: number; gapMs: number }> = {
    greeting:      { rate: 0.88, pitch: 1.20, gapMs: 420 }, // warm, smiling
    emergency:     { rate: 0.90, pitch: 1.12, gapMs: 520 }, // urgent — stronger pauses
    solution:      { rate: 0.86, pitch: 1.04, gapMs: 240 }, // calm, brisk between steps
    encouragement: { rate: 0.86, pitch: 1.18, gapMs: 460 }, // hopeful, uplifting
    default:       { rate: 0.86, pitch: 1.08, gapMs: 320 },
  };
  return ki[type];
}

/**
 * SSML-lite parser. Supports inline cues:
 *   **word**     → emphasis (slower rate, +pitch)
 *   <break/>     → forced extra pause (adds 350ms)
 *   <break ms=N> → custom pause
 *   ALLCAPS word → mild emphasis (+pitch)
 *   trailing !   → urgency boost on that line
 */
function splitIntoLines(text: string): string[] {
  return text
    .replace(/[#*_~`•]/g, m => (m === "*" ? "*" : "")) // keep ** for emphasis
    .replace(/\d+\./g, "")
    .split(/(?<=[.!?])\s+|\n+|<break\s*\/?>|<break\s+ms=\d+\s*\/?>/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function lineModifiers(line: string) {
  let rateAdj = 0;
  let pitchAdj = 0;
  let extraGap = 0;

  // <break ms=N> handled at split, but if a line ends with it, capture
  const breakMatch = line.match(/<break\s+ms=(\d+)\s*\/?>/i);
  if (breakMatch) extraGap += parseInt(breakMatch[1], 10);

  // Emphasis markers **word**
  if (/\*\*[^*]+\*\*/.test(line)) {
    rateAdj -= 0.05;
    pitchAdj += 0.05;
  }

  // Urgency: ends with ! (not just .)
  if (/!\s*$/.test(line)) {
    pitchAdj += 0.06;
    extraGap += 120;
  }

  // ALLCAPS word (≥3 chars) → mild emphasis
  if (/\b[A-Z]{3,}\b/.test(line)) {
    pitchAdj += 0.04;
    rateAdj -= 0.03;
  }

  // Clean inline markers before speaking
  const clean = line
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/<break[^>]*>/gi, "")
    .trim();

  return { clean, rateAdj, pitchAdj, extraGap };
}

export function useVoiceAssistant() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [, setVoicesLoaded] = useState(false);
  const [disabled, setDisabled] = useState(isTTSDisabled());
  const cancelledRef = useRef(false);

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

  const speakSections = useCallback(
    (sections: SpeechSection[], lang: "en" | "ki") => {
      if (!isSupported || !sections.length) return;
      speechSynthesis.cancel();
      cancelledRef.current = false;

      const voice = getBestVoice(lang);
      const baseLang = lang === "ki" ? (voice?.lang || "sw-KE") : (voice?.lang || "en-US");

      // Flatten sections into per-line plan with their phrase type
      const plan: { type: PhraseType; line: string }[] = [];
      sections.forEach(sec => {
        if (!sec.text?.trim()) return;
        splitIntoLines(sec.text).forEach(line => plan.push({ type: sec.type, line }));
      });
      if (!plan.length) return;

      setIsSpeaking(true);

      const speakIndex = (i: number) => {
        if (cancelledRef.current || i >= plan.length) {
          if (!cancelledRef.current) setIsSpeaking(false);
          return;
        }
        const { type, line } = plan[i];
        const { rate, pitch, gapMs } = getProsody(lang, type);
        const { clean, rateAdj, pitchAdj, extraGap } = lineModifiers(line);
        if (!clean) {
          speakIndex(i + 1);
          return;
        }
        const jitter = (Math.random() - 0.5) * 0.04;
        const finalRate = Math.max(0.6, Math.min(1.2, rate + rateAdj + jitter));
        const finalPitch = Math.max(0.6, Math.min(1.4, pitch + pitchAdj + jitter));
        const finalGap = gapMs + extraGap;

        appendLog({
          ts: new Date().toISOString(),
          lang, type, line: clean,
          rate: finalRate, pitch: finalPitch, gapMs: finalGap,
        });

        const utt = new SpeechSynthesisUtterance(clean);
        if (voice) utt.voice = voice;
        utt.lang = baseLang;
        utt.rate = finalRate;
        utt.pitch = finalPitch;
        utt.volume = 1.0;
        utt.onend = () => window.setTimeout(() => speakIndex(i + 1), finalGap);
        utt.onerror = () => { if (!cancelledRef.current) setIsSpeaking(false); };
        speechSynthesis.speak(utt);
      };

      speakIndex(0);
    },
    [isSupported]
  );

  const speak = useCallback(
    (text: string, lang: "en" | "ki" = "en", type: PhraseType = "default") => {
      speakSections([{ type, text }], lang);
    },
    [speakSections]
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const toggle = useCallback(
    (text: string, lang: "en" | "ki" = "en", type: PhraseType = "default") => {
      if (isSpeaking) stop();
      else speak(text, lang, type);
    },
    [isSpeaking, speak, stop]
  );

  return { speak, speakSections, stop, toggle, isSpeaking, isSupported, disabled };
}
