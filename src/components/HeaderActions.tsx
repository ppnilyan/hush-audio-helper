import { Link, useNavigate } from "@tanstack/react-router";
import { Coins, HelpCircle, Lock, Settings, User } from "lucide-react";
import { useState } from "react";

import { AdminFaqSection } from "@/components/AdminFaqSection";
import { AdminPromoSection } from "@/components/AdminPromoSection";
import { Faq } from "@/components/landing/Faq";
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
import { useBilling } from "@/lib/billing";
import {
  LANGS,
  LANG_META,
  THEMES,
  THEME_LABEL_KEYS,
  THEME_SWATCH,
  usePrefs,
} from "@/lib/prefs";

export function HeaderActions() {
  const session = useSession();
  const { t, theme, setTheme, lang, setLang } = usePrefs();
  const { advanced, setAdvanced } = useAdvanced();
  const billing = useBilling();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);

  const goPricing = () => {
    setOpen(false);
    void navigate({ to: "/pricing" });
  };

  const planName = billing.state?.plan?.name ?? null;

  return (
    <div className="ml-auto flex items-center gap-2">
      {session && billing.state && (
        <Link
          to="/pricing"
          className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          title={lang === "fr" ? "Crédits disponibles" : "Available credits"}
        >
          <Coins className="size-3.5 text-primary" />
          <span>{billing.totalCredits}</span>
          {planName && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
              {planName}
            </span>
          )}
        </Link>
      )}

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
              <DropdownMenuItem asChild>
                <Link to="/account">{lang === "fr" ? "Mon abonnement" : "My subscription"}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/pricing">{lang === "fr" ? "Tarifs & crédits" : "Pricing & credits"}</Link>
              </DropdownMenuItem>
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
              <DropdownMenuItem asChild>
                <Link to="/pricing">{lang === "fr" ? "Tarifs & crédits" : "Pricing & credits"}</Link>
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
                {THEMES.map((id) => {
                  const locked = id !== "aurora" && !billing.can.allThemes;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => (locked ? goPricing() : setTheme(id))}
                      aria-pressed={theme === id}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                        theme === id
                          ? "border-primary bg-secondary text-foreground"
                          : "border-border hover:bg-accent/10"
                      } ${locked ? "opacity-60" : ""}`}
                    >
                      <span
                        className="size-8 shrink-0 rounded-full"
                        style={{ backgroundImage: THEME_SWATCH[id] }}
                      />
                      <span className="flex-1">{t(THEME_LABEL_KEYS[id])}</span>
                      {locked && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          <Lock className="size-3" /> Pro
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium">{t("language")}</h3>
              <div className="flex gap-2">
                {LANGS.map((l) => (
                  <Button
                    key={l}
                    type="button"
                    size="sm"
                    variant={lang === l ? "default" : "secondary"}
                    onClick={() => setLang(l)}
                  >
                    <span aria-hidden>{LANG_META[l].flag}</span> {LANG_META[l].label}
                  </Button>
                ))}
              </div>
            </section>

            <section className="flex items-center justify-between gap-4 rounded-xl border border-border p-3">
              <div>
                <Label htmlFor="advanced-mode" className="text-sm font-medium">
                  {lang === "fr" ? "Options avancées" : "Advanced options"}
                  {!billing.can.advanced && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      <Lock className="size-3" /> Pro
                    </span>
                  )}
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {billing.can.advanced
                    ? lang === "fr"
                      ? "Affiche tous les réglages du montage (durées, effets, détection des blancs, volume)."
                      : "Show every editing setting (durations, effects, silence detection, volume)."
                    : lang === "fr"
                      ? "Disponible avec les formules Pro et Elite."
                      : "Available with the Pro and Elite plans."}
                </p>
              </div>
              {billing.can.advanced ? (
                <Switch id="advanced-mode" checked={advanced} onCheckedChange={setAdvanced} />
              ) : (
                <Button id="advanced-mode" size="sm" variant="secondary" onClick={goPricing}>
                  {lang === "fr" ? "Débloquer" : "Unlock"}
                </Button>
              )}
            </section>

            {billing.state?.isAdmin && <AdminPromoSection />}
            {billing.state?.isAdmin && <AdminFaqSection />}
          </div>

        </DialogContent>
      </Dialog>

      <Dialog open={faqOpen} onOpenChange={setFaqOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="rounded-full">
            <HelpCircle className="size-4" />
            <span className="hidden sm:inline">{t("faq")}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("faq")}</DialogTitle>
            <DialogDescription>{t("faqDesc")}</DialogDescription>
          </DialogHeader>
          <Faq />
        </DialogContent>
      </Dialog>
    </div>
  );
}
