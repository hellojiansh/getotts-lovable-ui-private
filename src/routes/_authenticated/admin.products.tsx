import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BulkImporter } from "@/components/admin/BulkImporter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProducts, bulkUpsertProducts, bulkDeleteProducts, bulkUpdateProductStatus, type AdminProduct } from "@/lib/admin-api";
import { Search, Trash2, ArrowUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

const TEMPLATE = ["slug", "name", "category", "price", "stock", "status"];

function ProductsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: listProducts });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<keyof AdminProduct>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = data.filter((p) =>
      (!s || p.name.toLowerCase().includes(s) || p.slug.toLowerCase().includes(s)) &&
      (cat === "all" || p.category === cat) &&
      (status === "all" || p.status === status),
    );
    out.sort((a, b) => {
      const av = a[sort] as any, bv = b[sort] as any;
      return (av > bv ? 1 : av < bv ? -1 : 0) * (sortDir === "asc" ? 1 : -1);
    });
    return out;
  }, [data, q, cat, status, sort, sortDir]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((p) => next.delete(p.id));
    else filtered.forEach((p) => next.add(p.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const onBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} products?`)) return;
    await bulkDeleteProducts([...selected]);
    toast.success("Deleted"); setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };
  const onBulkStatus = async (s: AdminProduct["status"]) => {
    await bulkUpdateProductStatus([...selected], s);
    toast.success(`Set ${selected.size} to ${s}`); setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const categories = useMemo(() => Array.from(new Set(data.map((p) => p.category))).sort(), [data]);

  return (
    <AdminShell
      title="Products"
      actions={
        <>
          <BulkImporter
            templateHeaders={TEMPLATE}
            onCommit={async (rows) => {
              const res = await bulkUpsertProducts(rows as any);
              qc.invalidateQueries({ queryKey: ["admin-products"] });
              return res;
            }}
          />
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New</Button>
        </>
      }
    >
      {/* Filters */}
      <div className="bg-background border rounded-lg p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or slug…" className="pl-9 h-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 mb-3 flex flex-wrap items-center gap-2 text-sm sticky top-14 z-20">
          <span className="font-semibold">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => onBulkStatus("active")}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => onBulkStatus("archived")}>Archive</Button>
          <Button size="sm" variant="destructive" onClick={onBulkDelete} className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-background border rounded-lg overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs">
              <tr>
                <th className="px-3 py-2.5 w-10"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>
                {(["name", "category", "price", "stock", "status", "updated_at"] as const).map((k) => (
                  <th key={k} className="text-left px-3 py-2.5 font-semibold capitalize">
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => {
                      if (sort === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
                      else { setSort(k); setSortDir("asc"); }
                    }}>
                      {k.replace("_", " ")} <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2.5"><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} /></td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium truncate max-w-[260px]">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.slug}</p>
                  </td>
                  <td className="px-3 py-2.5 capitalize">{p.category}</td>
                  <td className="px-3 py-2.5">₹{p.price}</td>
                  <td className="px-3 py-2.5"><span className={p.stock < 5 ? "text-red-600 font-semibold" : ""}>{p.stock}</span></td>
                  <td className="px-3 py-2.5"><Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">{p.status}</Badge></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {!isLoading && !filtered.length && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No products match</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {filtered.map((p) => (
            <label key={p.id} className="flex gap-3 p-3 active:bg-muted/40">
              <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} className="mt-1" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.category} · ₹{p.price} · stock {p.stock}</p>
                <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize mt-1.5 text-[10px]">{p.status}</Badge>
              </div>
            </label>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">{filtered.length} of {data.length} products</p>
    </AdminShell>
  );
}
