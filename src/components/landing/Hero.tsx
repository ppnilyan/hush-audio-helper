import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Link2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPendingLinks } from "@/lib/clips-store";
import { useTr } from "@/lib/prefs";

function looksLikeTikTokUrl(value: string) {
  if (!value.trim()) return false;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "tiktok.com" || host === "vm.tiktok.com";
  } catch {
    return false;
  }
}

export function Hero() {
  const tr = useTr();
  const navigate = useNavigate();
  const [links, setLinks] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  const statuses = useMemo(
    () => links.map((value) => ({ valid: looksLikeTikTokUrl(value), value })),
    [links],
  );

  const hasValidLink = statuses.some((s) => s.valid);

  function start() {
    const validLinks = links
      .map((l) => l.trim())
      .filter((l) => looksLikeTikTokUrl(l));
    if (validLinks.length === 0) {
      setError(tr("Ajoute au moins un lien TikTok valide pour commencer."));
      return;
    }
    setPendingLinks(validLinks);
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
            {links.map((value, i) => {
              const status = statuses[i];
              const dirty = value.trim().length > 0;
              return (
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
                    className="pl-9 pr-9"
                    inputMode="url"
                  />
                  {dirty && (
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                      {status.valid ? (
                        <Check className="size-4 text-green" />
                      ) : (
                        <X className="size-4 text-destructive" />
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <Button
            className="mt-4 w-full rounded-full"
            onClick={start}
            disabled={!hasValidLink}
          >
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
