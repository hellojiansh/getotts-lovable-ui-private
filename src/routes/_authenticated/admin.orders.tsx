import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAllOrders, updateOrderStatus, createOrder, getMyRole } from "@/lib/orders.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ExternalLink } from "lucide-react";

const STATUSES = ["pending","confirmed","processing","shipped","out_for_delivery","delivered","cancelled","refunded","failed"] as const;

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({ meta: [{ title: "Admin · Orders" }] }),
  beforeLoad: async () => {
    try {
      const role = await getMyRole();
      if (!role.isAdmin) throw redirect({ to: "/orders" });
    } catch (e) { throw redirect({ to: "/orders" }); }
  },
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const listFn = useServerFn(listAllOrders);
  const updateFn = useServerFn(updateOrderStatus);
  const createFn = useServerFn(createOrder);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["all-orders"], queryFn: () => listFn() });
  const [openNew, setOpenNew] = useState(false);

  async function setStatus(id: string, status: typeof STATUSES[number], notes?: string) {
    try {
      await updateFn({ data: { orderId: id, status, notes: notes ?? null } });
      toast.success(`Set to ${status.replace(/_/g, " ")}. Notifications sent.`);
      qc.invalidateQueries({ queryKey: ["all-orders"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Orders · Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Status changes auto-notify the customer via email + WhatsApp.</p>
          </div>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New order</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create order</DialogTitle></DialogHeader>
              <NewOrderForm onCreated={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["all-orders"] }); }} createFn={createFn} />
            </DialogContent>
          </Dialog>
        </div>

        {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {q.error && <p className="text-destructive text-sm">{(q.error as Error).message}</p>}

        <div className="space-y-3">
          {q.data?.map(o => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{o.product_name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{o.tracking_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">{o.customer_name} · {o.customer_email}{o.customer_phone ? ` · ${o.customer_phone}` : ""}</p>
                </div>
                <Badge variant="secondary" className="capitalize">{o.status.replace(/_/g, " ")}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Select defaultValue={o.status} onValueChange={(v) => setStatus(o.id, v as any)}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <a className="text-xs text-primary underline inline-flex items-center gap-1" href={`/track?n=${o.tracking_number}`} target="_blank" rel="noreferrer">
                  Customer view <ExternalLink className="h-3 w-3" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewOrderForm({ onCreated, createFn }: { onCreated: () => void; createFn: ReturnType<typeof useServerFn<typeof createOrder>> }) {
  const [form, setForm] = useState({
    customer_name: "", customer_email: "", customer_phone: "",
    product_name: "", amount_cents: 0, currency: "INR",
  });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try {
          await createFn({ data: { ...form, amount_cents: Number(form.amount_cents) || 0 } });
          toast.success("Order created"); onCreated();
        } catch (e: any) { toast.error(e?.message ?? "Failed"); }
        finally { setBusy(false); }
      }}
    >
      <div><Label>Customer name</Label><Input required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
      <div><Label>Customer email</Label><Input type="email" required value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
      <div><Label>Customer phone (E.164, e.g. +15558675310)</Label><Input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
      <div><Label>Product</Label><Input required value={form.product_name} onChange={e => setForm({ ...form, product_name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Amount (cents)</Label><Input type="number" value={form.amount_cents} onChange={e => setForm({ ...form, amount_cents: +e.target.value })} /></div>
        <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create order"}</Button>
    </form>
  );
}
