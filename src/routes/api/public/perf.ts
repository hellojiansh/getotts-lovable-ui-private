import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const MAX_BODY_BYTES = 4096;

// Best-effort in-memory token bucket. Workers isolate per region, so this
// stops a single attacker but is not a distributed-flood defense.
const RATE_LIMIT = { capacity: 60, refillPerMs: 60 / 60_000 }; // 60 req/min
const buckets = new Map<string, { tokens: number; ts: number }>();
function allow(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: RATE_LIMIT.capacity, ts: now };
  b.tokens = Math.min(RATE_LIMIT.capacity, b.tokens + (now - b.ts) * RATE_LIMIT.refillPerMs);
  b.ts = now;
  if (b.tokens < 1) { buckets.set(ip, b); return false; }
  b.tokens -= 1;
  buckets.set(ip, b);
  // soft cap memory
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.ts > 5 * 60_000) buckets.delete(k);
  }
  return true;
}

const ClsSource = z.object({
  at: z.string().max(20).optional(),
  shift: z.number().min(0).max(10).optional(),
  el: z.string().max(200).nullable().optional(),
});

const PagePath = z.string().min(1).max(200).regex(/^\/[\w\-./~%?=&#:]*$/);

const Body = z.object({
  page: PagePath,
  fcp: z.number().int().min(0).max(120_000).nullish(),
  lcp: z.number().int().min(0).max(120_000).nullish(),
  cls: z.number().min(0).max(10).nullish(),
  ttfb: z.number().int().min(0).max(120_000).nullish(),
  cssReady: z.number().int().min(0).max(120_000).nullish(),
  domReady: z.number().int().min(0).max(120_000).nullish(),
  load: z.number().int().min(0).max(600_000).nullish(),
  fouc: z.boolean().optional(),
  viewport: z.string().max(20).nullish(),
  dpr: z.number().min(0).max(10).nullish(),
  ua: z.string().max(200).nullish(),
  lcpEl: z.string().max(200).nullish(),
  clsSources: z.array(ClsSource).max(5).nullish(),
});

export const Route = createFileRoute("/api/public/perf")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        // Always reply 204 — attackers learn nothing from responses.
        const ok = () => new Response(null, { status: 204, headers: CORS });
        try {
          const len = Number(request.headers.get("content-length") ?? "0");
          if (len > MAX_BODY_BYTES) return ok();

          const ip =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
            "unknown";
          if (!allow(ip)) return ok();

          const text = await request.text();
          if (text.length > MAX_BODY_BYTES) return ok();

          const v = Body.parse(JSON.parse(text));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("perf_vitals").insert({
            page: v.page,
            fcp: v.fcp ?? null,
            lcp: v.lcp ?? null,
            cls: v.cls ?? null,
            ttfb: v.ttfb ?? null,
            css_ready: v.cssReady ?? null,
            dom_ready: v.domReady ?? null,
            load_ms: v.load ?? null,
            fouc: !!v.fouc,
            viewport: v.viewport ?? null,
            dpr: v.dpr ?? null,
            ua: v.ua ?? null,
            lcp_el: v.lcpEl ?? null,
            cls_sources: v.clsSources ?? null,
          });
        } catch {
          // swallow — never reveal validation/DB details to the public beacon
        }
        return ok();
      },
    },
  },
});
