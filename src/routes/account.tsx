import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CREDITS_PER_VIDEO, formatEuro, useBilling, useInvalidateBilling } from "@/lib/billing";
import { fakeCancel, listTransactions } from "@/lib/billing.functions";
import { useLocale, useTr } from "@/lib/prefs";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Mon abonnement — SilenceCut" },
      {
        name: "description",
        content: "Votre formule, vos crédits restants et l'historique de vos achats SilenceCut.",
      },
      { property: "og:title", content: "Mon abonnement — SilenceCut" },
      { property: "og:description", content: "Formule, crédits et historique des achats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

const KIND_LABELS: Record<string, string> = {
  welcome: "Crédits de bienvenue",
  renewal: "Renouvellement mensuel",
  subscription: "Abonnement",
  pack: "Pack de crédits",
  generation: "Génération vidéo",
  refund: "Remboursement",
  cancel: "Annulation",
};

function AccountPage() {
  const tr = useTr();
  const locale = useLocale();
  const billing = useBilling();
  const invalidate = useInvalidateBilling();
  const cancel = useServerFn(fakeCancel);
  const fetchTx = useServerFn(listTransactions);
  const [busy, setBusy] = useState(false);

  const tx = useQuery({
    queryKey: ["billing", "transactions", billing.state ? 1 : 0, billing.totalCredits],
    queryFn: () => fetchTx(),
    enabled: billing.signedIn,
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  if (billing.loading) {
    return <main className="mx-auto max-w-4xl px-5 py-14 text-muted-foreground">…</main>;
  }

  if (!billing.signedIn || !billing.state) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-14">
        <h1 className="text-3xl font-bold">{tr("Mon abonnement")}</h1>
        <p className="mt-4 text-muted-foreground">
          {tr("Connectez-vous pour voir votre formule et vos crédits.")}
        </p>
        <Button asChild className="mt-6">
          <Link to="/auth">{tr("Se connecter")}</Link>
        </Button>
      </main>
    );
  }

  const s = billing.state;
  const plan = s.plan;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-14">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-primary">{tr("Compte")}</p>
      <h1 className="mt-3 text-4xl font-bold">{tr("Mon abonnement")}</h1>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="panel-glow rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">{tr("Formule")}</p>
          <p className="mt-1 text-2xl font-bold">{plan ? plan.name : tr("Gratuit")}</p>
          {plan && (
            <p className="mt-1 text-xs text-muted-foreground">
              {plan.cancelAtPeriodEnd
                ? `${tr("Résilié — accès jusqu'au")} ${fmtDate(plan.renewsAt)}`
                : `${tr("Renouvellement le")} ${fmtDate(plan.renewsAt)}`}
              {plan.mode === "test" && ` · ${tr("test")}`}
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-secondary/40 p-5">
          <p className="text-sm text-muted-foreground">{tr("Crédits mensuels restants")}</p>
          <p className="mt-1 text-2xl font-bold">{s.monthlyCredits}</p>
          {plan && (
            <p className="mt-1 text-xs text-muted-foreground">
              {tr("sur")} {plan.monthlyCredits}
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-secondary/40 p-5">
          <p className="text-sm text-muted-foreground">{tr("Crédits achetés")}</p>
          <p className="mt-1 text-2xl font-bold">{s.purchasedCredits}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tr("n'expirent jamais")}</p>
        </div>
      </section>

      <p className="mt-4 text-sm text-muted-foreground">
        {tr("Total")}&nbsp;: <strong className="text-foreground">{billing.totalCredits}</strong> {tr("crédits")} ·{" "}
        {Math.floor(billing.totalCredits / CREDITS_PER_VIDEO)} {tr("vidéos")}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/pricing">{plan ? tr("Changer de formule / recharger") : tr("Voir les formules")}</Link>
        </Button>
        {plan && s.isAdmin && !plan.cancelAtPeriodEnd && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await cancel();
                await invalidate();
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr("Annuler l'abonnement")}
          </Button>
        )}
      </div>

      {s.isAdmin && (
        <p className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
          {tr("Mode test — porte-monnaie fictif")}&nbsp;: {formatEuro(s.fakeBalanceCents ?? 0, locale)}
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-xl font-semibold">{tr("Historique")}</h2>
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {(tx.data ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {tr(KIND_LABELS[t.kind] ?? t.kind)}
                  {t.note && t.kind !== "welcome" && t.kind !== "generation" && (
                    <span className="text-muted-foreground"> · {t.note}</span>
                  )}
                  {t.mode === "test" && t.amountCents > 0 && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">test</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(t.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className={t.credits < 0 ? "text-destructive" : "text-primary"}>
                  {t.credits > 0 ? "+" : ""}
                  {t.credits} {tr("crédits")}
                </p>
                {t.amountCents > 0 && (
                  <p className="text-xs text-muted-foreground">{formatEuro(t.amountCents, locale)}</p>
                )}
              </div>
            </li>
          ))}
          {tx.data && tx.data.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {tr("Aucun mouvement pour l'instant.")}
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
