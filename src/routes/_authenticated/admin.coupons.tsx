import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BulkImporter } from "@/components/admin/BulkImporter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { listCoupons, deleteCoupons, upsertCoupon, type AdminCoupon } from "@/lib/admin-api";
import { Trash2, Plus, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  component: CouponsPage,
});

function CouponsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin-coupons"], queryFn: listCoupons });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const onDelete = async () => {
    if (!confirm(`Delete ${selected.size} coupons?`)) return;
    await deleteCoupons([...selected]);
    toast.success("Deleted"); setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  const newCoupon = async () => {
    const code = prompt("Coupon code?")?.toUpperCase().trim();
    if (!code) return;
    await upsertCoupon({ code, kind: "percent", value: 10, min_amount: 0, status: "active", uses: 0, max_uses: null, expires_at: null });
    toast.success("Coupon created");
    qc.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  return (
    <AdminShell
      title="Coupons"
      actions={
        <>
          <BulkImporter
            label="Import"
            templateHeaders={["code", "kind", "value", "min_amount", "max_uses", "expires_at"]}
            onCommit={async (rows) => {
              for (const r of rows) await upsertCoupon(r as Partial<AdminCoupon>);
              qc.invalidateQueries({ queryKey: ["admin-coupons"] });
              return { inserted: rows.length, updated: 0 };
            }}
          />
          <Button size="sm" onClick={newCoupon} className="gap-1.5"><Plus className="h-4 w-4" /> New</Button>
        </>
      }
    >
      {selected.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2.5 mb-3 flex items-center gap-2 text-sm">
          <span className="font-semibold">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="destructive" onClick={onDelete} className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading && <p className="text-muted-foreground col-span-full text-center py-8">Loading…</p>}
        {data.map((c) => (
          <Card key={c.id} className="relative">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <code className="font-mono font-bold text-base bg-muted px-2 py-1 rounded">{c.code}</code>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }}
                  aria-label="Copy code"
                ><Copy className="h-3.5 w-3.5" /></button>
              </div>
              <p className="text-sm font-semibold">
                {c.kind === "percent" ? `${c.value}% off` : `₹${c.value} off`}
                {c.min_amount > 0 && <span className="text-muted-foreground font-normal text-xs"> · min ₹{c.min_amount}</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {c.uses} {c.max_uses ? `/ ${c.max_uses}` : ""} uses
                {c.expires_at && ` · expires ${new Date(c.expires_at).toLocaleDateString()}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
