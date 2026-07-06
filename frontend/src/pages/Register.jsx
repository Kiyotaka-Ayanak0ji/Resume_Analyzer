import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { usePageSEO } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthLayout, GoogleButton } from "./Login";

export default function Register() {
  usePageSEO("Create a free account", "Sign up free for Resume Decoded and check how well your resume matches any job description. No card, no subscription.");
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await register(name, email, password);
      toast.success("Welcome! Your free account is ready.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(errMsg(err, "Registration failed."));
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
    <AuthLayout title="Create your free account" subtitle="No card, no subscription - just sign up.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Your name" data-testid="auth-register-name-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" data-testid="auth-register-email-input" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters" data-testid="auth-register-password-input" />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={busy} data-testid="auth-register-submit-button">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
        </Button>
      </form>
      <GoogleButton onCredential={handleGoogle} />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline" data-testid="auth-goto-login-link">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
