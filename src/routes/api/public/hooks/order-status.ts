import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public webhook for external systems (payment processor, fulfillment service, etc.)
// Authenticates via shared secret header `x-webhook-secret` matching ORDER_WEBHOOK_SECRET.
// POST body: { tracking_number, status, notes?, carrier?, shipment_tracking_url? }

const Body = z.object({
  tracking_number: z.string().min(4),
  status: z.enum([
    "pending","confirmed","processing","shipped","out_for_delivery","delivered","cancelled","refunded","failed",
  ]),
  notes: z.string().optional(),
  carrier: z.string().optional(),
  shipment_tracking_url: z.string().url().optional(),
});

export const Route = createFileRoute("/api/public/hooks/order-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.ORDER_WEBHOOK_SECRET;
        if (!expected) return new Response("Webhook secret not configured", { status: 503 });
        const provided = request.headers.get("x-webhook-secret");
        if (provided !== expected) return new Response("Unauthorized", { status: 401 });

        let parsed;
        try { parsed = Body.parse(await request.json()); }
        catch (e: any) { return new Response(`Bad request: ${e.message}`, { status: 400 }); }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order, error } = await supabaseAdmin
          .from("orders")
          .update({
            status: parsed.status,
            notes: parsed.notes ?? null,
            carrier: parsed.carrier ?? undefined,
            shipment_tracking_url: parsed.shipment_tracking_url ?? undefined,
          })
          .eq("tracking_number", parsed.tracking_number)
          .select("*")
          .single();
        if (error) return new Response(error.message, { status: 404 });

        try {
          const { notifyOrderStatus } = await import("@/lib/notifications.server");
          const url = new URL(request.url);
          await notifyOrderStatus(order as any, `${url.protocol}//${url.host}`);
        } catch (e) { console.warn("notify failed", e); }

        return Response.json({ ok: true, order_id: order.id, status: order.status });
      },
    },
  },
});
