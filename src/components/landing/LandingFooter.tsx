import { Link } from "@tanstack/react-router";

import { useTr } from "@/lib/prefs";

export function LandingFooter() {
  const tr = useTr();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display font-semibold">SilenceCut</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr("Montage vertical automatisé pour les créateurs.")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            © {year} SilenceCut — {tr("Tous droits réservés.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/guide/montage-tiktok" className="hover:text-foreground">
            {tr("Guide du montage TikTok")}
          </Link>
          <Link to="/auth" className="hover:text-foreground">
            {tr("Connexion")}
          </Link>

          <a href="#offres" className="hover:text-foreground">
            {tr("Nos offres")}
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </div>
      </div>
    </footer>
  );
}
