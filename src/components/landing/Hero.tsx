import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Link2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPendingLinks } from "@/lib/clips-store";
import { useTr } from "@/lib/prefs";

export function Hero() {
  const tr = useTr();
  const navigate = useNavigate();
  const [links, setLinks] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  function start() {
    const clean = links.map((l) => l.trim()).filter(Boolean);
    if (clean.length === 0) {
      setError(tr("Ajoute au moins un lien pour commencer."));
      return;
    }
    setPendingLinks(clean);
    void navigate({ to: "/auth" });
  }

  return (
    <section id="top" className="relative overflow-hidden px-4 pt-14 pb-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl leading-tight font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {tr("Crée des montages qui")} <span className="gradient-text">{tr("percent")}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          {tr("Colle tes liens, récupère un TikTok monétisable en quelques minutes.")}
        </p>

        <div className="card-hover panel-glow mx-auto mt-8 max-w-xl p-6 text-left">
          <h2 className="font-display text-lg font-semibold">{tr("Teste maintenant")}</h2>
          <div className="mt-4 space-y-3">
            {links.map((value, i) => (
              <div key={i} className="relative">
                <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={value}
                  onChange={(e) => {
                    const next = [...links];
                    next[i] = e.target.value;
                    setLinks(next);
                    setError(null);
                  }}
                  placeholder={
                    i === 0
                      ? tr("Colle le lien de ta première vidéo")
                      : tr("Colle un deuxième lien")
                  }
                  className="pl-9"
                  inputMode="url"
                />
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full rounded-full" onClick={start}>
            {tr("Commencer gratuitement")} <ArrowRight className="size-4" />
          </Button>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          {tr(
            "10 crédits offerts à l'inscription, soit une vidéo d'essai. Aucune carte bancaire demandée.",
          )}
        </p>
      </div>
    </section>
  );
}
