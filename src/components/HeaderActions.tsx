import { Link } from "@tanstack/react-router";
import { Settings, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/account";
import { useAdvanced } from "@/lib/advanced-mode";
import {
  THEMES,
  THEME_LABEL_KEYS,
  THEME_SWATCH,
  usePrefs,
  type Lang,
} from "@/lib/prefs";

export function HeaderActions() {
  const session = useSession();
  const { t, theme, setTheme, lang, setLang } = usePrefs();
  const { advanced, setAdvanced } = useAdvanced();
  const [open, setOpen] = useState(false);

  return (
    <div className="ml-auto flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="rounded-full">
            <User className="size-4" />
            <span className="hidden sm:inline">{t("account")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {session ? (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t("signedInAs")}
                <div className="truncate text-sm text-foreground">{session.user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void supabase.auth.signOut()}>
                {t("signOut")}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t("notSignedIn")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/auth">{t("signIn")}</Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="rounded-full">
            <Settings className="size-4" />
            <span className="hidden sm:inline">{t("settings")}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("settings")}</DialogTitle>
            <DialogDescription>{t("settingsDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-medium">{t("appTheme")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {THEMES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    aria-pressed={theme === id}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                      theme === id
                        ? "border-primary bg-secondary text-foreground"
                        : "border-border hover:bg-accent/10"
                    }`}
                  >
                    <span
                      className="size-8 shrink-0 rounded-full"
                      style={{ backgroundImage: THEME_SWATCH[id] }}
                    />
                    <span>{t(THEME_LABEL_KEYS[id])}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium">{t("language")}</h3>
              <div className="flex gap-2">
                {(["fr", "en"] as Lang[]).map((l) => (
                  <Button
                    key={l}
                    type="button"
                    size="sm"
                    variant={lang === l ? "default" : "secondary"}
                    onClick={() => setLang(l)}
                  >
                    {l === "fr" ? t("french") : t("english")}
                  </Button>
                ))}
              </div>
            </section>

            <section className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div>
                <Label htmlFor="advanced-mode" className="text-sm font-medium">
                  {lang === "fr" ? "Options avancées" : "Advanced options"}
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "fr"
                    ? "Affiche tous les réglages du montage (durées, effets, détection des blancs, volume)."
                    : "Show every editing setting (durations, effects, silence detection, volume)."}
                </p>
              </div>
              <Switch id="advanced-mode" checked={advanced} onCheckedChange={setAdvanced} />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
