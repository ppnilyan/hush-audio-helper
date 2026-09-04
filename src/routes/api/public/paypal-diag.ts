import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/paypal-diag")({
  server: {
    handlers: {
      GET: async () => {
        const { paypal, paypalBase } = await import("@/lib/paypal.server");
        try {
          const r = await paypal<{ total_items?: number }>("/v1/catalogs/products?page_size=1");
          return Response.json({ base: paypalBase(), ok: true, items: r.total_items ?? 0 });
        } catch (e) {
          return Response.json({ base: paypalBase(), ok: false, error: (e as Error).message });
        }
      },
    },
  },
});
