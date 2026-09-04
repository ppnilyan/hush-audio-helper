import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CREDITS_PER_VIDEO, PLANS, formatEuro, type PlanDef } from "@/lib/billing";
import { useLocale, useTr } from "@/lib/prefs";

function features(plan: PlanDef) {
  return [
    { ok: true, label: "Montage automatique complet (mode simple)" },
    { ok: true, label: "Musique incluse « Mysterious and Sad »" },
    { ok: plan.allowImportMusic, label: "Importer ma propre musique" },
    {
      ok: plan.allowAllThemes,
      label: plan.allowAllThemes ? "Tous les thèmes de l'application" : "Thème Aurora uniquement",
    },
    {
      ok: plan.allowAdvanced,
      label: "Options avancées (durées, effets, détection des blancs, volume)",
    },
  ];
}

export function PlansSection() {
  const tr = useTr();
  const locale = useLocale();

  return (
    <section id="offres" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight">
          {tr("Nos offres")}
        </h2>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {tr("Choisis ton rythme de publication")}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`${plan.highlight ? "panel-glow" : "panel"} card-hover-soft flex flex-col p-6`}
            >

              {plan.highlight && (
                <span className="mb-3 self-start rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold tracking-wide text-primary uppercase">
                  {tr("Le plus choisi")}
                </span>
              )}
              <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-4xl font-bold">
                  {formatEuro(plan.priceCents, locale)}
                </span>
                <span className="text-sm text-muted-foreground">/ {tr("mois")}</span>
              </p>
              <p className="mt-2 text-sm text-primary">
                {plan.monthlyCredits} {tr("crédits / mois")} ·{" "}
                {Math.floor(plan.monthlyCredits / CREDITS_PER_VIDEO)} {tr("vidéos / mois")}
              </p>

              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {features(plan).map((f) => (
                  <li key={f.label} className="flex gap-2">
                    {f.ok ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={f.ok ? "" : "text-muted-foreground"}>{tr(f.label)}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-6 w-full rounded-full"
                variant={plan.highlight ? "default" : "secondary"}
              >
                <Link to="/auth">{tr("Crée ton compte")}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
