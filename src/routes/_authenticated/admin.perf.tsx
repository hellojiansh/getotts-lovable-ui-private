import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gauge, Zap, Activity, AlertOctagon, RefreshCw, Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import { getPerfVitals, listPerfPages, type PerfSummary } from "@/lib/perf.functions";

export const Route = createFileRoute("/_authenticated/admin/perf")({
  component: PerfDashboard,
});

const RANGES: Array<{ label: string; hours: number }> = [
  { label: "Last hour", hours: 1 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7 days", hours: 24 * 7 },
  { label: "Last 30 days", hours: 24 * 30 },
];

function fmtMs(v: number | null | undefined) {
  if (v == null) return "—";
  return `${Math.round(v)} ms`;
}
function fmtCls(v: number | null | undefined) {
  if (v == null) return "—";
  return Number(v).toFixed(3);
}
function tone(label: "lcp" | "cls" | "fcp", v: number | null) {
  if (v == null) return "text-muted-foreground";
  if (label === "lcp") return v <= 2500 ? "text-emerald-600" : v <= 4000 ? "text-amber-600" : "text-red-600";
  if (label === "cls") return v <= 0.1 ? "text-emerald-600" : v <= 0.25 ? "text-amber-600" : "text-red-600";
  return v <= 1800 ? "text-emerald-600" : v <= 3000 ? "text-amber-600" : "text-red-600";
}

type SortKey = "page" | "samples" | "lcp_p50" | "lcp_p75" | "cls_p75" | "fcp_p75" | "fouc_rate";

function PerfDashboard() {
  const [hours, setHours] = useState(24);
  const [page, setPage] = useState<string>("__all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lcp_p75");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageIdx, setPageIdx] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const fetchVitals = useServerFn(getPerfVitals);
  const fetchPages = useServerFn(listPerfPages);

  const pagesQ = useQuery({ queryKey: ["perf-pages"], queryFn: () => fetchPages() });
  const summaryQ = useQuery({
    queryKey: ["perf-vitals", hours, page],
    queryFn: () => fetchVitals({ data: { hours, page: page === "__all" ? undefined : page } }),
    refetchInterval: 30_000,
  });

  const data = summaryQ.data as PerfSummary | undefined;

  const overall = useMemo(() => {
    if (!data) return null;
    const samples = data.byPage.reduce((s, p) => s + p.samples, 0);
    const lcpVals = data.byPage.flatMap((p) => (p.lcp_p75 ? [p.lcp_p75] : []));
    const clsVals = data.byPage.flatMap((p) => (p.cls_p75 ? [p.cls_p75] : []));
    const fouc = data.foucEvents.length;
    return {
      samples,
      lcp_p75: lcpVals.length ? Math.round(lcpVals.reduce((a, b) => a + b, 0) / lcpVals.length) : null,
      cls_p75: clsVals.length ? Math.round(clsVals.reduce((a, b) => a + b, 0) / clsVals.length * 1000) / 1000 : null,
      fouc,
    };
  }, [data]);

  const filteredPages = useMemo(() => {
    const rows = data?.byPage ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.page.toLowerCase().includes(q)) : rows;
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] as number | string | null;
      const bv = b[sortKey] as number | string | null;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredPages.length / pageSize));
  const safePageIdx = Math.min(pageIdx, totalPages - 1);
  const pagedRows = filteredPages.slice(safePageIdx * pageSize, safePageIdx * pageSize + pageSize);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "page" ? "asc" : "desc"); }
    setPageIdx(0);
  };

  return (
    <AdminShell
      title="Performance"
      actions={
        <button
          onClick={() => summaryQ.refetch()}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${summaryQ.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.hours} value={String(r.hours)}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={page} onValueChange={setPage}>
          <SelectTrigger className="w-56 h-9 text-sm"><SelectValue placeholder="All pages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All pages</SelectItem>
            {(pagesQ.data ?? []).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {summaryQ.isLoading
            ? "Loading…"
            : `${data?.total ?? 0}${data?.total === 5000 ? "+ (sampled)" : ""} samples · auto-refresh 30s`}
        </span>

      </div>

      {/* Overall KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <KpiCard icon={Activity} label="Samples" value={overall?.samples?.toLocaleString() ?? "—"} tone="text-blue-600 bg-blue-50" />
        <KpiCard
          icon={Zap}
          label="LCP p75 (avg)"
          value={fmtMs(overall?.lcp_p75 ?? null)}
          tone="text-violet-600 bg-violet-50"
          valueClass={tone("lcp", overall?.lcp_p75 ?? null)}
        />
        <KpiCard
          icon={Gauge}
          label="CLS p75 (avg)"
          value={fmtCls(overall?.cls_p75 ?? null)}
          tone="text-emerald-600 bg-emerald-50"
          valueClass={tone("cls", overall?.cls_p75 ?? null)}
        />
        <KpiCard
          icon={AlertOctagon}
          label="FOUC events"
          value={(overall?.fouc ?? 0).toLocaleString()}
          tone="text-red-600 bg-red-50"
          valueClass={overall?.fouc ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {/* Trend mini-chart */}
      <Card className="mb-5">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">LCP p75 over time</h3>
          <TrendChart points={data?.byHour ?? []} />
        </CardContent>
      </Card>

      {/* By page */}
      <Card className="mb-5">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPageIdx(0); }}
                placeholder="Search pages…"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredPages.length} of {data?.byPage.length ?? 0} pages
            </span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPageIdx(0); }}>
              <SelectTrigger className="w-28 h-9 text-sm ml-auto"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortableTh active={sortKey === "page"} dir={sortDir} onClick={() => toggleSort("page")} className="text-left">Page</SortableTh>
                <SortableTh active={sortKey === "samples"} dir={sortDir} onClick={() => toggleSort("samples")} className="text-right">Samples</SortableTh>
                <SortableTh active={sortKey === "lcp_p50"} dir={sortDir} onClick={() => toggleSort("lcp_p50")} className="text-right">LCP p50</SortableTh>
                <SortableTh active={sortKey === "lcp_p75"} dir={sortDir} onClick={() => toggleSort("lcp_p75")} className="text-right">LCP p75</SortableTh>
                <SortableTh active={sortKey === "cls_p75"} dir={sortDir} onClick={() => toggleSort("cls_p75")} className="text-right">CLS p75</SortableTh>
                <SortableTh active={sortKey === "fcp_p75"} dir={sortDir} onClick={() => toggleSort("fcp_p75")} className="text-right">FCP p75</SortableTh>
                <SortableTh active={sortKey === "fouc_rate"} dir={sortDir} onClick={() => toggleSort("fouc_rate")} className="text-right pr-6">FOUC %</SortableTh>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((p) => (
                <tr key={p.page} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium truncate max-w-xs">{p.page}</td>
                  <td className="px-4 py-2.5 text-right">{p.samples}</td>
                  <td className="px-4 py-2.5 text-right">{fmtMs(p.lcp_p50)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${tone("lcp", p.lcp_p75)}`}>{fmtMs(p.lcp_p75)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${tone("cls", p.cls_p75)}`}>{fmtCls(p.cls_p75)}</td>
                  <td className={`px-4 py-2.5 text-right ${tone("fcp", p.fcp_p75)}`}>{fmtMs(p.fcp_p75)}</td>
                  <td className="px-4 py-2.5 text-right pr-6">
                    {p.fouc_rate > 0 ? (
                      <Badge variant="destructive" className="font-mono">{p.fouc_rate}%</Badge>
                    ) : (
                      <span className="text-emerald-600 text-xs">0%</span>
                    )}
                  </td>
                </tr>
              ))}
              {!pagedRows.length && !summaryQ.isLoading && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {search ? `No pages match "${search}".` : "No samples in this range yet."}
                </td></tr>
              )}
            </tbody>
          </table>
          </div>
          {filteredPages.length > pageSize && (
            <div className="flex items-center justify-between gap-3 p-3 border-t text-xs">
              <span className="text-muted-foreground">
                Showing {safePageIdx * pageSize + 1}–{Math.min((safePageIdx + 1) * pageSize, filteredPages.length)} of {filteredPages.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
                  disabled={safePageIdx === 0}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="text-muted-foreground">Page {safePageIdx + 1} of {totalPages}</span>
                <button
                  onClick={() => setPageIdx((i) => Math.min(totalPages - 1, i + 1))}
                  disabled={safePageIdx >= totalPages - 1}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top offenders */}
      <div className="grid lg:grid-cols-2 gap-4">
        <OffenderList title="Slowest LCP" rows={data?.worstLcp ?? []} metric="lcp" />
        <OffenderList title="Largest CLS" rows={data?.worstCls ?? []} metric="cls" />
      </div>

      {data?.foucEvents.length ? (
        <Card className="mt-4">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-red-600" /> Recent FOUC events ({data.foucEvents.length})
            </h3>
            <div className="space-y-1.5 text-xs font-mono max-h-72 overflow-auto">
              {data.foucEvents.map((r, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-muted/40 pb-1">
                  <span className="truncate">{r.page}</span>
                  <span className="text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </AdminShell>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, valueClass,
}: { icon: typeof Activity; label: string; value: string; tone: string; valueClass?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`h-9 w-9 rounded-lg grid place-items-center mb-3 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={`text-xl md:text-2xl font-bold mt-0.5 ${valueClass ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SortableTh({
  children, active, dir, onClick, className = "",
}: { children: React.ReactNode; active: boolean; dir: "asc" | "desc"; onClick: () => void; className?: string }) {
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {children}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"} ${active && dir === "asc" ? "rotate-180" : ""}`} />
      </button>
    </th>
  );
}

function OffenderList({
  title, rows, metric,
}: { title: string; rows: Array<{ page: string; lcp: number | null; cls: number | null; created_at: string; lcp_el: string | null; viewport: string | null }>; metric: "lcp" | "cls" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        <div className="space-y-2 max-h-96 overflow-auto">
          {rows.map((r, i) => {
            const v = metric === "lcp" ? r.lcp : r.cls;
            return (
              <div key={i} className="flex items-start justify-between gap-3 text-xs border-b border-muted/40 pb-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{r.page}</p>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {r.lcp_el ?? "—"} · {r.viewport ?? "?"} · {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`font-mono font-bold shrink-0 ${tone(metric, Number(v ?? 0))}`}>
                  {metric === "lcp" ? fmtMs(v as number) : fmtCls(v as number)}
                </span>
              </div>
            );
          })}
          {!rows.length && <p className="text-xs text-muted-foreground py-8 text-center">No offenders 🎉</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ points }: { points: Array<{ bucket: string; lcp_p75: number | null; cls_p75: number | null; samples: number }> }) {
  if (!points.length) return <p className="text-xs text-muted-foreground py-6 text-center">No data yet.</p>;
  const max = Math.max(...points.map((p) => p.lcp_p75 ?? 0), 1);
  const W = 600, H = 120, gap = 4;
  const bw = Math.max(2, (W - gap * (points.length - 1)) / points.length);
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full h-32">
      {points.map((p, i) => {
        const v = p.lcp_p75 ?? 0;
        const h = (v / max) * H;
        const x = i * (bw + gap);
        const color = v <= 2500 ? "#10b981" : v <= 4000 ? "#f59e0b" : "#ef4444";
        return <rect key={i} x={x} y={H - h} width={bw} height={h} fill={color} rx={2}><title>{`${p.bucket} — LCP p75 ${Math.round(v)}ms · ${p.samples} samples`}</title></rect>;
      })}
      <line x1="0" y1={H} x2={W} y2={H} stroke="currentColor" strokeOpacity="0.15" />
    </svg>
  );
}
