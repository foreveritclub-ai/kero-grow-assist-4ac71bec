import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { SpeakButton, SpeakAllButton } from "@/components/SpeakButton";

export interface DiagnosisResult {
  severity: "good" | "warning" | "danger";
  confidence?: "high" | "medium" | "low";
  greeting_ki?: string;
  greeting_en?: string;
  diagnosis_en: string;
  diagnosis_ki: string;
  disease_or_issue_en: string;
  disease_or_issue_ki: string;
  solutions_en: string[];
  solutions_ki: string[];
  prevention_en: string[];
  prevention_ki: string[];
  emergency_solution_en?: string;
  emergency_solution_ki?: string;
  proper_solution_en?: string;
  proper_solution_ki?: string;
  encouragement_en?: string;
  encouragement_ki?: string;
}

interface DiagnosisCardProps {
  result: DiagnosisResult;
  lang: "en" | "ki";
  diagnosisId?: string | null;
}

const severityConfig = {
  good: {
    icon: CheckCircle,
    label: "Healthy",
    labelKi: "Muzima",
    bgClass: "bg-severity-good/10",
    textClass: "text-severity-good",
    borderClass: "border-severity-good/30",
  },
  warning: {
    icon: AlertTriangle,
    label: "Warning",
    labelKi: "Icyitonderwa",
    bgClass: "bg-severity-warning/10",
    textClass: "text-severity-warning",
    borderClass: "border-severity-warning/30",
  },
  danger: {
    icon: Shield,
    label: "Critical",
    labelKi: "Byihutirwa",
    bgClass: "bg-severity-danger/10",
    textClass: "text-severity-danger",
    borderClass: "border-severity-danger/30",
  },
};

export function DiagnosisCard({ result, lang, diagnosisId }: DiagnosisCardProps) {
  const sev = severityConfig[result.severity] || severityConfig.warning;
  const Icon = sev.icon;
  const { user } = useAuth();
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackValue, setFeedbackValue] = useState<boolean | null>(null);

  const greeting = lang === "ki" ? result.greeting_ki : result.greeting_en;
  const diagnosis = lang === "ki" ? result.diagnosis_ki : result.diagnosis_en;
  const issue = lang === "ki" ? result.disease_or_issue_ki : result.disease_or_issue_en;
  const solutions = lang === "ki" ? result.solutions_ki : result.solutions_en;
  const prevention = lang === "ki" ? result.prevention_ki : result.prevention_en;
  const emergency = lang === "ki" ? result.emergency_solution_ki : result.emergency_solution_en;
  const proper = lang === "ki" ? result.proper_solution_ki : result.proper_solution_en;
  const encouragement = lang === "ki" ? result.encouragement_ki : result.encouragement_en;
  const sevLabel = lang === "ki" ? sev.labelKi : sev.label;

  const sendFeedback = async (helpful: boolean) => {
    if (!user || !diagnosisId || feedbackSent) return;
    setFeedbackValue(helpful);
    setFeedbackSent(true);
    try {
      await supabase.from("diagnosis_feedback").insert({
        user_id: user.id,
        diagnosis_id: diagnosisId,
        helpful,
      });
    } catch (err) {
      console.error("Failed to save feedback:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* 🔊 Listen to Full Diagnosis */}
      <SpeakAllButton
        lang={lang}
        sections={[
          { label: lang === "ki" ? "Ikibazo" : "Issue", text: issue },
          { label: lang === "ki" ? "Isuzuma" : "Diagnosis", text: diagnosis },
          ...(emergency ? [{ label: lang === "ki" ? "Uburyo bwihuse" : "Emergency Solution", text: emergency }] : []),
          ...(proper ? [{ label: lang === "ki" ? "Uburyo bwuzuye" : "Proper Solution", text: proper }] : []),
          { label: lang === "ki" ? "Ibisubizo" : "Solutions", text: solutions?.join(". ") || "" },
          { label: lang === "ki" ? "Kwirinda" : "Prevention", text: prevention?.join(". ") || "" },
        ]}
      />

      {/* Greeting */}
      {greeting && (
        <p className="text-base font-display font-bold text-foreground">{greeting}</p>
      )}

      {/* Severity Banner */}
      <div className={`rounded-xl p-4 border ${sev.bgClass} ${sev.borderClass} flex items-center gap-3`}>
        <Icon className={`w-8 h-8 ${sev.textClass}`} />
        <div>
          <p className={`font-display font-bold text-lg ${sev.textClass}`}>{sevLabel}</p>
          <p className="text-sm font-body text-foreground">{issue}</p>
        </div>
      </div>

      {/* Diagnosis */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-display font-bold text-sm mb-2">🧠 {lang === "ki" ? "Isuzuma" : "Diagnosis"}</h3>
        <p className="text-sm text-muted-foreground font-body leading-relaxed">{diagnosis}</p>
      </div>

      {/* Emergency Solution */}
      {emergency && (
        <div className="bg-severity-warning/5 rounded-xl border border-severity-warning/20 p-4">
          <h3 className="font-display font-bold text-sm mb-2">⚡ {lang === "ki" ? "Uburyo bwihuse" : "Emergency Solution"}</h3>
          <p className="text-sm text-foreground font-body leading-relaxed">{emergency}</p>
        </div>
      )}

      {/* Proper Solution */}
      {proper && (
        <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
          <h3 className="font-display font-bold text-sm mb-2">🛠 {lang === "ki" ? "Uburyo bwuzuye" : "Proper Solution"}</h3>
          <p className="text-sm text-foreground font-body leading-relaxed">{proper}</p>
        </div>
      )}

      {/* Solutions */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-display font-bold text-sm mb-3">
          {lang === "ki" ? "Ibisubizo byose" : "All Solutions"}
        </h3>
        <div className="space-y-2">
          {solutions?.map((sol, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-foreground font-body">{sol}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prevention */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-display font-bold text-sm mb-3">
          {lang === "ki" ? "Kwirinda" : "Prevention Tips"}
        </h3>
        <div className="space-y-2">
          {prevention?.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-secondary text-lg leading-none">•</span>
              <p className="text-sm text-foreground font-body">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Encouragement */}
      {encouragement && (
        <div className="bg-secondary/10 rounded-xl p-4 text-center">
          <p className="text-sm font-display font-semibold text-foreground">{encouragement}</p>
        </div>
      )}

      {/* Feedback */}
      {diagnosisId && (
        <div className="bg-card rounded-xl border border-border p-4">
          {!feedbackSent ? (
            <div className="text-center">
              <p className="font-display font-semibold text-sm mb-3">
                {lang === "ki" ? "Ese iyi nama yagufashije?" : "Was this helpful?"}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => sendFeedback(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-severity-good/10 text-severity-good border border-severity-good/30 font-display font-semibold text-sm active:scale-95 transition-transform"
                >
                  <ThumbsUp className="w-4 h-4" />
                  {lang === "ki" ? "Yego" : "Yes"}
                </button>
                <button
                  onClick={() => sendFeedback(false)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 font-display font-semibold text-sm active:scale-95 transition-transform"
                >
                  <ThumbsDown className="w-4 h-4" />
                  {lang === "ki" ? "Oya" : "No"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm font-display font-semibold text-muted-foreground">
              {feedbackValue
                ? (lang === "ki" ? "💚 Murakoze! Turishimiye ko twagufashije." : "💚 Thank you! Glad we could help.")
                : (lang === "ki" ? "🙏 Murakoze! Tuzagerageza kunoza serivisi yacu." : "🙏 Thank you! We'll work to improve.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
