import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const PUBLIC_ORDER_COLUMNS =
  "id, tracking_number, customer_name, product_name, status, carrier, shipment_tracking_url, estimated_delivery, created_at, updated_at" as const;

const ORDER_STATUSES = [
  "pending","confirmed","processing","shipped","out_for_delivery","delivered","cancelled","refunded","failed",
] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function originFromRequest() {
  const host = getRequestHost();
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// --- PUBLIC: tracking lookup by tracking number ---
export const getOrderByTracking = createServerFn({ method: "POST" })
  .inputValidator((d: { trackingNumber: string }) => z.object({ trackingNumber: z.string().trim().min(4).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: order, error } = await sb
      .from("orders")
      .select(PUBLIC_ORDER_COLUMNS)
      .eq("tracking_number", data.trackingNumber)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return { order: null, history: [] };
    const { data: history } = await sb
      .from("order_status_history")
      .select("id, status, message, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });
    return { order, history: history ?? [] };
  });

// --- AUTHENTICATED: my orders ---
export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, tracking_number, product_name, status, amount_cents, currency, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// --- ADMIN: list all orders ---
export const listAllOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as const });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// --- ADMIN: create order ---
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      customer_name: z.string().min(1),
      customer_email: z.string().email(),
      customer_phone: z.string().optional().nullable(),
      product_name: z.string().min(1),
      amount_cents: z.number().int().min(0).default(0),
      currency: z.string().min(3).max(8).default("INR"),
      carrier: z.string().optional().nullable(),
      shipment_tracking_url: z.string().url().optional().nullable(),
      estimated_delivery: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as const });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: inserted, error } = await context.supabase
      .from("orders")
      .insert(data as any)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    // fire-and-forget initial notification
    try {
      const { notifyOrderStatus } = await import("./notifications.server");
      await notifyOrderStatus(inserted as any, originFromRequest());
    } catch (e) { console.warn("notify failed", e); }
    return inserted;
  });

// --- ADMIN: update order status ---
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orderId: z.string().uuid(),
      status: z.enum(ORDER_STATUSES),
      notes: z.string().optional().nullable(),
      carrier: z.string().optional().nullable(),
      shipment_tracking_url: z.string().url().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as const });
    if (!isAdmin) throw new Error("Forbidden");

    const patch: Record<string, unknown> = { status: data.status, notes: data.notes ?? null };
    if (data.carrier !== undefined) patch.carrier = data.carrier;
    if (data.shipment_tracking_url !== undefined) patch.shipment_tracking_url = data.shipment_tracking_url;

    const { data: updated, error } = await context.supabase
      .from("orders").update(patch as any).eq("id", data.orderId).select("*").single();
    if (error) throw new Error(error.message);

    try {
      const { notifyOrderStatus } = await import("./notifications.server");
      await notifyOrderStatus(updated as any, originFromRequest());
    } catch (e) { console.warn("notify failed", e); }
    return updated;
  });

// --- AUTHENTICATED: am I an admin? ---
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" as const });
    return { userId: context.userId, isAdmin: !!isAdmin };
  });
