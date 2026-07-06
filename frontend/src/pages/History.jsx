import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, errMsg } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Trash2, ExternalLink, FileSearch } from "lucide-react";

const scoreBadge = (score) => {
  if (score >= 75) return "bg-[hsl(160,60%,94%)] text-[hsl(160,84%,24%)]";
  if (score >= 50) return "bg-[hsl(34,90%,93%)] text-[hsl(34,92%,30%)]";
  return "bg-[hsl(0,60%,96%)] text-[hsl(0,72%,40%)]";
};

export default function History() {
  usePageSEO("Analysis history");
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState(null);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  const load = () => api.get("/analyses?limit=100").then((r) => setAnalyses(r.data)).catch(() => setAnalyses([]));
  useEffect(() => { load(); }, []);

  const remove = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/analyses/${id}`);
      toast.success("Analysis deleted.");
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const filtered = (analyses || []).filter((a) => {
    if (modeFilter !== "all" && a.mode !== modeFilter) return false;
    if (query && !(`${a.jd_excerpt} ${a.resume_label || ""}`.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl" data-testid="history-title">Analysis history</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every check you've run. Click a row to reopen it.</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job text..."
              className="w-64 pl-8" data-testid="history-search-input" />
          </div>
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-40" data-testid="history-mode-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="quick">Quick</SelectItem>
              <SelectItem value="deep">Deep</SelectItem>
              <SelectItem value="ai">AI-powered</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="mt-5">
          <CardContent className="p-0">
            {analyses === null ? (
              <div className="space-y-3 p-6">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-center" data-testid="history-empty-state">
                <FileSearch className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {analyses.length === 0 ? "No analyses yet. Run your first one!" : "Nothing matches your filters."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job description</TableHead>
                    <TableHead className="hidden sm:table-cell">Mode</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => navigate(`/results/${a.id}`)} data-testid={`history-row-${a.id}`}>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate text-sm font-medium">{a.jd_excerpt?.slice(0, 60)}...</p>
                        {a.resume_label && <p className="text-xs text-muted-foreground">Resume: {a.resume_label}</p>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline">{a.mode === "ai" ? `AI (${a.provider})` : a.mode}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {new Date(a.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${scoreBadge(a.result?.score ?? 0)} border-0`}>{Math.round(a.result?.score ?? 0)}%</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open" data-testid={`history-open-button-${a.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete"
                            onClick={(e) => remove(a.id, e)} data-testid={`history-delete-button-${a.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
