import { Zap, BrainCircuit, Sparkles } from "lucide-react";

const MODES = [
  {
    id: "quick",
    icon: Zap,
    title: "Quick check",
    desc: "Keyword and skill matching. Instant results.",
    tag: "Free",
  },
  {
    id: "deep",
    icon: BrainCircuit,
    title: "Deep check",
    desc: "Understands meaning, not just keywords. Takes a few seconds.",
    tag: "Free",
  },
  {
    id: "ai",
    icon: Sparkles,
    title: "AI-powered",
    desc: "Uses your own AI key (ChatGPT, Claude, Gemini or Ollama) for a written review.",
    tag: "Your key",
  },
];

export const ModeSelector = ({ value, onChange }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {MODES.map(({ id, icon: Icon, title, desc, tag }) => (
      <button
        key={id}
        type="button"
        data-testid={`analyze-mode-${id}`}
        onClick={() => onChange(id)}
        className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(2,6,23,0.08)] ${
          value === id ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border bg-card"
        }`}
      >
        <div className="flex w-full items-center justify-between">
          <Icon className={`h-5 w-5 ${value === id ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            tag === "Free" ? "bg-[hsl(160,60%,94%)] text-[hsl(160,84%,24%)]" : "bg-accent text-accent-foreground"
          }`}>{tag}</span>
        </div>
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">{desc}</span>
      </button>
    ))}
  </div>
);
