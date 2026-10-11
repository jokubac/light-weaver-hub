import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { oauthReturnPath } from "@/lib/oauth-return-path";

const NEXT_KEY = "crmx-login-next";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — CRMX Console" },
      { name: "description", content: "Sign in to your private CRMX lighting console." },
      { property: "og:title", content: "Sign in — CRMX Console" },
      { property: "og:description", content: "Private access to your lighting projects and scenes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { next: rawNext } = Route.useSearch();
  const next = oauthReturnPath(rawNext ?? "/");
  const navigate = useNavigate();
  const { session, ready } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) {
      const stored = oauthReturnPath(sessionStorage.getItem(NEXT_KEY) ?? next);
      sessionStorage.removeItem(NEXT_KEY);
      window.location.assign(stored);
    }
  }, [ready, session, next, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
      else window.location.assign(next);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: new URL(next, window.location.origin).href },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Check your email to confirm the account, then sign in.");
    }
    setBusy(false);
  };

  const google = async () => {
    sessionStorage.setItem(NEXT_KEY, next);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/login" });
    if (r.error) setMsg(r.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">CRMX Console</h1>
          <p className="text-sm text-muted-foreground">{mode === "in" ? "Sign in to your console" : "Create your account"}</p>
        </div>
        <button onClick={google} className="w-full rounded-lg bg-surface-elevated py-3 text-sm font-semibold active:scale-95">Continue with Google</button>
        <div className="text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-input bg-surface-elevated px-4 py-3 text-sm outline-none focus:border-primary" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-input bg-surface-elevated px-4 py-3 text-sm outline-none focus:border-primary" />
          <button disabled={busy} className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        {msg && <p className="text-xs text-destructive">{msg}</p>}
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-xs text-muted-foreground">
          {mode === "in" ? "No account yet? Create one" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
