import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { FileCheck2, Loader2 } from "lucide-react";

export const GoogleButton = ({ onCredential }) => {
  const divRef = useRef(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get("/auth/config").then(({ data }) => {
      if (cancelled || !data.google_enabled) return;
      setEnabled(true);
      const init = () => {
        window.google.accounts.id.initialize({
          client_id: data.google_client_id,
          callback: (resp) => onCredential(resp.credential),
        });
        if (divRef.current) {
          window.google.accounts.id.renderButton(divRef.current, { theme: "outline", size: "large", width: 320 });
        }
      };
      if (window.google?.accounts?.id) init();
      else {
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = init;
        document.head.appendChild(s);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [onCredential]);

  if (!enabled) return null;
  return (
    <>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
      <div ref={divRef} className="flex justify-center" data-testid="auth-google-button" />
    </>
  );
};

export const AuthLayout = ({ title, subtitle, children }) => (
  <div className="grid min-h-screen lg:grid-cols-2">
    <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
      <Link to="/" className="flex items-center gap-2" data-testid="auth-brand-link">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/15">
          <FileCheck2 className="h-4 w-4" />
        </span>
        <span className="font-heading text-lg font-semibold">Resume Decoded</span>
      </Link>
      <div>
        <h2 className="font-heading text-3xl font-semibold leading-tight">
          Free forever.<br />Trained by real people.<br />No subscriptions.
        </h2>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/80">
          Analyze your resume against any job description with our free in-house engine,
          or plug in your own AI key. Your data stays private.
        </p>
      </div>
      <p className="text-xs text-primary-foreground/60">Open-source - self-host it anytime.</p>
    </div>
    <div className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <Card className="mt-6">
          <CardContent className="space-y-4 p-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  </div>
);

export default function Login() {
  usePageSEO("Log in", "Log in to Resume Decoded - the free, open-source resume checker and job match analyzer.");
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(errMsg(err, "Login failed."));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async (credential) => {
    try {
      await googleLogin(credential);
      navigate("/dashboard");
    } catch (err) {
      toast.error(errMsg(err, "Google sign-in failed."));
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your account.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" data-testid="auth-login-email-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password" data-testid="auth-login-password-input" />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={busy} data-testid="auth-login-submit-button">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in
        </Button>
      </form>
      <GoogleButton onCredential={handleGoogle} />
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="font-medium text-primary hover:underline" data-testid="auth-goto-register-link">
          Create a free account
        </Link>
      </p>
    </AuthLayout>
  );
}
