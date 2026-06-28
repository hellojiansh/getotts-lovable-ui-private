/**
 * Admin API — placeholder layer for the VPS backend.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Codex: every function below is a stub returning mock data.          │
 * │  Replace the body with a fetch() to your VPS endpoint.               │
 * │  Supabase only mints the session — pass its access_token in the      │
 * │  Authorization header so the VPS can verify it.                       │
 * │                                                                       │
 * │  Auth header helper:                                                  │
 * │    const { data:{session} } = await supabase.auth.getSession();      │
 * │    headers: { Authorization: `Bearer ${session?.access_token}` }     │
 * └──────────────────────────────────────────────────────────────────────┘
 */

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: "active" | "draft" | "archived";
  image?: string;
  updated_at: string;
};

export type AdminCoupon = {
  id: string;
  code: string;
  kind: "percent" | "flat";
  value: number;
  min_amount: number;
  expires_at: string | null;
  uses: number;
  max_uses: number | null;
  status: "active" | "expired" | "paused";
};

export type AdminStats = {
  revenue_30d: number;
  orders_30d: number;
  new_customers_30d: number;
  conversion_rate: number;
  pending_orders: number;
  low_stock: number;
};

// ─── VPS base URL ────────────────────────────────────────────────────────
// TODO(codex): set this to your VPS API base (e.g. https://api.getotts.com).
export const VPS_BASE = import.meta.env.VITE_VPS_API_BASE ?? "";

// ─── Mock data (delete once VPS is wired) ────────────────────────────────
const MOCK_PRODUCTS: AdminProduct[] = Array.from({ length: 24 }).map((_, i) => ({
  id: `p_${i + 1}`,
  slug: `ott-pack-${i + 1}`,
  name: ["Netflix 1M", "Prime Video 3M", "Disney+ 6M", "Spotify Family"][i % 4] + ` Bundle ${i + 1}`,
  category: ["streaming", "music", "productivity", "gaming"][i % 4],
  price: 99 + (i % 6) * 50,
  stock: (i * 7) % 40,
  status: i % 5 === 0 ? "draft" : "active",
  image: undefined,
  updated_at: new Date(Date.now() - i * 86400000).toISOString(),
}));

const MOCK_COUPONS: AdminCoupon[] = [
  { id: "c1", code: "WELCOME10", kind: "percent", value: 10, min_amount: 0, expires_at: null, uses: 124, max_uses: null, status: "active" },
  { id: "c2", code: "OTT50", kind: "flat", value: 50, min_amount: 299, expires_at: "2026-12-31", uses: 12, max_uses: 500, status: "active" },
  { id: "c3", code: "FESTIVE15", kind: "percent", value: 15, min_amount: 199, expires_at: "2026-07-15", uses: 432, max_uses: 1000, status: "active" },
];

// ─── Stats ───────────────────────────────────────────────────────────────
export async function fetchAdminStats(): Promise<AdminStats> {
  // TODO(codex): GET `${VPS_BASE}/admin/stats`
  await sleep(180);
  return {
    revenue_30d: 248_750,
    orders_30d: 1_284,
    new_customers_30d: 612,
    conversion_rate: 3.42,
    pending_orders: 7,
    low_stock: 4,
  };
}

// ─── Products ────────────────────────────────────────────────────────────
export async function listProducts(): Promise<AdminProduct[]> {
  // TODO(codex): GET `${VPS_BASE}/admin/products`
  await sleep(220);
  return [...MOCK_PRODUCTS];
}

export async function bulkUpsertProducts(_rows: Partial<AdminProduct>[]): Promise<{ inserted: number; updated: number }> {
  // TODO(codex): POST `${VPS_BASE}/admin/products/bulk` with rows[]
  await sleep(500);
  return { inserted: _rows.length, updated: 0 };
}

export async function bulkDeleteProducts(_ids: string[]): Promise<void> {
  // TODO(codex): DELETE `${VPS_BASE}/admin/products` with body { ids: [...] }
  await sleep(300);
}

export async function bulkUpdateProductStatus(_ids: string[], _status: AdminProduct["status"]): Promise<void> {
  // TODO(codex): PATCH `${VPS_BASE}/admin/products/status`
  await sleep(300);
}

// ─── Coupons ─────────────────────────────────────────────────────────────
export async function listCoupons(): Promise<AdminCoupon[]> {
  // TODO(codex): GET `${VPS_BASE}/admin/coupons`
  await sleep(180);
  return [...MOCK_COUPONS];
}

export async function upsertCoupon(_coupon: Partial<AdminCoupon>): Promise<AdminCoupon> {
  // TODO(codex): POST `${VPS_BASE}/admin/coupons`
  await sleep(250);
  return { ..._coupon, id: _coupon.id ?? `c_${Date.now()}` } as AdminCoupon;
}

export async function deleteCoupons(_ids: string[]): Promise<void> {
  // TODO(codex): DELETE `${VPS_BASE}/admin/coupons`
  await sleep(200);
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
