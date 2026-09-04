import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Coins, Lock, Sparkles, Tag, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CREDITS_PER_VIDEO,
  PACKS,
  PLANS,
  formatEuro,
  packPrice,
  useBilling,
  useInvalidateBilling,
  type PlanDef,
} from "@/lib/billing";
import { fakeBuyPack, fakeSubscribe, lookupPromoCode } from "@/lib/billing.functions";
import { useLocale, useTr } from "@/lib/prefs";


export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Tarifs & crédits — SilenceCut" },
      {
        name: "description",
        content:
          "Abonnements Starter, Pro et Elite : 300 à 1 500 crédits par mois pour générer vos montages verticaux. Packs de crédits à l'unité.",
      },
      { property: "og:title", content: "Tarifs & crédits — SilenceCut" },
      {
        property: "og:description",
        content: "Choisissez une formule mensuelle ou rechargez des crédits. 10 crédits = 1 vidéo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function planFeatures(p: PlanDef, tr: (s: string) => string) {
  const list: { ok: boolean; label: string }[] = [
    { ok: true, label: `${p.monthlyCredits} ${tr("crédits / mois")} · ${p.monthlyCredits / CREDITS_PER_VIDEO} ${tr("vidéos")}` },
    { ok: true, label: tr("Montage automatique complet (mode simple)") },
    { ok: true, label: tr("Musique incluse « Mysterious and Sad »") },
    { ok: p.allowImportMusic, label: tr("Importer ma propre musique") },
    { ok: true, label: p.allowAllThemes ? tr("Tous les thèmes de l'application") : tr("Thème Aurora uniquement") },
    { ok: p.allowAdvanced, label: tr("Options avancées (durées, effets, détection des blancs, volume)") },
    { ok: true, label: `−20 % ${tr("sur les packs de crédits")}` },
  ];
  if (p.id === "elite") list.push({ ok: true, label: tr("Badge Elite + support prioritaire") });
  return list;
}

