const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        Les paiements réels ne sont pas encore activés sur ce site.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-600 dark:text-amber-300">
        Les paiements effectués ici sont en mode test.
      </div>
    );
  }
  return null;
}
