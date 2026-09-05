import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, Scissors, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { LandingFooter } from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/account";
import {
  deleteGuideVideo,
  isAdminAccount,
  listGuideVideos,
  uploadGuideVideo,
  type GuideCategory,
  type GuideVideo,
} from "@/lib/guide-videos";

const URL_CANONICAL = "https://silencecut.app/guide/videos";
const TITLE = "Guide vidéo — montages TikTok avec SilenceCut";
const DESCRIPTION =
  "Regarde en vidéo comment faire un montage TikTok avec SilenceCut, puis des exemples de vidéos générées avec l'outil.";

export const Route = createFileRoute("/guide/videos")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL_CANONICAL }],
  }),
  component: GuideVideosPage,
});

function GuideTabs({ active }: { active: "text" | "video" }) {
  const base =
    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors border border-border/60";
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        to="/guide/montage-tiktok"
        className={
          active === "text"
            ? `${base} gradient-brand text-primary-foreground border-transparent`
            : `${base} text-muted-foreground hover:text-foreground`
        }
      >
        Guide
      </Link>
      <Link
        to="/guide/videos"
        className={
          active === "video"
            ? `${base} gradient-brand text-primary-foreground border-transparent`
            : `${base} text-muted-foreground hover:text-foreground`
        }
      >
        Guide vidéo
      </Link>
    </div>
  );
}

function VideoGrid({
  videos,
  isAdmin,
  onDeleted,
  empty,
}: {
  videos: GuideVideo[];
  isAdmin: boolean;
  onDeleted: () => void;
  empty: string;
}) {
  if (videos.length === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (
        <figure key={v.id} className="card-hover-soft panel overflow-hidden p-3">
          <video
            src={v.url}
            controls
            playsInline
            preload="metadata"
            className="aspect-[9/16] w-full rounded-lg bg-muted object-contain"
          />
          <figcaption className="mt-3">
            <p className="font-display text-base font-semibold">{v.title}</p>
            {v.description && (
              <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>
            )}
          </figcaption>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-destructive"
              onClick={async () => {
                try {
                  await deleteGuideVideo({ id: v.id, storagePath: v.storagePath });
                  toast.success("Vidéo supprimée");
                  onDeleted();
                } catch {
                  toast.error("Suppression impossible");
                }
              }}
            >
              <Trash2 className="size-4" /> Supprimer
            </Button>
          )}
        </figure>
      ))}
    </div>
  );
}

function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const [category, setCategory] = useState<GuideCategory>("tutorial");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choisis un fichier vidéo");
      return;
    }
    setBusy(true);
    try {
      await uploadGuideVideo({ file, title, description, category });
      toast.success("Vidéo publiée sur le site");
      setTitle("");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    } catch (e) {
      toast.error(`Envoi impossible : ${e instanceof Error ? e.message : "erreur"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel mt-8 p-6">
      <h2 className="font-display text-lg font-bold">Déposer une vidéo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Visible uniquement par ton compte administrateur.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["tutorial", "Tutoriel"],
            ["showcase", "Exemple de vidéo générée"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={category === value ? "default" : "secondary"}
            className="rounded-full"
            onClick={() => setCategory(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la vidéo"
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Courte description (optionnelle)"
          rows={2}
        />
        <input ref={inputRef} type="file" accept="video/*" className="text-sm" />
        <Button onClick={submit} disabled={busy} className="rounded-full sm:w-fit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Publier la vidéo
        </Button>
      </div>
    </section>
  );
}

function GuideVideosPage() {
  const session = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [videos, setVideos] = useState<GuideVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    void listGuideVideos()
      .then(setVideos)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    void isAdminAccount().then(setIsAdmin);
  }, [session]);

  const tutorials = videos.filter((v) => v.category === "tutorial");
  const showcase = videos.filter((v) => v.category === "showcase");

  return (
    <div>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
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

      <main className="mx-auto max-w-5xl px-4 py-12">
        <GuideTabs active="video" />
        <h1 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          Guide vidéo
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Les vidéos publiées par SilenceCut : d'abord la méthode en images, ensuite des montages
          réellement générés avec l'outil.
        </p>

        {isAdmin && <UploadCard onUploaded={refresh} />}

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Comment faire un montage TikTok avec SilenceCut
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <VideoGrid
              videos={tutorials}
              isAdmin={isAdmin}
              onDeleted={refresh}
              empty="Les vidéos du tutoriel arrivent très bientôt."
            />
          )}
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Exemples de vidéos générées avec SilenceCut
          </h2>
          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
          ) : (
            <VideoGrid
              videos={showcase}
              isAdmin={isAdmin}
              onDeleted={refresh}
              empty="Les premiers exemples arrivent très bientôt."
            />
          )}
        </section>

        <section className="panel mt-14 p-8 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">À toi de jouer</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Colle deux liens TikTok et récupère une vidéo verticale prête à publier.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/auth">Créer mon compte</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-full">
              <Link to="/guide/montage-tiktok">Lire le guide écrit</Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
