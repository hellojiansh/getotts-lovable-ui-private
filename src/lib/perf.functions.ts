import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Filters = z.object({
  hours: z.number().int().min(1).max(24 * 30).default(24),
  page: z.string().max(200).optional(),
});

export type PerfRow = {
  created_at: string;
  page: string;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  ttfb: number | null;
  css_ready: number | null;
  fouc: boolean;
  viewport: string | null;
  lcp_el: string | null;
};

export type PerfSummary = {
  total: number;
  byPage: Array<{
    page: string;
    samples: number;
    lcp_p50: number | null;
    lcp_p75: number | null;
    cls_p75: number | null;
    fcp_p75: number | null;
    fouc_rate: number;
  }>;
  worstLcp: PerfRow[];
  worstCls: PerfRow[];
  foucEvents: PerfRow[];
  byHour: Array<{ bucket: string; lcp_p75: number | null; cls_p75: number | null; samples: number }>;
};

function percentile(values: number[], p: number): number | null {
  const filtered = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!filtered.length) return null;
  filtered.sort((a, b) => a - b);
  const idx = Math.min(filtered.length - 1, Math.floor((p / 100) * filtered.length));
  return Math.round(filtered[idx] * 10000) / 10000;
}

export const getPerfVitals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => Filters.parse(data))
  .handler(async ({ data, context }): Promise<PerfSummary> => {
    const sinceIso = new Date(Date.now() - data.hours * 3600_000).toISOString();
    // Admin check via has_role
    const { data: adminCheck } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!adminCheck) throw new Response("Forbidden", { status: 403 });

    let q = context.supabase
      .from("perf_vitals")
      .select("created_at,page,fcp,lcp,cls,ttfb,css_ready,fouc,viewport,lcp_el")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (data.page) q = q.eq("page", data.page);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as PerfRow[];

    // group by page
    const groups = new Map<string, PerfRow[]>();
    for (const r of list) {
      const arr = groups.get(r.page) ?? [];
      arr.push(r);
      groups.set(r.page, arr);
    }
    const byPage = Array.from(groups.entries())
      .map(([page, arr]) => ({
        page,
        samples: arr.length,
        lcp_p50: percentile(arr.map((x) => x.lcp ?? NaN), 50),
        lcp_p75: percentile(arr.map((x) => x.lcp ?? NaN), 75),
        cls_p75: percentile(arr.map((x) => Number(x.cls ?? 0)), 75),
        fcp_p75: percentile(arr.map((x) => x.fcp ?? NaN), 75),
        fouc_rate: Math.round((arr.filter((x) => x.fouc).length / arr.length) * 10000) / 100,
      }))
      .sort((a, b) => b.samples - a.samples);

    const worstLcp = [...list]
      .filter((r) => typeof r.lcp === "number")
      .sort((a, b) => (b.lcp ?? 0) - (a.lcp ?? 0))
      .slice(0, 25);
    const worstCls = [...list]
      .filter((r) => typeof r.cls === "number" && (r.cls ?? 0) > 0)
      .sort((a, b) => Number(b.cls ?? 0) - Number(a.cls ?? 0))
      .slice(0, 25);
    const foucEvents = list.filter((r) => r.fouc).slice(0, 50);

    // bucket by hour (or day if hours > 48)
    const bucketMs = data.hours <= 48 ? 3600_000 : 86_400_000;
    const buckets = new Map<string, PerfRow[]>();
    for (const r of list) {
      const t = new Date(r.created_at).getTime();
      const b = new Date(Math.floor(t / bucketMs) * bucketMs).toISOString();
      const arr = buckets.get(b) ?? [];
      arr.push(r);
      buckets.set(b, arr);
    }
    const byHour = Array.from(buckets.entries())
      .map(([bucket, arr]) => ({
        bucket,
        samples: arr.length,
        lcp_p75: percentile(arr.map((x) => x.lcp ?? NaN), 75),
        cls_p75: percentile(arr.map((x) => Number(x.cls ?? 0)), 75),
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));

    return { total: list.length, byPage, worstLcp, worstCls, foucEvents, byHour };
  });

export const listPerfPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data: adminCheck } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!adminCheck) throw new Response("Forbidden", { status: 403 });
    const { data, error } = await context.supabase
      .from("perf_vitals")
      .select("page")
      .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
      .limit(5000);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    (data ?? []).forEach((r: { page: string }) => set.add(r.page));
    return Array.from(set).sort();
  });
