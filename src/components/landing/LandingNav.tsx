import { Link } from "@tanstack/react-router";
import { Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/account";
import { LANGS, LANG_META, usePrefs, useTr } from "@/lib/prefs";

const SECTIONS = [
  { hash: "showcase", label: "Exemples de vidéos" },
  { hash: "solution", label: "Notre solution" },
  { hash: "resultats", label: "Résultats" },
  { hash: "offres", label: "Nos offres" },
  { hash: "guide", label: "Guide vidéo", to: "/guide/videos" },
  { hash: "faq", label: "FAQ" },
] as const;


export function LandingNav() {
  const tr = useTr();
  const { lang, setLang } = usePrefs();
  const session = useSession();
  const isSignedIn = Boolean(session);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <a href="#top" className="flex items-center gap-2">
          <span className="gradient-brand flex size-8 items-center justify-center rounded-xl">
            <Scissors className="size-4 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">SilenceCut</span>
        </a>

        <div className="ml-2 hidden items-center gap-1 md:flex">
          {isSignedIn && (
            <Link
              to="/montage"
              search={{ tab: "editor" }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            >
              {tr("Montage")}
            </Link>
          )}
          {SECTIONS.map((s) =>
            "to" in s ? (
              <Link
                key={s.hash}
                to={s.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                {tr(s.label)}
              </Link>
            ) : (
              <a
                key={s.hash}
                href={`#${s.hash}`}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
              >
                {s.label === "FAQ" ? "FAQ" : tr(s.label)}
              </a>
            )
          )}
        </div>

        {/* Version mobile compacte : les entrées essentielles seulement. */}
        <div className="ml-1 flex items-center gap-1 md:hidden">
          <Link
            to="/guide/videos"
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {tr("Exemples")}
          </Link>
          <a
            href="#offres"
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {tr("Nos offres")}
          </a>
        </div>



        <div className="ml-auto flex items-center gap-2">
          {!isSignedIn && (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">{tr("Connexion")}</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/auth">{tr("Inscription")}</Link>
              </Button>
            </>
          )}
          {isSignedIn && (
            <Button asChild size="sm" className="rounded-full hidden sm:inline-flex">
              <Link to="/montage" search={{ tab: "editor" }}>
                {tr("Passer au montage")}
              </Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="rounded-full">
                <span aria-hidden>{LANG_META[lang].flag}</span> {LANG_META[lang].label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LANGS.map((l) => (
                <DropdownMenuItem key={l} onSelect={() => setLang(l)}>
                  <span aria-hidden>{LANG_META[l].flag}</span> {LANG_META[l].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </header>
  );
}
