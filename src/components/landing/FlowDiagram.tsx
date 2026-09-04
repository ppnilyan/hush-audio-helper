import { Film, Scissors, Sparkles } from "lucide-react";

import { useTr } from "@/lib/prefs";

export function FlowDiagram() {
  const tr = useTr();

  const cards = [
    { icon: Film, title: "Tes clips", text: "Plusieurs liens TikTok collés en quelques secondes." },
    {
      icon: Scissors,
      title: "SilenceCut",
      text: "Coupe des blancs, hook, effets, voix off et musique.",
      center: true,
    },
    {
      icon: Sparkles,
      title: "Ton montage prêt",
      text: "Une vidéo verticale HD, prête à publier.",
    },
  ];

  return (
    <section id="resultats" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight">
          {tr("Résultats")}
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map(({ icon: Icon, title, text, center }) => (
            <div
              key={title}
              className={`panel flex flex-col items-center gap-3 p-6 text-center ${
                center ? "border-primary/40" : ""
              }`}
            >
              <span
                className={`flex size-14 items-center justify-center rounded-full ${
                  center ? "gradient-brand" : "bg-secondary"
                }`}
                style={center ? { boxShadow: "var(--shadow-glow)" } : undefined}
              >
                <Icon
                  className={`size-6 ${center ? "text-primary-foreground" : "text-primary"}`}
                />
              </span>
              <h3 className="font-display text-base font-semibold">
                {title === "SilenceCut" ? "SilenceCut" : tr(title)}
              </h3>
              <p className="text-sm text-muted-foreground">{tr(text)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
