import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

export const SkillChips = ({ matched = [], missing = [] }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <div className="rounded-xl border bg-card p-4" data-testid="results-matched-skills">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[hsl(160,84%,28%)]" />
        <h4 className="text-sm font-semibold">You have these ({matched.length})</h4>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {matched.length === 0 && <p className="text-sm text-muted-foreground">No matching skills found yet.</p>}
        {matched.map((s) => (
          <Badge key={s} variant="outline" className="border-[hsl(160,60%,80%)] bg-[hsl(160,60%,96%)] text-[hsl(160,84%,22%)]">
            {s}
          </Badge>
        ))}
      </div>
    </div>
    <div className="rounded-xl border bg-card p-4" data-testid="results-missing-skills">
      <div className="mb-3 flex items-center gap-2">
        <XCircle className="h-4 w-4 text-destructive" />
        <h4 className="text-sm font-semibold">The job wants these too ({missing.length})</h4>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {missing.length === 0 && <p className="text-sm text-muted-foreground">Nothing missing - great coverage!</p>}
        {missing.map((s) => (
          <Badge key={s} variant="outline" className="border-[hsl(0,60%,88%)] bg-[hsl(0,60%,97%)] text-[hsl(0,72%,40%)]">
            {s}
          </Badge>
        ))}
      </div>
    </div>
  </div>
);
