import { ArrowRight, Check, Coins, Timer, X } from "lucide-react";

import { useTr } from "@/lib/prefs";

const BEFORE = [
  "Des heures passées à découper à la main",
  "Des vidéos brutes que la plateforme ne récompense pas",
  "Une publication par semaine, quand tu trouves le temps",
];

const AFTER = [
  "Un montage vertical prêt en quelques minutes",
  "Une vidéo transformée, éligible aux récompenses TikTok",
  "Plusieurs publications par jour, sans y penser",
];

const STATS = [
  { icon: Timer, value: "≈ 3 min", label: "pour un montage complet" },
  { icon: Coins, value: "10 crédits", label: "= une vidéo prête à publier" },
  { icon: ArrowRight, value: "2 liens", label: "suffisent pour commencer" },
];

export function FlowDiagram() {
  const tr = useTr();

  return (
    <section id="resultats" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight">
          {tr("Résultats")}
        </h2>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {tr("Ce qui change concrètement avant et après SilenceCut")}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="card-hover-soft panel p-6">
            <h3 className="font-display text-lg font-semibold text-muted-foreground">
              {tr("Avant")}
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {BEFORE.map((item) => (
                <li key={item} className="flex gap-2">
                  <X className="mt-0.5 size-4 shrink-0" />
                  <span>{tr(item)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-hover-soft panel-glow p-6">
            <h3 className="font-display gradient-text text-lg font-semibold">{tr("Après")}</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {AFTER.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{tr(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="card-hover-soft panel flex items-center gap-3 p-5">
              <span
                className="gradient-brand flex size-10 shrink-0 items-center justify-center rounded-full"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                <Icon className="size-4 text-primary-foreground" />
              </span>
              <div>
                <p className="font-display text-base font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{tr(label)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
