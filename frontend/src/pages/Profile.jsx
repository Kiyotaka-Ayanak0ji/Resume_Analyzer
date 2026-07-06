import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, errMsg } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { Plus, Trash2, Eye, Star, Loader2, FileText } from "lucide-react";

export default function Profile() {
  usePageSEO("My resumes");
  const [resumes, setResumes] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState("paste");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = () => api.get("/resumes").then((r) => setResumes(r.data)).catch(() => setResumes([]));
  useEffect(() => { load(); }, []);

  const reset = () => { setLabel(""); setText(""); setFile(null); setTab("paste"); };

  const save = async () => {
    setSaving(true);
    try {
      if (tab === "paste") {
        await api.post("/resumes", { label: label || "My resume", text });
      } else {
        const form = new FormData();
        form.append("file", file);
        form.append("label", label || file?.name || "My resume");
        await api.post("/resumes/upload", form);
      }
      toast.success("Resume saved.");
      setDialogOpen(false);
      reset();
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save this resume."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/resumes/${id}`);
      toast.success("Resume deleted.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const setDefault = async (id) => {
    try {
      await api.patch(`/resumes/${id}`, { is_default: true });
      toast.success("Default resume updated.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const canSave = tab === "paste" ? text.trim().length >= 50 : !!file;
  const atLimit = resumes && resumes.length >= 3;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold sm:text-3xl" data-testid="profile-title">My resumes</h1>
            <p className="mt-1 text-sm text-muted-foreground">Store up to 3 resumes and reuse them in any analysis.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={atLimit} data-testid="profile-add-resume-button">
                <Plus className="h-4 w-4" /> Add resume {resumes && `(${resumes.length}/3)`}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-heading">Add a resume</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)}
                    placeholder='e.g. "Backend Engineer v2"' data-testid="profile-resume-label-input" />
                </div>
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList>
                    <TabsTrigger value="paste" data-testid="profile-paste-tab">Paste text</TabsTrigger>
                    <TabsTrigger value="upload" data-testid="profile-upload-tab">Upload file</TabsTrigger>
                  </TabsList>
                  <TabsContent value="paste" className="mt-3">
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
                      placeholder="Paste your resume text (at least 50 characters)..." data-testid="profile-resume-textarea" />
                    <p className="mt-1 text-xs text-muted-foreground">{text.trim().length} characters</p>
                  </TabsContent>
                  <TabsContent value="upload" className="mt-3">
                    <Dropzone onFile={setFile} uploadedName={file?.name} testid="profile-dropzone" />
                  </TabsContent>
                </Tabs>
              </div>
              <DialogFooter>
                <Button onClick={save} disabled={!canSave || saving} className="gap-2" data-testid="profile-save-resume-button">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save resume
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {atLimit && (
          <p className="mt-4 rounded-lg border border-[hsl(34,90%,80%)] bg-[hsl(34,90%,95%)] p-3 text-sm text-[hsl(34,92%,25%)]" data-testid="profile-limit-notice">
            You've reached the 3-resume limit. Delete one to add another.
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes === null ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)
          ) : resumes.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center py-12 text-center" data-testid="profile-empty-state">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">No resumes saved yet. Add one to speed up future analyses.</p>
              </CardContent>
            </Card>
          ) : (
            resumes.map((r) => (
              <Card key={r.id} className="transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(2,6,23,0.08)]" data-testid={`profile-resume-card-${r.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{r.label}</p>
                    {r.is_default && <Badge variant="secondary" className="shrink-0 gap-1"><Star className="h-3 w-3" /> default</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.source === "upload" ? `Uploaded ${r.filename || "file"}` : "Pasted text"} - {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(r.skills || []).slice(0, 5).map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                    {(r.skills || []).length > 5 && <Badge variant="outline" className="text-xs">+{r.skills.length - 5} more</Badge>}
                  </div>
                  <div className="mt-4 flex gap-1">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => setPreview(r)} data-testid={`profile-resume-preview-button-${r.id}`}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                    {!r.is_default && (
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => setDefault(r.id)} data-testid={`profile-resume-default-button-${r.id}`}>
                        <Star className="h-3.5 w-3.5" /> Default
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" data-testid={`profile-resume-delete-button-${r.id}`}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{r.label}"?</AlertDialogTitle>
                          <AlertDialogDescription>This can't be undone. Past analyses stay in your history.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="profile-resume-delete-confirm">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="font-heading">{preview?.label}</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-secondary/40 p-4 text-sm" data-testid="profile-resume-preview-content">
              {preview?.text}
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
}
