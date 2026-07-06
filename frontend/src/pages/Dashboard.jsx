import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip } from "recharts";
import { FileSearch, UploadCloud, ArrowRight, TrendingUp, Gauge, FileText } from "lucide-react";

const scoreBadge = (score) => {
  if (score >= 75) return "bg-[hsl(160,60%,94%)] text-[hsl(160,84%,24%)]";
  if (score >= 50) return "bg-[hsl(34,90%,93%)] text-[hsl(34,92%,30%)]";
  return "bg-[hsl(0,60%,96%)] text-[hsl(0,72%,40%)]";
};

export default function Dashboard() {
  usePageSEO("Dashboard");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [analyses, setAnalyses] = useState(null);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => setStats({}));
    api.get("/analyses?limit=6").then((r) => setAnalyses(r.data)).catch(() => setAnalyses([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold sm:text-3xl" data-testid="dashboard-title">
              Hi {user?.name?.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Here's how your job hunt is going.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild className="gap-2" data-testid="dashboard-new-analysis-button">
              <Link to="/analyze"><FileSearch className="h-4 w-4" /> New analysis</Link>
            </Button>
            <Button variant="secondary" asChild className="gap-2" data-testid="dashboard-manage-resumes-button">
              <Link to="/profile"><UploadCloud className="h-4 w-4" /> My resumes</Link>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {stats === null ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <Card data-testid="dashboard-stat-analyses">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground"><Gauge className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Analyses run</span></div>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{stats.total_analyses ?? 0}</p>
                </CardContent>
              </Card>
              <Card data-testid="dashboard-stat-avg">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Average score</span></div>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{stats.avg_score != null ? `${stats.avg_score}%` : "-"}</p>
                </CardContent>
              </Card>
              <Card data-testid="dashboard-stat-resumes">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-muted-foreground"><FileText className="h-4 w-4" /><span className="text-xs font-medium uppercase tracking-wide">Saved resumes</span></div>
                  <p className="mt-2 font-heading text-3xl font-semibold tabular-nums">{stats.resume_count ?? 0}<span className="text-base text-muted-foreground">/{stats.resume_limit ?? 3}</span></p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Recent analyses */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="font-heading text-lg">Recent analyses</CardTitle>
              <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground" data-testid="dashboard-view-history-link">
                <Link to="/history">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {analyses === null ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : analyses.length === 0 ? (
                <div className="py-8 text-center" data-testid="dashboard-empty-analyses">
                  <p className="text-sm text-muted-foreground">No analyses yet. Run your first one - it takes under a minute.</p>
                  <Button asChild size="sm" className="mt-3 gap-2">
                    <Link to="/analyze">Analyze my resume <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {analyses.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/results/${a.id}`)}
                      data-testid={`dashboard-analysis-row-${a.id}`}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.jd_excerpt?.slice(0, 70) || "Job description"}...</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString()} - {a.mode === "ai" ? `AI (${a.provider})` : a.mode === "deep" ? "Deep check" : "Quick check"}
                        </p>
                      </div>
                      <Badge className={`${scoreBadge(a.result?.score ?? 0)} shrink-0 border-0`}>{Math.round(a.result?.score ?? 0)}%</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trend */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="font-heading text-lg">Score trend</CardTitle></CardHeader>
            <CardContent>
              {stats?.trend?.length > 1 ? (
                <div className="h-44" data-testid="dashboard-trend-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.trend}>
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip formatter={(v) => [`${v}%`, "Score"]} labelFormatter={(l, p) => p?.[0]?.payload?.date || ""} />
                      <Line type="monotone" dataKey="score" stroke="hsl(198 78% 28%)" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">Run at least 2 analyses to see your progress here.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
