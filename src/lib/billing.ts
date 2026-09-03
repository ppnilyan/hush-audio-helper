import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { useSession } from "@/lib/account";
import { getAdvanced, setAdvanced } from "@/lib/advanced-mode";
import { getBillingState, type BillingState } from "@/lib/billing.functions";
import { usePrefs } from "@/lib/prefs";

/** 10 crédits = 1 vidéo générée. */
export const CREDITS_PER_VIDEO = 10;

/** Remise appliquée aux packs pour les abonnés. */
export const SUBSCRIBER_PACK_DISCOUNT = 0.2;

export type PlanId = "starter" | "pro" | "elite";

export type PlanDef = {
  id: PlanId;
  name: string;
  priceCents: number;
  monthlyCredits: number;
  allowAdvanced: boolean;
  allowAllThemes: boolean;
  allowImportMusic: boolean;
  highlight?: boolean;
};

/** Catalogue affiché (miroir des lignes `plans` en base). */
export const PLANS: PlanDef[] = [
  {
    id: "starter",
    name: "Starter",
    priceCents: 1700,
    monthlyCredits: 300,
    allowAdvanced: false,
    allowAllThemes: false,
    allowImportMusic: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 2700,
    monthlyCredits: 600,
    allowAdvanced: true,
    allowAllThemes: true,
    allowImportMusic: true,
    highlight: true,
  },
  {
    id: "elite",
    name: "Elite",
    priceCents: 4700,
    monthlyCredits: 1500,
    allowAdvanced: true,
    allowAllThemes: true,
    allowImportMusic: true,
  },
];

export type PackDef = { id: string; credits: number; priceCents: number };

/** Packs de recharge (miroir des lignes `credit_packs` en base). */
export const PACKS: PackDef[] = [
  { id: "pack50", credits: 50, priceCents: 690 },
  { id: "pack100", credits: 100, priceCents: 1290 },
  { id: "pack300", credits: 300, priceCents: 3490 },
];

export const packPrice = (pack: PackDef, subscriber: boolean) =>
  subscriber ? Math.round(pack.priceCents * (1 - SUBSCRIBER_PACK_DISCOUNT)) : pack.priceCents;

export function formatEuro(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export const BILLING_KEY = ["billing"] as const;

export type Billing = {
  /** true tant que l'état n'est pas connu (session ou requête en cours). */
  loading: boolean;
  signedIn: boolean;
  state: BillingState | null;
  totalCredits: number;
  can: { advanced: boolean; allThemes: boolean; importMusic: boolean };
  refetch: () => Promise<unknown>;
};

/** État de facturation du compte + application des restrictions de formule. */
export function useBilling(): Billing {
  const session = useSession();
  const userId = session?.user.id ?? null;
  const fetchState = useServerFn(getBillingState);
  const { theme, setTheme } = usePrefs();

  const query = useQuery({
    queryKey: [...BILLING_KEY, userId],
    queryFn: () => fetchState(),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const loading = session === undefined || (!!userId && query.isPending);
  const state = userId ? (query.data ?? null) : null;
  const plan = state?.plan ?? null;

  // Tant que l'état n'est pas connu, on ne verrouille rien (évite les clignotements).
  const can = loading
    ? { advanced: true, allThemes: true, importMusic: true }
    : {
        advanced: !!plan?.allowAdvanced,
        allThemes: !!plan?.allowAllThemes,
        importMusic: !!plan?.allowImportMusic,
      };

  useEffect(() => {
    if (loading) return;
    if (!can.advanced && getAdvanced()) setAdvanced(false);
    if (!can.allThemes && theme !== "aurora") setTheme("aurora");
  }, [loading, can.advanced, can.allThemes, theme, setTheme]);

  const totalCredits = state ? state.monthlyCredits + state.purchasedCredits : 0;

  return {
    loading,
    signedIn: !!userId,
    state,
    totalCredits,
    can,
    refetch: query.refetch,
  };
}

/** Invalide le cache de facturation après un achat ou une génération. */
export function useInvalidateBilling() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: BILLING_KEY });
}
