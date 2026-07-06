import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, errMsg } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, PlugZap, KeyRound, ShieldCheck } from "lucide-react";

const PROVIDERS = [
  { id: "openai", name: "ChatGPT (OpenAI)", keyLabel: "API key", placeholder: "sk-...", help: "Get a key at platform.openai.com → API keys.", defaultModel: "gpt-4o-mini" },
  { id: "anthropic", name: "Claude (Anthropic)", keyLabel: "API key", placeholder: "sk-ant-...", help: "Get a key at console.anthropic.com.", defaultModel: "claude-3-5-haiku-20241022" },
  { id: "gemini", name: "Gemini (Google)", keyLabel: "API key", placeholder: "AIza...", help: "Get a free key at aistudio.google.com.", defaultModel: "gemini-2.0-flash" },
  { id: "ollama", name: "Ollama (local)", keyLabel: "Server URL", placeholder: "http://localhost:11434", help: "Runs models on your own machine. Works when you self-host this app locally.", defaultModel: "llama3.2" },
];

export default function Settings() {
  usePageSEO("Settings");
  const [keys, setKeys] = useState([]);
  const [inputs, setInputs] = useState({});
  const [models, setModels] = useState({});
  const [busy, setBusy] = useState({});

  const load = () => api.get("/settings/keys").then((r) => setKeys(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const saved = (id) => keys.find((k) => k.provider === id);

  const save = async (id) => {
    const value = (inputs[id] || "").trim();
    if (!value) return toast.error("Enter a value first.");
    setBusy((b) => ({ ...b, [id]: "saving" }));
    try {
      await api.post("/settings/keys", { provider: id, api_key: value, model: (models[id] || "").trim() || null });
      toast.success("Saved. Now test the connection.");
      setInputs((p) => ({ ...p, [id]: "" }));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy((b) => ({ ...b, [id]: null }));
    }
  };

  const test = async (id) => {
    setBusy((b) => ({ ...b, [id]: "testing" }));
    try {
      const res = await api.post("/settings/keys/test", { provider: id });
      res.data.ok ? toast.success("Connection works!") : toast.error("Connection failed.");
      load();
    } catch (e) {
      toast.error(errMsg(e, "Connection failed."));
      load();
    } finally {
      setBusy((b) => ({ ...b, [id]: null }));
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/settings/keys/${id}`);
      toast.success("Key removed.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl" data-testid="settings-title">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional: connect your own AI for richer reviews. The free Quick and Deep modes never need a key.
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Keys are encrypted before storage and never shown again in full. You can remove them anytime.
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PROVIDERS.map((p) => {
            const s = saved(p.id);
            return (
              <Card key={p.id} data-testid={`settings-provider-card-${p.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <h3 className="font-medium">{p.name}</h3>
                    </div>
                    {s ? (
                      s.verified ? (
                        <Badge className="border-0 bg-[hsl(160,60%,94%)] text-[hsl(160,84%,24%)]" data-testid={`settings-status-${p.id}`}>connected</Badge>
                      ) : (
                        <Badge variant="secondary" data-testid={`settings-status-${p.id}`}>saved - not tested</Badge>
                      )
                    ) : (
                      <Badge variant="outline" data-testid={`settings-status-${p.id}`}>not set</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.help}</p>

                  {s && (
                    <p className="mt-3 font-mono text-xs text-muted-foreground" data-testid={`settings-masked-key-${p.id}`}>
                      {p.id === "ollama" ? "URL" : "Key"}: {s.masked_key} {s.model && `- model: ${s.model}`}
                    </p>
                  )}

                  <div className="mt-3 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{p.keyLabel}</Label>
                      <Input
                        type={p.id === "ollama" ? "text" : "password"}
                        value={inputs[p.id] || ""}
                        onChange={(e) => setInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={p.placeholder}
                        data-testid={`settings-key-input-${p.id}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Model (optional)</Label>
                      <Input
                        value={models[p.id] || ""}
                        onChange={(e) => setModels((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={p.defaultModel}
                        data-testid={`settings-model-input-${p.id}`}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => save(p.id)} disabled={busy[p.id] === "saving"} className="gap-1.5" data-testid={`settings-save-button-${p.id}`}>
                      {busy[p.id] === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                    </Button>
                    {s && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => test(p.id)} disabled={busy[p.id] === "testing"} className="gap-1.5"
                          data-testid={`settings-provider-test-connection-button-${p.id}`}>
                          {busy[p.id] === "testing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                          Test connection
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="gap-1.5 text-destructive hover:text-destructive"
                          data-testid={`settings-delete-button-${p.id}`}>
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
