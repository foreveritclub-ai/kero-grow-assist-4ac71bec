import { Volume2, VolumeX } from "lucide-react";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { useState, useEffect } from "react";

interface SpeakButtonProps {
  text: string;
  lang: "en" | "ki";
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function SpeakButton({ text, lang, label, className = "", size = "sm" }: SpeakButtonProps) {
  const { toggle, isSpeaking, isSupported } = useVoiceAssistant();

  if (!isSupported) return null;

  const sizeClasses = size === "sm" 
    ? "px-3 py-1.5 text-xs gap-1.5" 
    : "px-4 py-2.5 text-sm gap-2";

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      onClick={() => toggle(text, lang)}
      className={`inline-flex items-center rounded-lg font-display font-semibold transition-all active:scale-95 ${
        isSpeaking
          ? "bg-accent text-accent-foreground animate-pulse"
          : "bg-accent/10 text-accent hover:bg-accent/20"
      } ${sizeClasses} ${className}`}
    >
      {isSpeaking ? (
        <VolumeX className={iconSize} />
      ) : (
        <Volume2 className={iconSize} />
      )}
      {label || (lang === "ki" ? "Tegera" : "Listen")}
    </button>
  );
}

interface SpeakAllButtonProps {
  sections: { label: string; text: string }[];
  lang: "en" | "ki";
  className?: string;
}

export function SpeakAllButton({ sections, lang, className = "" }: SpeakAllButtonProps) {
  const { speak, stop, isSpeaking, isSupported } = useVoiceAssistant();

  if (!isSupported) return null;

  const handleClick = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    // Combine all sections into one readable text
    const fullText = sections
      .map(s => `${s.label}. ${s.text}`)
      .join(". ... ");
    speak(fullText, lang);
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-bold text-sm transition-all active:scale-95 ${
        isSpeaking
          ? "bg-accent text-accent-foreground animate-pulse"
          : "bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20"
      } ${className}`}
    >
      {isSpeaking ? (
        <>
          <VolumeX className="w-5 h-5" />
          {lang === "ki" ? "Hagarika" : "Stop Listening"}
        </>
      ) : (
        <>
          <Volume2 className="w-5 h-5" />
          {lang === "ki" ? "🔊 Tegera byose mu majwi" : "🔊 Listen to full diagnosis"}
        </>
      )}
    </button>
  );
}
