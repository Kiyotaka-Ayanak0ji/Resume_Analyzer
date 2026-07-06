import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, errMsg } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dropzone } from "@/components/Dropzone";
import { ModeSelector } from "@/components/ModeSelector";
import { Loader2, Play, Database } from "lucide-react";

const LOADING_STEPS = ["Parsing your resume...", "Comparing skills...", "Checking each job requirement...", "Writing suggestions..."];

export default function Analyze() {
  usePageSEO("Analyze your resume");
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [sourceTab, setSourceTab] = useState("paste");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [uploadedName, setUploadedName] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [jdText, setJdText] = useState("");
  const [mode, setMode] = useState("quick");
  const [provider, setProvider] = useState("");
  const [keys, setKeys] = useState([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    api.get("/resumes").then((r) => {
      setResumes(r.data);
      if (r.data.length > 0) {
        setSourceTab("saved");
        const def = r.data.find((x) => x.is_default) || r.data[0];
        setSelectedResumeId(def.id);
      }
    }).catch(() => {});
    api.get("/settings/keys").then((r) => {
      setKeys(r.data);
      if (r.data.length > 0) setProvider(r.data[0].provider);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!running) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1100);
    return () => clearInterval(t);
  }, [running]);

  const handleFile = async (file) => {
    setUploading(true);
    setFromCache(false);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api.post("/parse-file", form);
      setResumeText(res.data.text);
      setUploadedName(res.data.filename);
      setFromCache(res.data.from_cache);
      toast.success(res.data.from_cache ? "We already knew this resume - loaded instantly from cache." : "File read successfully.");
    } catch (e) {
      toast.error(errMsg(e, "Could not read this file."));
    } finally {
      setUploading(false);
    }
  };

  const canRun = () => {
    const hasResume = sourceTab === "saved" ? !!selectedResumeId : resumeText.trim().length >= 50;
    return hasResume && jdText.trim().length >= 50 && (mode !== "ai" || !!provider);
  };

  const run = async () => {
    setRunning(true);
    try {
      const payload = {
        jd_text: jdText.trim(),
        mode,
        provider: mode === "ai" ? provider : null,
      };
      if (sourceTab === "saved") payload.resume_id = selectedResumeId;
      else payload.resume_text = resumeText.trim();
      const res = await api.post("/analyze", payload);
      navigate(`/results/${res.data.id}`);
    } catch (e) {
      toast.error(errMsg(e, "Analysis failed. Please try again."));
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl" data-testid="analyze-title">Analyze your resume</h1>
        <p className="mt-1 text-sm text-muted-foreground">Three steps: add your resume, paste the job post, pick a mode.</p>

        {/* Step 1: resume source */}
        <Card className="mt-6">
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
              Your resume
            </h2>
            <Tabs value={sourceTab} onValueChange={setSourceTab}>
              <TabsList data-testid="analyze-source-tabs">
                <TabsTrigger value="saved" data-testid="analyze-source-saved-tab" disabled={resumes.length === 0}>
                  Saved {resumes.length > 0 && `(${resumes.length})`}
                </TabsTrigger>
                <TabsTrigger value="paste" data-testid="analyze-source-paste-tab">Paste text</TabsTrigger>
                <TabsTrigger value="upload" data-testid="analyze-source-upload-tab">Upload file</TabsTrigger>
              </TabsList>
              <TabsContent value="saved" className="mt-4">
                {resumes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved resumes yet. Save one from the My Resumes page.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {resumes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        data-testid={`analyze-saved-resume-${r.id}`}
                        onClick={() => setSelectedResumeId(r.id)}
                        className={`rounded-lg border p-3 text-left text-sm transition-all ${
                          selectedResumeId === r.id ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "hover:border-primary/40"
                        }`}
                      >
                        <p className="truncate font-medium">{r.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.skills?.length || 0} skills detected</p>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="paste" className="mt-4">
                <Textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your full resume text here (at least 50 characters)..."
                  rows={8}
                  data-testid="analyze-resume-textarea"
                />
                <p className="mt-1 text-xs text-muted-foreground">{resumeText.trim().length} characters</p>
              </TabsContent>
              <TabsContent value="upload" className="mt-4">
                <Dropzone onFile={handleFile} uploading={uploading} uploadedName={uploadedName} testid="analyze-dropzone" />
                {fromCache && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-primary" data-testid="analyze-cache-notice">
                    <Database className="h-3.5 w-3.5" /> Loaded from the knowledge cache - this resume was parsed before.
                  </p>
                )}
                {uploadedName && resumeText && (
                  <p className="mt-2 text-xs text-muted-foreground">{resumeText.split(/\s+/).length} words extracted</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Step 2: JD */}
        <Card className="mt-4">
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
              The job description
            </h2>
            <Textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job post here - requirements, responsibilities, everything..."
              rows={7}
              data-testid="analyze-jd-textarea"
            />
            <p className="mt-1 text-xs text-muted-foreground">{jdText.trim().length} characters (minimum 50)</p>
          </CardContent>
        </Card>

        {/* Step 3: mode */}
        <Card className="mt-4">
          <CardContent className="p-5 sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
              How deep should we go?
            </h2>
            <ModeSelector value={mode} onChange={setMode} />
            {mode === "ai" && (
              <div className="mt-4">
                {keys.length === 0 ? (
                  <p className="rounded-lg border border-[hsl(34,90%,80%)] bg-[hsl(34,90%,95%)] p-3 text-sm text-[hsl(34,92%,25%)]" data-testid="analyze-no-keys-warning">
                    You haven't added an AI key yet. Add one in Settings, or use the free Quick/Deep modes.
                  </p>
                ) : (
                  <div className="flex items-center gap-3">
                    <Select value={provider} onValueChange={setProvider}>
                      <SelectTrigger className="w-56" data-testid="analyze-provider-select">
                        <SelectValue placeholder="Pick your AI provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {keys.map((k) => (
                          <SelectItem key={k.provider} value={k.provider} data-testid={`analyze-provider-option-${k.provider}`}>
                            {{ openai: "ChatGPT (OpenAI)", anthropic: "Claude (Anthropic)", gemini: "Gemini (Google)", ollama: "Ollama (local)" }[k.provider]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {keys.find((k) => k.provider === provider)?.verified && <Badge variant="secondary">verified</Badge>}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Run */}
        <div className="mt-6">
          {running ? (
            <Card data-testid="analyze-loading-card">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">{LOADING_STEPS[step]}</p>
                </div>
                <Progress value={((step + 1) / LOADING_STEPS.length) * 100} className="mt-4" />
              </CardContent>
            </Card>
          ) : (
            <Button size="lg" className="w-full gap-2 sm:w-auto" disabled={!canRun()} onClick={run} data-testid="analyze-run-button">
              <Play className="h-4 w-4" /> Run analysis
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
