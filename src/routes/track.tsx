import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getOrderByTracking } from "@/lib/orders.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Truck, Package, XCircle, Loader2 } from "lucide-react";

const Search = z.object({ n: z.string().optional() });

export const Route = createFileRoute("/track")({
  validateSearch: Search,
  head: () => ({ meta: [{ title: "Track your order" }, { name: "description", content: "Live status updates for your order." }] }),
  component: TrackPage,
});

const STATUS_STEPS = [
  { key: "pending", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Being prepared" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];
const TERMINAL_BAD = ["cancelled", "refunded", "failed"];

function statusIndex(s: string) { return STATUS_STEPS.findIndex(x => x.key === s); }

function TrackPage() {
  const search = useSearch({ from: "/track" });
  const fetchOrder = useServerFn(getOrderByTracking);
  const [input, setInput] = useState(search.n ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof fetchOrder>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup(num: string) {
    if (!num) return;
    setLoading(true); setError(null);
    try {
      const r = await fetchOrder({ data: { trackingNumber: num.trim() } });
      setResult(r);
      if (!r.order) setError("No order found for that tracking number.");
    } catch (e: any) {
      setError(e?.message ?? "Lookup failed");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (search.n) lookup(search.n); /* eslint-disable-next-line */ }, []);

  // Realtime subscribe when we have an order
  useEffect(() => {
    if (!result?.order?.id) return;
    const oid = result.order.id;
    const ch = supabase
      .channel(`order-${oid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `id=eq.${oid}` }, () => {
        lookup(result.order!.tracking_number);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${oid}` }, () => {
        lookup(result.order!.tracking_number);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.order?.id]);

  const order = result?.order;
  const history = result?.history ?? [];
  const currentIdx = order ? statusIndex(order.status) : -1;
  const isBad = order && TERMINAL_BAD.includes(order.status);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Track your order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter the tracking number from your confirmation email or WhatsApp.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); lookup(input); }}
          className="mt-6 flex gap-2"
        >
          <Input
            placeholder="e.g. TR-XXXXXXXXXX"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono"
          />
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Track"}
          </Button>
        </form>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {order && (
          <Card className="mt-8">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{order.product_name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground font-mono">{order.tracking_number}</p>
                </div>
                <Badge variant={isBad ? "destructive" : "secondary"} className="capitalize">
                  {order.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!isBad ? (
                <ol className="relative space-y-4">
                  {STATUS_STEPS.map((step, i) => {
                    const done = i <= currentIdx;
                    const active = i === currentIdx;
                    return (
                      <li key={step.key} className="flex items-start gap-3">
                        {done ? (
                          <CheckCircle2 className={`h-5 w-5 mt-0.5 ${active ? "text-primary" : "text-green-500"}`} />
                        ) : (
                          <Circle className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{step.label}</p>
                          {active && <p className="text-xs text-muted-foreground">In progress</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  <p className="text-sm font-medium capitalize">Order {order.status}</p>
                </div>
              )}

              {(order.carrier || order.shipment_tracking_url) && (
                <div className="mt-6 rounded-md border bg-muted/40 p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium"><Truck className="h-4 w-4" /> Shipping</p>
                  {order.carrier && <p className="mt-1 text-muted-foreground">Carrier: {order.carrier}</p>}
                  {order.shipment_tracking_url && (
                    <a href={order.shipment_tracking_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Open carrier tracking</a>
                  )}
                </div>
              )}

              {history.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Package className="h-4 w-4" /> History</h3>
                  <ul className="mt-2 space-y-2">
                    {history.map(h => (
                      <li key={h.id} className="text-xs text-muted-foreground flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                        <div>
                          <span className="capitalize font-medium text-foreground">{h.status.replace(/_/g, " ")}</span>
                          {h.message && <p className="mt-0.5">{h.message}</p>}
                        </div>
                        <time>{new Date(h.created_at).toLocaleString()}</time>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
