import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { NoxLogo } from "@/components/NoxLogo";
import { APP_VERSION } from "@/lib/app-version";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NOX" },
      { name: "description", content: "Sign in to keep your lighting projects, favourites and saved effects on every device." },
      { property: "og:title", content: "Sign in — NOX" },
      { property: "og:description", content: "Your projects, favourites and effects, synced to your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (mode === "up") return setMsg("Check your email to confirm the account, then sign in.");
    void nav({ to: "/" });
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg(r.error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-6">
        <div>
          <div className="flex justify-center">
            <NoxLogo className="h-32 w-32 drop-shadow-lg" title="NOX" />
            <h1 className="sr-only">NOX</h1>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to open your projects, favourites and saved effects on any device.</p>
        </div>
        <button onClick={google} className="w-full rounded-lg bg-surface-elevated py-3 text-sm font-semibold active:scale-95">Continue with Google</button>
        <div className="text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-input bg-surface-elevated px-4 py-3 text-sm outline-none focus:border-primary" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-input bg-surface-elevated px-4 py-3 text-sm outline-none focus:border-primary" />
          <button disabled={busy} className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-95 disabled:opacity-50">{mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        {msg && <p className="text-sm text-primary">{msg}</p>}
        <div className="flex justify-between text-xs">
          <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="text-primary">{mode === "in" ? "Create an account" : "I have an account"}</button>
          <button onClick={() => nav({ to: "/" })} className="text-muted-foreground">Continue without account</button>
        </div>
        <p className="text-center font-mono text-xs text-muted-foreground">NOX v{APP_VERSION}</p>
      </div>
    </div>
  );
}
