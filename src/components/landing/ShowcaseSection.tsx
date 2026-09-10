import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listGuideVideosByCategory, type GuideVideo } from "@/lib/guide-videos";
import { useTr } from "@/lib/prefs";

export function ShowcaseSection() {
  const tr = useTr();
  const [videos, setVideos] = useState<GuideVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void listGuideVideosByCategory("showcase").then((data) => {
      if (!mounted) return;
      setVideos(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const hasVideos = videos.length > 0;

  return (
    <section id="showcase" className="relative overflow-hidden px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">{tr("Avant / Après SilenceCut")}</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {tr("Des montages publiés, pas promis")}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              {tr(
                "Ces vidéos verticales ont été générées automatiquement à partir de liens TikTok. Pas de logiciel, pas d'heures de découpe.",
              )}
            </p>
          </div>
          <Button
            asChild
            variant="secondary"
            className="w-full rounded-full md:w-auto"
          >
            <Link to="/guide/videos">
              {tr("Voir tous les exemples")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {tr("Chargement des exemples…")}
          </div>
        ) : hasVideos ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {videos.slice(0, 6).map((video) => (
              <figure
                key={video.id}
                className="card-hover-soft panel group cursor-pointer overflow-hidden p-3"
              >
                <Link to="/guide/videos" className="relative block overflow-hidden rounded-xl">
                  <video
                    src={video.url}
                    preload="metadata"
                    playsInline
                    muted
                    className="aspect-[9/16] w-full rounded-lg bg-muted object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-background/70 backdrop-blur transition-transform duration-300 group-hover:scale-110">
                      <Play className="size-5 text-primary fill-current" />
                    </span>
                  </span>
                </Link>
                <figcaption className="mt-3 px-1">
                  <p className="font-display text-base font-semibold">{video.title}</p>
                  {video.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {video.description}
                    </p>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="card-hover-soft panel mt-10 p-8 text-center">
            <p className="font-display text-lg font-semibold">
              {tr("Les premiers exemples arrivent très bientôt")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {tr(
                "En attendant, crée ton premier montage avec les 10 crédits offerts à l'inscription.",
              )}
            </p>
            <div className="mt-5">
              <Button asChild className="rounded-full">
                <Link to="/auth">{tr("Créer mon compte")}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
