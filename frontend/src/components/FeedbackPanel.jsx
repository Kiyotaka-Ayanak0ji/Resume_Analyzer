import { useState } from "react";
import { api, errMsg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Loader2, GraduationCap, Plus, X } from "lucide-react";

/**
 * Feedback panel - the training loop of the in-house model.
 * Users validate whether analytics are correct; corrections adjust global skill weights.
 */
export const FeedbackPanel = ({ analysis, onSubmitted }) => {
  const result = analysis.result || {};
  const [overallAccurate, setOverallAccurate] = useState(null);
  const [corrections, setCorrections] = useState({}); // skill -> verdict
  const [newSkill, setNewSkill] = useState("");
  const [addedSkills, setAddedSkills] = useState([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(analysis.feedback_given);
  const [changes, setChanges] = useState([]);

  const toggleCorrection = (skill, verdict) => {
    setCorrections((prev) => {
      const next = { ...prev };
      if (next[skill] === verdict) delete next[skill];
      else next[skill] = verdict;
      return next;
    });
  };

  const addSkill = () => {
    const s = newSkill.trim().toLowerCase();
    if (s && !addedSkills.includes(s)) setAddedSkills((p) => [...p, s]);
    setNewSkill("");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/analyses/${analysis.id}/feedback`, {
        overall_accurate: overallAccurate,
        skill_corrections: corrections,
        missing_skills_to_add: addedSkills,
        comment: comment || null,
      });
      setChanges(res.data.changes_applied || []);
      setDone(true);
      toast.success(res.data.message);
      onSubmitted?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border bg-[hsl(160,60%,97%)] p-6" data-testid="feedback-thanks">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[hsl(160,84%,28%)]" />
          <h3 className="font-heading font-semibold">Feedback received - the engine just got smarter</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Every validation improves skill detection for everyone. Thank you for training the free model.
        </p>
        {changes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {changes.map((c, i) => (
              <li key={i} className="font-mono text-xs text-[hsl(160,84%,24%)]">{c}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6" data-testid="feedback-panel">
      <h3 className="font-heading text-lg font-semibold">Was this analysis right?</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your answer trains our free matching engine. No AI subscription needed - the model learns from people like you.
      </p>

      <div className="mt-4 flex gap-2">
        <Button
          variant={overallAccurate === true ? "default" : "outline"}
          size="sm"
          onClick={() => setOverallAccurate(true)}
          data-testid="feedback-accurate-yes"
          className="gap-2"
        >
          <ThumbsUp className="h-4 w-4" /> Looks right
        </Button>
        <Button
          variant={overallAccurate === false ? "default" : "outline"}
          size="sm"
          onClick={() => setOverallAccurate(false)}
          data-testid="feedback-accurate-no"
          className="gap-2"
        >
          <ThumbsDown className="h-4 w-4" /> Not quite
        </Button>
      </div>

      {(result.matched_skills?.length > 0 || result.missing_skills?.length > 0) && (
        <div className="mt-5">
          <p className="text-sm font-medium">Correct individual skills (optional)</p>
          <p className="text-xs text-muted-foreground">Tap a skill once to flag it as wrongly detected, twice to clear.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...(result.matched_skills || []), ...(result.missing_skills || [])].map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`feedback-skill-${s.replace(/[^a-z0-9]/gi, "-")}`}
                onClick={() => toggleCorrection(s, "incorrect")}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  corrections[s] === "incorrect"
                    ? "border-destructive bg-destructive/10 text-destructive line-through"
                    : "border-border bg-secondary/50 hover:border-destructive/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <p className="text-sm font-medium">Did we miss a skill? Add it</p>
        <div className="mt-2 flex gap-2">
          <Input
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSkill()}
            placeholder="e.g. kubernetes"
            className="max-w-xs"
            data-testid="feedback-add-skill-input"
          />
          <Button variant="secondary" size="sm" onClick={addSkill} data-testid="feedback-add-skill-button" className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {addedSkills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {addedSkills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button onClick={() => setAddedSkills((p) => p.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Anything else we got wrong or right? (optional)"
          rows={2}
          data-testid="feedback-comment-input"
        />
      </div>

      <Button
        className="mt-4 gap-2"
        onClick={submit}
        disabled={submitting || (overallAccurate === null && Object.keys(corrections).length === 0 && addedSkills.length === 0)}
        data-testid="feedback-submit-button"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Send feedback & train the model
      </Button>
    </div>
  );
};
