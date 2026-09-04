import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useTr } from "@/lib/prefs";

const STEPS = [
  {
    n: "01",
    title: "Colle tes liens",
    text: "Ajoute les liens de tes vidéos préférées : chacun se télécharge en HD automatiquement.",
  },
  {
    n: "02",
    title: "Personnalise",
    text: "Voix off, musique de fond, hook d'accroche, durées et effets : tout est réglable, ou laissé en automatique.",
  },
  {
    n: "03",
    title: "Récupère ta vidéo",
    text: "Le montage se génère tout seul et reste disponible 5 heures dans ton historique.",
  },
];

export function SolutionSteps() {
  const tr = useTr();

  return (
    <section id="solution" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight">
          {tr("Notre solution")}
        </h2>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {tr("Trois étapes, aucun logiciel de montage")}
        </p>

        <div className="relative mt-12">
          <div
            className="absolute top-8 right-8 left-8 hidden h-px md:block"
            style={{ backgroundImage: "var(--gradient-brand)", opacity: 0.4 }}
          />
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="gradient-brand font-display relative z-10 flex size-16 items-center justify-center rounded-full text-lg font-bold text-primary-foreground">
                  {s.n}
                </span>
                <h3 className="font-display mt-5 text-lg font-semibold">{tr(s.title)}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{tr(s.text)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/auth">{tr("Crée ton compte")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
