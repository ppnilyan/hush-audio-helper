import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Scissors } from "lucide-react";

import { LandingFooter } from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";

const URL = "https://silencecut.app/tiktok";
const TITLE = "Le montage vu dans la vidéo — SilenceCut";
const DESCRIPTION =
  "Tu viens de TikTok ? Colle deux liens, récupère un montage vertical HD sans silences, avec hook, voix off et musique. Sans logiciel, sans filigrane.";

const POINTS = [
  "Les silences et les temps morts sont coupés automatiquement",
  "Hook d'accroche et zoom dynamique sur les premières secondes",
  "Voix off importée et musique de fond atténuée sous la voix",
  "Export vertical HD, sans filigrane, depuis le téléphone",
];

export const Route = createFileRoute("/tiktok")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: TiktokLanding,
});

function TiktokLanding() {
  return (
    <div>
      <header className="border-b border-border/60">
        <nav className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="gradient-brand flex size-8 items-center justify-center rounded-xl">
              <Scissors className="size-4 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">SilenceCut</span>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Le montage que tu viens de voir, en deux liens
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Colle les liens de tes vidéos TikTok préférées. SilenceCut coupe les blancs, ajoute un
          hook, ta voix off et une musique, puis te rend une vidéo verticale prête à publier.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/auth">Faire mon montage</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-full">
            <Link to="/pricing">Voir les offres</Link>
          </Button>
        </div>

        <ul className="mt-10 grid gap-3">
          {POINTS.map((p) => (
            <li key={p} className="card-hover-soft panel flex items-start gap-3 p-4">
              <Check className="mt-0.5 size-5 text-primary" aria-hidden />
              <span className="text-sm">{p}</span>
            </li>
          ))}
        </ul>

        <div className="panel mt-10 p-6">
          <h2 className="font-display text-lg font-semibold">Première fois ici ?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Le guide complet explique la méthode étape par étape, avec les erreurs à éviter.
          </p>
          <Button asChild variant="ghost" className="mt-4 rounded-full px-0">
            <Link to="/guide/montage-tiktok">Lire le guide du montage TikTok →</Link>
          </Button>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
