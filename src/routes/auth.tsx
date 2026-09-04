import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/account";
import { useTr } from "@/lib/prefs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — SilenceCut" },
      {
        name: "description",
        content:
          "Connectez-vous pour retrouver vos presets, vos derniers réglages de montage et votre historique.",
      },
      { property: "og:title", content: "Connexion — SilenceCut" },
      {
        property: "og:description",
        content: "Presets, réglages et historique sauvegardés sur votre compte SilenceCut.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const tr = useTr();
  const session = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (session) void navigate({ to: "/montage", search: { tab: "editor" } });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        setInfo(tr("Compte créé. Vérifiez votre boîte mail si une confirmation est demandée."));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Connexion impossible."));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      const detail = result.error instanceof Error ? result.error.message : String(result.error);
      setError(`${tr("Connexion Google impossible.")} ${detail}`.trim());
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/montage", search: { tab: "editor" } });
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {mode === "signin" ? tr("Se connecter") : tr("Créer un compte")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {tr("Vos presets, vos derniers réglages et votre historique sont sauvegardés sur votre compte.")}
      </p>

      <form onSubmit={submit} className="panel mt-6 space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="email">{tr("E-mail")}</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{tr("Mot de passe")}</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "signin" ? tr("Se connecter") : tr("Créer mon compte")}
        </Button>
        <Button type="button" variant="secondary" className="w-full" onClick={() => void google()}>
          {tr("Continuer avec Google")}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {info && <p className="text-sm text-primary">{info}</p>}
        <button
          type="button"
          className="w-full text-xs text-muted-foreground hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? tr("Pas encore de compte ? Créer un compte") : tr("J'ai déjà un compte")}
        </button>
      </form>
    </main>
  );
}
