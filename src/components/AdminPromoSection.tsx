import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  setPromoCodeActive,
} from "@/lib/billing.functions";
import { syncPromoCoupon } from "@/lib/payments.functions";
import { usePrefs } from "@/lib/prefs";
import { getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";

/** Section « Création » réservée aux administrateurs : gestion des codes de promotion. */
export function AdminPromoSection() {
  const { lang } = usePrefs();
  const fr = lang === "fr";
  const fetchCodes = useServerFn(listPromoCodes);
  const create = useServerFn(createPromoCode);
  const remove = useServerFn(deletePromoCode);

  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const codes = useQuery({ queryKey: ["promo-codes"], queryFn: () => fetchCodes() });

  const submit = async () => {
    const value = code.trim().toUpperCase();
    const pct = Number(percent);
    if (!value) return;
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError(fr ? "Le pourcentage doit être entre 0 et 100." : "Percentage must be 0-100.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await create({ data: { code: value, percentOff: pct } });
      if (!r.ok) {
        setError(fr ? "Création impossible." : "Could not create the code.");
      } else {
        setCode("");
        await codes.refetch();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-primary" />
        {fr ? "Création" : "Creation"}
      </h3>
      <p className="text-xs text-muted-foreground">
        {fr
          ? "Créez un code de promotion : il réduit les tarifs du pourcentage indiqué."
          : "Create a promo code: it lowers prices by the given percentage."}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-32 flex-1">
          <label htmlFor="promo-code" className="text-xs text-muted-foreground">
            {fr ? "Code" : "Code"}
          </label>
          <Input
            id="promo-code"
            value={code}
            maxLength={32}
            placeholder="BIENVENUE20"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </div>
        <div className="w-24">
          <label htmlFor="promo-percent" className="text-xs text-muted-foreground">
            {fr ? "Réduction %" : "Discount %"}
          </label>
          <Input
            id="promo-percent"
            type="number"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
        </div>
        <Button size="sm" disabled={busy || !code.trim()} onClick={() => void submit()}>
          {busy ? "…" : fr ? "Créer" : "Create"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {(codes.data ?? []).map((c) => (
          <li key={c.code} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="font-mono font-medium">{c.code}</span>
            <span className="text-primary">−{c.percentOff}%</span>
            <span className="text-xs text-muted-foreground">
              {c.uses} {fr ? "util." : "uses"}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={fr ? "Supprimer le code" : "Delete code"}
              onClick={async () => {
                await remove({ data: { code: c.code } });
                await codes.refetch();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {codes.data && codes.data.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-muted-foreground">
            {fr ? "Aucun code pour l'instant." : "No codes yet."}
          </li>
        )}
      </ul>
    </section>
  );
}
