import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/ScoreGauge";
import { SkillChips } from "@/components/SkillChips";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { ArrowLeft, FileSearch, CheckCircle2, AlertTriangle, XCircle, Lightbulb, Sparkles, Database } from "lucide-react";

const labelColor = (label) => {
  if (label === "Strong match") return "bg-[hsl(160,60%,94%)] text-[hsl(160,84%,24%)]";
  if (label === "Decent match") return "bg-[hsl(34,90%,93%)] text-[hsl(34,92%,30%)]";
  return "bg-[hsl(0,60%,96%)] text-[hsl(0,72%,40%)]";
};

const explainScore = (r) => {
  const matched = r.matched_skills?.length || 0;
  const missing = r.missing_skills?.length || 0;
  if (r.score >= 75) return `You cover ${matched} of the skills this job asks for${missing ? ` and only miss ${missing}` : ""}. You're a serious candidate on paper.`;
  if (r.score >= 50) return `You match ${matched} required skills but miss ${missing}. Closing even a few gaps could push you into the strong zone.`;
  return `Only ${matched} required skills matched, and ${missing} are missing. Consider tailoring your resume to this job or targeting closer roles.`;
};

export default function Results() {
  usePageSEO("Analysis results");
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setAnalysis(null);
    api.get(`/analyses/${id}`).then((r) => setAnalysis(r.data)).catch((e) => setError(e?.response?.data?.detail || "Could not load this analysis."));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground" data-testid="results-error">{error}</p>
        <Button asChild className="mt-4"><Link to="/history">Back to history</Link></Button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const r = analysis.result || {};
  const ai = analysis.ai_insights;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground" data-testid="results-back-button">
            <Link to="/history"><ArrowLeft className="h-4 w-4" /> History</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild className="gap-2" data-testid="results-new-analysis-button">
            <Link to="/analyze"><FileSearch className="h-4 w-4" /> New analysis</Link>
          </Button>
        </div>

        {/* Score hero */}
        <Card className="mt-4 overflow-hidden">
          <div className="h-2" style={{ background: "linear-gradient(135deg, rgba(34,211,238,0.35), rgba(16,185,129,0.25))" }} />
          <CardContent className="p-6">
            <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <ScoreGauge score={r.score ?? 0} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${labelColor(r.label)} border-0`} data-testid="results-score-label">{r.label}</Badge>
                  <Badge variant="outline" data-testid="results-mode-badge">
                    {analysis.mode === "ai" ? `AI-powered (${analysis.provider})` : analysis.mode === "deep" ? "Deep check" : "Quick check"}
                  </Badge>
                  {analysis.resume_from_cache && (
                    <Badge variant="outline" className="gap-1" data-testid="results-cache-badge">
                      <Database className="h-3 w-3" /> cached resume
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground" data-testid="results-explanation">
                  {explainScore(r)}
                </p>
                {r.semantic_similarity != null && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Meaning-level similarity between your resume and this job: {(r.semantic_similarity * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI insights */}
        {ai && (
          <Card className="mt-4" data-testid="results-ai-insights">
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-heading font-semibold">AI review</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{ai.summary}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(160,84%,28%)]">Strengths</p>
                  <ul className="mt-2 space-y-1.5">
                    {ai.strengths?.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(160,84%,28%)]" />{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Gaps</p>
                  <ul className="mt-2 space-y-1.5">
                    {ai.gaps?.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        <div className="mt-4">
          <SkillChips matched={r.matched_skills} missing={r.missing_skills} />
        </div>

        {/* Breakdown tabs */}
        <Card className="mt-4">
          <CardContent className="p-6">
            <Tabs defaultValue="suggestions">
              <TabsList data-testid="results-breakdown-tabs">
                <TabsTrigger value="suggestions" data-testid="results-tab-suggestions">Suggestions</TabsTrigger>
                {r.alignments?.length > 0 && <TabsTrigger value="evidence" data-testid="results-tab-evidence">Requirement evidence</TabsTrigger>}
                <TabsTrigger value="keywords" data-testid="results-tab-keywords">Keywords</TabsTrigger>
                <TabsTrigger value="checks" data-testid="results-tab-checks">Resume checks</TabsTrigger>
              </TabsList>

              <TabsContent value="suggestions" className="mt-4 space-y-3">
                {(ai?.suggestions?.length ? ai.suggestions.map((s) => ({ title: s, detail: null })) : r.suggestions || []).map((s, i) => (
                  <div key={i} className="flex gap-3 rounded-lg border bg-secondary/30 p-4" data-testid={`results-suggestion-${i}`}>
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(34,92%,45%)]" />
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      {s.detail && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.detail}</p>}
                    </div>
                  </div>
                ))}
              </TabsContent>

              {r.alignments?.length > 0 && (
                <TabsContent value="evidence" className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">For each line of the job post, the closest evidence found in your resume.</p>
                  {r.alignments.map((a, i) => (
                    <div key={i} className="rounded-lg border p-3" data-testid={`results-alignment-${i}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{a.jd_requirement}</p>
                        <Badge variant="outline" className={`shrink-0 gap-1 ${
                          a.strength === "strong" ? "border-[hsl(160,60%,70%)] text-[hsl(160,84%,24%)]"
                          : a.strength === "partial" ? "border-[hsl(34,90%,70%)] text-[hsl(34,92%,30%)]"
                          : "border-[hsl(0,60%,80%)] text-[hsl(0,72%,40%)]"
                        }`}>
                          {a.strength === "strong" ? <CheckCircle2 className="h-3 w-3" /> : a.strength === "partial" ? <AlertTriangle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {a.strength}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">→ {a.resume_evidence}</p>
                    </div>
                  ))}
                </TabsContent>
              )}

              <TabsContent value="keywords" className="mt-4">
                <p className="text-xs text-muted-foreground">The most important terms in this job post - and whether your resume uses them.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(r.top_jd_terms || []).map((t) => (
                    <Badge key={t.term} variant="outline" className={t.in_resume ? "border-[hsl(160,60%,80%)] bg-[hsl(160,60%,96%)] text-[hsl(160,84%,22%)]" : "border-[hsl(0,60%,88%)] bg-[hsl(0,60%,97%)] text-[hsl(0,72%,40%)]"}>
                      {t.in_resume ? "✓" : "✗"} {t.term}
                    </Badge>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="checks" className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries({
                  summary: "Has a summary or objective",
                  experience: "Has an experience section",
                  education: "Has an education section",
                  skills_section: "Has a skills section",
                  contact: "Has contact details",
                  has_numbers: "Uses numbers to show impact",
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 rounded-lg border p-3 text-sm" data-testid={`results-check-${key}`}>
                    {r.sections?.[key] ? <CheckCircle2 className="h-4 w-4 text-[hsl(160,84%,28%)]" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    {label}
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Feedback = training loop */}
        <div className="mt-4">
          <FeedbackPanel analysis={analysis} />
        </div>
      </motion.div>
    </div>
  );
}
