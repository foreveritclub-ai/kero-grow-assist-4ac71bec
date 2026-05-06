import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Trash2, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";

interface HistoryItem {
  id: string;
  mode: string;
  crop_name: string | null;
  symptoms: string | null;
  severity: string | null;
  disease_or_issue_en: string | null;
  disease_or_issue_ki: string | null;
  diagnosis_en: string | null;
  diagnosis_ki: string | null;
  emergency_solution_en: string | null;
  emergency_solution_ki: string | null;
  proper_solution_en: string | null;
  proper_solution_ki: string | null;
  solutions_en: string[] | null;
  solutions_ki: string[] | null;
  prevention_en: string[] | null;
  prevention_ki: string[] | null;
  created_at: string;
}

const severityColors: Record<string, string> = {
  good: "bg-severity-good/10 text-severity-good border-severity-good/30",
  warning: "bg-severity-warning/10 text-severity-warning border-severity-warning/30",
  danger: "bg-severity-danger/10 text-severity-danger border-severity-danger/30",
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const { speakSections, stop, isSpeaking, isSupported: ttsSupported } = useVoiceAssistant();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("diagnosis_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setItems((data as any as HistoryItem[]) || []);
        setLoading(false);
      });
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("diagnosis_history").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const pick = <T,>(ki: T | null, en: T | null): T | null => (lang === "ki" ? ki : en) ?? en ?? ki;

  const playFull = () => {
    if (!selected) return;
    const disease = pick(selected.disease_or_issue_ki, selected.disease_or_issue_en);
    const diagnosis = pick(selected.diagnosis_ki, selected.diagnosis_en);
    const emergency = pick(selected.emergency_solution_ki, selected.emergency_solution_en);
    const proper = pick(selected.proper_solution_ki, selected.proper_solution_en);
    const solutions = pick(selected.solutions_ki, selected.solutions_en) || [];
    const prevention = pick(selected.prevention_ki, selected.prevention_en) || [];
    const sections = [
      disease && { type: "default" as const, text: disease },
      diagnosis && { type: "default" as const, text: diagnosis },
      emergency && { type: "emergency" as const, text: emergency },
      proper && { type: "solution" as const, text: proper },
      solutions.length && { type: "solution" as const, text: solutions.join(". ") },
      prevention.length && { type: "solution" as const, text: prevention.slice(0, 3).join(". ") },
    ].filter(Boolean) as { type: any; text: string }[];
    speakSections(sections, lang as "en" | "ki");
  };

  return (
    <MobileLayout>
      <div className="bg-primary px-5 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-primary-foreground"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-display font-bold text-primary-foreground">
            {lang === "ki" ? "Amateka y'isuzuma" : "Diagnosis History"}
          </h1>
        </div>
      </div>
      <div className="px-5 mt-5 space-y-3 mb-4">
        {loading ? (
          <p className="text-center text-muted-foreground text-sm py-8">{lang === "ki" ? "Biraguruka..." : "Loading..."}</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{lang === "ki" ? "Nta mateka ahari" : "No history yet"}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">{lang === "ki" ? "Suzuma igihingwa kugira ngo utangire" : "Scan a crop to get started"}</p>
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="w-full text-left bg-card rounded-xl border border-border p-4 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {item.severity && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${severityColors[item.severity] || ""}`}>
                        {item.severity}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 uppercase">{item.mode}</span>
                  </div>
                  <p className="font-display font-bold text-sm truncate">{item.crop_name || (item.mode === "image" ? "📷 Image" : "—")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {pick(item.disease_or_issue_ki, item.disease_or_issue_en) || pick(item.diagnosis_ki, item.diagnosis_en)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => handleDelete(item.id, e)} className="text-muted-foreground/50 hover:text-destructive p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { stop(); setSelected(null); } }}>
        <DialogContent className="max-w-md max-h-[85vh] p-0 overflow-hidden">
          {selected && (
            <>
              <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                <DialogTitle className="text-base font-display flex items-center gap-2 flex-wrap">
                  {selected.severity && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${severityColors[selected.severity] || ""}`}>
                      {selected.severity}
                    </span>
                  )}
                  <span className="truncate">{selected.crop_name || (lang === "ki" ? "Igihingwa" : "Crop")}</span>
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground">{new Date(selected.created_at).toLocaleString()}</p>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] px-5 py-4">
                <div className="space-y-4 text-xs font-body">
                  {selected.symptoms && (
                    <Section title={lang === "ki" ? "❓ Ikibazo cyatanzwe" : "❓ Reported problem"}>
                      {selected.symptoms}
                    </Section>
                  )}
                  {pick(selected.disease_or_issue_ki, selected.disease_or_issue_en) && (
                    <Section title={lang === "ki" ? "🔍 Indwara/Ikibazo" : "🔍 Disease / Issue"}>
                      {pick(selected.disease_or_issue_ki, selected.disease_or_issue_en)}
                    </Section>
                  )}
                  {pick(selected.diagnosis_ki, selected.diagnosis_en) && (
                    <Section title={lang === "ki" ? "🧪 Isuzuma rya Kero" : "🧪 Kero's diagnosis"}>
                      {pick(selected.diagnosis_ki, selected.diagnosis_en)}
                    </Section>
                  )}
                  {pick(selected.emergency_solution_ki, selected.emergency_solution_en) && (
                    <Section title={lang === "ki" ? "⚡ Uburyo bwihuse" : "⚡ Immediate action"}>
                      {pick(selected.emergency_solution_ki, selected.emergency_solution_en)}
                    </Section>
                  )}
                  {pick(selected.proper_solution_ki, selected.proper_solution_en) && (
                    <Section title={lang === "ki" ? "🛠 Igisubizo cyuzuye" : "🛠 Long-term solution"}>
                      {pick(selected.proper_solution_ki, selected.proper_solution_en)}
                    </Section>
                  )}
                  {(pick(selected.solutions_ki, selected.solutions_en) || []).length > 0 && (
                    <Section title={lang === "ki" ? "📋 Intambwe" : "📋 Steps"}>
                      <ol className="list-decimal pl-4 space-y-1">
                        {(pick(selected.solutions_ki, selected.solutions_en) || []).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </Section>
                  )}
                  {(pick(selected.prevention_ki, selected.prevention_en) || []).length > 0 && (
                    <Section title={lang === "ki" ? "🛡️ Kwirinda" : "🛡️ Prevention"}>
                      <ul className="list-disc pl-4 space-y-1">
                        {(pick(selected.prevention_ki, selected.prevention_en) || []).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>
              </ScrollArea>
              {ttsSupported && (
                <div className="px-5 py-3 border-t border-border">
                  <button
                    onClick={() => isSpeaking ? stop() : playFull()}
                    className="w-full h-10 rounded-full bg-primary text-primary-foreground text-xs font-display font-semibold flex items-center justify-center gap-2"
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    {isSpeaking
                      ? (lang === "ki" ? "Hagarika" : "Stop")
                      : (lang === "ki" ? "🔊 Tegera inama yose" : "🔊 Listen to full advice")}
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-display font-bold text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      <div className="text-foreground whitespace-pre-line leading-relaxed">{children}</div>
    </div>
  );
}
