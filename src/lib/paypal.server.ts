/**
 * Client PayPal REST (serveur uniquement).
 * PAYPAL_ENV = "live" | "sandbox" ; identifiants dans les secrets backend.
 */

const getEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is not configured`);
  return v;
};

export function paypalBase(): string {
  const env = (process.env["PAYPAL_ENV"] ?? "live").toLowerCase();
  return env === "sandbox" || env === "test"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const id = getEnv("PAYPAL_CLIENT_ID");
  const secret = getEnv("PAYPAL_CLIENT_SECRET");
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) {
    throw new Error(`PayPal auth failed (${res.status})`);
  }
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3000) * 1000,
  };
  return cachedToken.token;
}

/** Appel générique de l'API PayPal. Lève une erreur lisible en cas d'échec. */
export async function paypal<T>(
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${paypalBase()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const detail = json as { message?: string; details?: { description?: string }[] } | null;
    const msg =
      detail?.details?.[0]?.description ?? detail?.message ?? `PayPal error (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

/** Montant en centimes -> chaîne PayPal ("17.00"). */
export const toAmount = (cents: number) => (cents / 100).toFixed(2);
