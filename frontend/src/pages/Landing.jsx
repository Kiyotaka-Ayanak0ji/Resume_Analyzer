import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileCheck2, Zap, BrainCircuit, Sparkles, ShieldCheck, Github, Database,
  GraduationCap, UploadCloud, Gauge, ArrowRight,
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
};

export default function Landing() {
  usePageSEO(null, null); // default brand title + description for the public landing page
  const { user } = useAuth();
  const [kb, setKb] = useState(null);

  useEffect(() => {
    api.get("/kb/stats").then((r) => setKb(r.data)).catch(() => {});
  }, []);

  const startHref = user ? "/analyze" : "/register";

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2" data-testid="landing-brand-link">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileCheck2 className="h-4 w-4" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">Resume Decoded</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild data-testid="landing-nav-dashboard-button">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild data-testid="landing-nav-login-button">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild data-testid="landing-nav-register-button">
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(900px circle at 15% 10%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(700px circle at 85% 20%, rgba(251,191,36,0.10), transparent 55%)",
        }}
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <motion.div {...fadeUp}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Github className="h-3.5 w-3.5" /> 100% free & open-source. No subscription. Ever.
            </div>
            <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              See how your resume matches a job - fast.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste your resume and a job description. Get a clear match score, the skills you're missing,
              and plain-language fixes. Runs on a free engine you help train - or plug in your own AI key.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" asChild className="gap-2" data-testid="landing-hero-cta-button">
                <Link to={startHref}>
                  Try it free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild data-testid="landing-hero-secondary-button">
                <a href="#how-it-works">How it works</a>
              </Button>
            </div>
            {kb && (
              <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground" data-testid="landing-kb-stats">
                <span><strong className="font-heading text-foreground">{kb.skills_known}</strong> skills known</span>
                <span><strong className="font-heading text-foreground">{kb.cached_resumes}</strong> resumes cached</span>
                <span><strong className="font-heading text-foreground">{kb.feedback_events}</strong> training feedbacks</span>
              </div>
            )}
          </motion.div>

          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
            <Card className="shadow-[0_14px_40px_rgba(2,6,23,0.12)]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Match score</p>
                  <span className="rounded-full bg-[hsl(160,60%,94%)] px-2.5 py-0.5 text-xs font-semibold text-[hsl(160,84%,24%)]">Strong match</span>
                </div>
                <p className="mt-2 font-heading text-5xl font-semibold text-primary">82%</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full w-[82%] rounded-full bg-primary" />
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[hsl(160,84%,40%)]" /> python, react, mongodb, docker matched</p>
                  <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-destructive" /> kubernetes, graphql missing</p>
                  <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[hsl(34,92%,50%)]" /> Add numbers to your achievements</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <motion.h2 {...fadeUp} className="font-heading text-2xl font-semibold sm:text-3xl">How it works</motion.h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: UploadCloud, title: "1. Add your resume", desc: "Paste the text or upload a PDF/DOCX. We parse it once and cache it - never twice." },
            { icon: Gauge, title: "2. Get your score", desc: "Pick Quick or Deep check. See matched skills, gaps, and clear suggestions in seconds." },
            { icon: GraduationCap, title: "3. Train the engine", desc: "Tell us what we got right or wrong. Your feedback makes the free model smarter for everyone." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <motion.div key={title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}>
              <Card className="h-full transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(2,6,23,0.12)]">
                <CardContent className="p-6">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="mt-3 font-heading font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Mode comparison */}
      <section className="border-y bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <motion.h2 {...fadeUp} className="font-heading text-2xl font-semibold sm:text-3xl">Three ways to analyze</motion.h2>
          <motion.div {...fadeUp} className="mt-6">
            <Tabs defaultValue="quick">
              <TabsList data-testid="landing-mode-tabs">
                <TabsTrigger value="quick" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Quick</TabsTrigger>
                <TabsTrigger value="deep" className="gap-1.5"><BrainCircuit className="h-3.5 w-3.5" /> Deep</TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> AI-powered</TabsTrigger>
              </TabsList>
              {[
                { v: "quick", title: "Quick check - instant", desc: "Compares keywords and skills between your resume and the job post. Best for a fast first look. Completely free, runs on our servers, no AI key needed." },
                { v: "deep", title: "Deep check - understands meaning", desc: "Goes beyond keywords: a local language model checks whether your experience actually covers each job requirement, even when worded differently. Still completely free." },
                { v: "ai", title: "AI-powered - your key, your model", desc: "Connect ChatGPT, Claude, Gemini or a local Ollama model with your own API key. Get a written review with strengths, gaps and suggestions. We never charge for it." },
              ].map(({ v, title, desc }) => (
                <TabsContent key={v} value={v}>
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-heading font-semibold">{title}</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{desc}</p>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </motion.div>
        </div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Your data stays yours", desc: "Resumes are stored privately in your account. API keys are encrypted. Delete anything anytime." },
            { icon: Database, title: "Smart caching", desc: "Identical resumes are parsed once and cached, so repeat analyses are instant and waste nothing." },
            { icon: Github, title: "Open-source forever", desc: "The whole app is free to use, self-host and improve. No paywalls, no premium tier, no tricks." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <motion.div key={title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }} className="flex gap-3">
              <Icon className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <motion.h2 {...fadeUp} className="font-heading text-2xl font-semibold sm:text-3xl">
            Ready to see your match score?
          </motion.h2>
          <motion.p {...fadeUp} className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Takes under a minute. Free forever, no card required.
          </motion.p>
          <motion.div {...fadeUp} className="mt-6">
            <Button size="lg" asChild className="gap-2" data-testid="landing-footer-cta-button">
              <Link to={startHref}>Analyze my resume <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </motion.div>
        </div>
        <footer className="border-t py-6 text-center text-xs text-muted-foreground">
          Resume Decoded - free & open-source resume checker and job match analyzer. Built for job seekers, trained by job seekers.
        </footer>
      </section>
    </div>
  );
}