function PricingPage() {
  const tr = useTr();
  const locale = useLocale();
  const billing = useBilling();
  const invalidate = useInvalidateBilling();
  const subscribe = useServerFn(fakeSubscribe);
  const buyPack = useServerFn(fakeBuyPack);
  const checkPromo = useServerFn(lookupPromoCode);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; percentOff: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const isAdmin = !!billing.state?.isAdmin;
  const currentPlan = billing.state?.plan?.id ?? null;
  const subscriber = !!currentPlan;

  /** Prix après application du code promo. */
  const withPromo = (cents: number) =>
    promo ? Math.round((cents * (100 - promo.percentOff)) / 100) : cents;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const r = await checkPromo({ data: { code } });
      if (r.ok && r.code && typeof r.percentOff === "number") {
        setPromo({ code: r.code, percentOff: r.percentOff });
        setPromoInput(r.code);
      } else {
        setPromo(null);
        setPromoError(tr("Code invalide ou expiré."));
      }
    } catch {
      setPromo(null);
      setPromoError(tr("Code invalide ou expiré."));
    } finally {
      setPromoBusy(false);
    }
  };


  const run = async (key: string, fn: () => Promise<{ ok: boolean; code?: string }>) => {
    setBusy(key);
    setNotice(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setNotice(
          r.code === "insufficient_balance"
            ? tr("Solde fictif insuffisant.")
            : tr("Action impossible."),
        );
      } else {
        setNotice(tr("Achat test effectué ✓"));
        await invalidate();
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const ctaFor = (p: PlanDef) => {
    if (!billing.signedIn) {
      return (
        <Button asChild size="lg" className="w-full" variant={p.highlight ? "default" : "secondary"}>
          <Link to="/auth">{tr("Se connecter pour commencer")}</Link>
        </Button>
      );
    }
    if (currentPlan === p.id) {
      return (
        <Button size="lg" className="w-full" variant="secondary" disabled>
          <Check className="size-4" /> {tr("Formule actuelle")}
        </Button>
      );
    }
    if (!isAdmin) {
      return (
        <Button size="lg" className="w-full" variant="secondary" disabled>
          {tr("Bientôt disponible")}
        </Button>
      );
    }
    return (
      <Button
        size="lg"
        className="w-full"
        variant={p.highlight ? "default" : "secondary"}
        disabled={busy !== null}
        onClick={() =>
          void run(p.id, () =>
            subscribe({ data: { planId: p.id, promoCode: promo?.code ?? null } }),
          )
        }

      >
        {busy === p.id ? "…" : currentPlan ? tr("Changer pour cette formule") : tr("S'abonner")}
      </Button>
    );
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-14">
      <header className="mb-10 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-primary">
          {tr("Tarifs")}
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{tr("Une formule, des vidéos à la chaîne")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          {tr("10 crédits = 1 vidéo générée. Les crédits mensuels se renouvellent chaque mois ; les crédits achetés en pack n'expirent jamais.")}
        </p>
        {billing.signedIn && billing.state && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary/60 px-4 py-2 text-sm">
            <Coins className="size-4 text-primary" />
            {tr("Votre solde")}&nbsp;: <strong>{billing.totalCredits}</strong> {tr("crédits")}
          </p>
        )}
      </header>

      {isAdmin && billing.state && (
        <div className="mb-8 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="font-semibold">
            <Sparkles className="mr-1 inline size-4" />
            {tr("Mode test — porte-monnaie fictif")}&nbsp;:{" "}
            {formatEuro(billing.state.fakeBalanceCents ?? 0, locale)}
          </p>
          <p className="mt-1 text-muted-foreground">
            {tr("Aucun paiement réel : chaque achat est instantané et marqué « test ». Les autres comptes voient « Bientôt disponible ».")}
          </p>
        </div>
      )}

      {notice && (
        <p className="mb-6 rounded-xl bg-secondary/60 px-4 py-3 text-center text-sm">{notice}</p>
      )}

      <section className="mx-auto mb-8 max-w-xl rounded-2xl border border-border bg-secondary/30 p-4">
        <label htmlFor="promo" className="flex items-center gap-2 text-sm font-medium">
          <Tag className="size-4 text-primary" /> {tr("Code de promotion")}
        </label>
        <div className="mt-3 flex gap-2">
          <Input
            id="promo"
            value={promoInput}
            placeholder={tr("Entrez votre code")}
            maxLength={32}
            onChange={(e) => {
              setPromoInput(e.target.value.toUpperCase());
              setPromo(null);
              setPromoError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void applyPromo();
            }}
          />
          {promo ? (
            <Button
              variant="secondary"
              onClick={() => {
                setPromo(null);
                setPromoInput("");
                setPromoError(null);
              }}
            >
              <X className="size-4" /> {tr("Retirer")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={promoBusy || !promoInput.trim() || !billing.signedIn}
              onClick={() => void applyPromo()}
            >
              {promoBusy ? "…" : tr("Appliquer")}
            </Button>
          )}
        </div>
        {!billing.signedIn && (
          <p className="mt-2 text-xs text-muted-foreground">
            {tr("Connectez-vous pour utiliser un code.")}
          </p>
        )}
        {promo && (
          <p className="mt-2 text-sm text-primary">
            {tr("Code")} {promo.code} {tr("appliqué")} · −{promo.percentOff}%
          </p>
        )}
        {promoError && <p className="mt-2 text-sm text-destructive">{promoError}</p>}
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => (
          <article

            key={p.id}
            className={`relative flex flex-col rounded-3xl border p-6 ${
              p.highlight ? "panel-glow border-primary/60" : "border-border bg-secondary/30"
            }`}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                {tr("Le plus choisi")}
              </span>
            )}
            <h2 className="text-xl font-semibold">{p.name}</h2>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold">{formatEuro(p.priceCents, locale)}</span>
              <span className="text-sm text-muted-foreground">/ {tr("mois")}</span>
            </p>
            <p className="mt-1 text-sm text-primary">
              {p.monthlyCredits} {tr("crédits")} · {p.monthlyCredits / CREDITS_PER_VIDEO} {tr("vidéos / mois")}
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {planFeatures(p, tr).map((f) => (
                <li
                  key={f.label}
                  className={`flex items-start gap-2 ${f.ok ? "" : "text-muted-foreground/60 line-through"}`}
                >
                  {f.ok ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <Lock className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">{ctaFor(p)}</div>
          </article>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">{tr("Recharger des crédits")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tr("Sans engagement. Les abonnés bénéficient de −20 % sur tous les packs.")}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PACKS.map((k) => {
            const price = packPrice(k, subscriber);
            return (
              <article key={k.id} className="rounded-2xl border border-border bg-secondary/30 p-5">
                <p className="text-lg font-semibold">
                  {k.credits} {tr("crédits")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {k.credits / CREDITS_PER_VIDEO} {tr("vidéos")}
                </p>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{formatEuro(price, locale)}</span>
                  {subscriber ? (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatEuro(k.priceCents, locale)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {formatEuro(packPrice(k, true), locale)} {tr("abonné")}
                    </span>
                  )}
                </p>
                <div className="mt-4">
                  {!billing.signedIn ? (
                    <Button asChild variant="secondary" className="w-full">
                      <Link to="/auth">{tr("Se connecter")}</Link>
                    </Button>
                  ) : isAdmin ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={busy !== null}
                      onClick={() => void run(k.id, () => buyPack({ data: { packId: k.id } }))}
                    >
                      {busy === k.id ? "…" : tr("Acheter")}
                    </Button>
                  ) : (
                    <Button variant="secondary" className="w-full" disabled>
                      {tr("Bientôt disponible")}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-14 grid gap-6 md:grid-cols-2">
        {[
          [
            "Que se passe-t-il quand je n'ai plus de crédits ?",
            "Vous pouvez toujours préparer et prévisualiser votre montage. Seul le bouton « Générer la vidéo » demande 10 crédits.",
          ],
          [
            "Les crédits non utilisés sont-ils reportés ?",
            "Les crédits mensuels de l'abonnement sont remis à zéro à chaque renouvellement. Les crédits achetés en pack n'expirent jamais et sont utilisés après les crédits mensuels.",
          ],
          [
            "Puis-je changer de formule ?",
            "Oui, à tout moment depuis « Mon abonnement ». La nouvelle formule s'applique immédiatement.",
          ],
          [
            "Et sans abonnement ?",
            "Chaque nouveau compte reçoit 10 crédits offerts, soit une vidéo d'essai, et peut acheter des packs de crédits.",
          ],
        ].map(([q, a]) => (
          <div key={q} className="rounded-2xl bg-secondary/30 p-5">
            <h3 className="font-semibold">{tr(q!)}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{tr(a!)}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
