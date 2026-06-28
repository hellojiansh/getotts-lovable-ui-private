import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyOrders } from "@/lib/orders.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My orders" }] }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const fetchMine = useServerFn(getMyOrders);
  const q = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchMine() });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">My orders</h1>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); location.href = "/auth"; }}>Sign out</Button>
        </div>

        {q.isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {q.error && <p className="text-destructive text-sm">{(q.error as Error).message}</p>}

        {q.data && q.data.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No orders yet.</CardContent></Card>
        )}

        <div className="space-y-3">
          {q.data?.map(o => (
            <Card key={o.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{o.product_name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{o.tracking_number}</p>
                </div>
                <Badge variant="secondary" className="capitalize">{o.status.replace(/_/g, " ")}</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {(o.amount_cents / 100).toLocaleString(undefined, { style: "currency", currency: o.currency || "INR" })} ·
                  Placed {new Date(o.created_at).toLocaleDateString()}
                </p>
                <Link to="/track" search={{ n: o.tracking_number }} className="text-sm text-primary underline">Track</Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
