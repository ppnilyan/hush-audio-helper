import { Link, createFileRoute } from "@tanstack/react-router";
import { Scissors } from "lucide-react";

import { LandingFooter } from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";

const URL = "https://silencecut.app/guide/montage-tiktok";
const TITLE = "Comment faire un montage TikTok sans logiciel (guide 2026)";
const DESCRIPTION =
  "Guide pas à pas pour transformer plusieurs vidéos TikTok en un seul montage vertical HD : blancs coupés, hook, voix off et musique, sans installer de logiciel.";

const STEPS = [
  {
    n: "01",
    title: "Rassemble tes liens TikTok",
    text: "Ouvre les vidéos que tu veux réunir et copie leur lien de partage. Deux liens suffisent pour démarrer, la plupart des montages qui marchent en utilisent trois à six.",
  },
  {
    n: "02",
    title: "Colle les liens dans SilenceCut",
    text: "Chaque lien est vérifié puis téléchargé en qualité d'origine. Un lien invalide est signalé tout de suite, tu n'attends pas la fin pour découvrir une erreur.",
  },
  {
    n: "03",
    title: "Laisse couper les silences",
    text: "Les blancs et les temps morts sont retirés automatiquement. C'est l'étape qui fait la différence entre une vidéo qu'on regarde en entier et une vidéo qu'on scrolle.",
  },
  {
    n: "04",
    title: "Ajoute un hook et des effets",
    text: "Une phrase d'accroche au début et un zoom dynamique sur les premières secondes retiennent l'attention au moment où la majorité des gens partent.",
  },
  {
    n: "05",
    title: "Voix off et musique de fond",
    text: "Importe ta voix off (un MP3 généré par une IA vocale fonctionne très bien) et une musique de fond, dont le volume est baissé automatiquement sous la voix.",
  },
  {
    n: "06",
    title: "Exporte en vertical et publie",
    text: "Tu récupères un fichier MP4 vertical prêt pour TikTok, Reels et Shorts, sans filigrane, à publier directement depuis ton téléphone.",
  },
];

const MISTAKES = [
  {
    title: "Garder les silences",
    text: "Une seconde de vide au mauvais endroit suffit pour perdre le spectateur. Coupe sans pitié.",
  },
  {
    title: "Commencer trop lentement",
    text: "Le début décide de tout : place l'image ou la phrase la plus forte dans la première seconde.",
  },
  {
    title: "Le format horizontal",
    text: "Un montage recadré à la va-vite laisse des bandes noires. Travaille en vertical dès le départ.",
  },
  {
    title: "Une musique trop forte",
    text: "Si la musique couvre la voix, le message passe à la trappe. Garde la musique nettement en dessous.",
  },
];

const FAQ = [
  {
    q: "Faut-il installer un logiciel de montage ?",
    a: "Non. Tout se fait depuis le navigateur, sur ordinateur comme sur téléphone. Tu colles des liens, tu récupères une vidéo.",
  },
  {
    q: "Combien de vidéos peut-on assembler ?",
    a: "À partir de deux liens. Tu peux en ajouter davantage pour construire un montage plus long.",
  },
  {
    q: "La vidéo exportée a-t-elle un filigrane ?",
    a: "Non, la vidéo téléchargée est propre. Le filigrane n'apparaît que dans l'aperçu.",
  },
  {
    q: "Peut-on utiliser une voix off générée par une IA ?",
    a: "Oui, il suffit d'importer le fichier audio. La musique de fond est automatiquement atténuée sous la voix.",
  },
];

export const Route = createFileRoute("/guide/montage-tiktok")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: TITLE,
          description: DESCRIPTION,
          step: STEPS.map((s) => ({
            "@type": "HowToStep",
            name: s.title,
            text: s.text,
          })),
        }),
      },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  return (
    <div>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="gradient-brand flex size-8 items-center justify-center rounded-xl">
              <Scissors className="size-4 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">SilenceCut</span>
          </Link>
          <Button asChild size="sm" className="ml-auto rounded-full">
            <Link to="/auth">Essayer gratuitement</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 flex flex-wrap gap-2">
          <span className="gradient-brand rounded-full border border-transparent px-4 py-1.5 text-sm font-medium text-primary-foreground">
            Guide
          </span>
          <Link
            to="/guide/videos"
            className="rounded-full border border-border/60 px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Guide vidéo
          </Link>
        </div>

        <article>
          <p className="text-sm text-muted-foreground">Guide</p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Comment faire un montage TikTok sans logiciel
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Réunir plusieurs vidéos TikTok en un seul montage vertical demandait jusqu'ici un
            logiciel, du temps et de la patience. Voici la méthode complète pour le faire depuis un
            navigateur, en six étapes, et obtenir une vidéo rythmée prête à publier.
          </p>

          <section className="mt-12">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Les 6 étapes d'un montage qui retient l'attention
            </h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
              {STEPS.map((s) => (
                <li key={s.n} className="card-hover-soft panel p-5">
                  <span className="gradient-brand font-display flex size-12 items-center justify-center rounded-full text-base font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <h3 className="font-display mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-14">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Quatre erreurs qui tuent un montage
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {MISTAKES.map((m) => (
                <div key={m.title} className="card-hover-soft panel p-5">
                  <h3 className="font-display text-base font-semibold">{m.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{m.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-14">
            <h2 className="font-display text-2xl font-bold tracking-tight">Questions fréquentes</h2>
            <dl className="mt-6 grid gap-4">
              {FAQ.map((f) => (
                <div key={f.q} className="card-hover-soft panel p-5">
                  <dt className="font-display text-base font-semibold">{f.q}</dt>
                  <dd className="mt-2 text-sm text-muted-foreground">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel mt-14 p-8 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Fais ton premier montage maintenant
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Colle deux liens TikTok, récupère une vidéo verticale prête à publier.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/auth">Créer mon compte</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-full">
                <Link to="/pricing">Voir les offres</Link>
              </Button>
            </div>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
