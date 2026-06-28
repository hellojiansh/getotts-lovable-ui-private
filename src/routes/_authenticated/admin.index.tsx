import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAdminStats } from "@/lib/admin-api";
import { DollarSign, ShoppingBag, Users, TrendingUp, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchAdminStats });

  const cards = [
    { label: "Revenue (30d)", value: data ? `₹${data.revenue_30d.toLocaleString()}` : "—", icon: DollarSign, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Orders (30d)", value: data?.orders_30d.toLocaleString() ?? "—", icon: ShoppingBag, tone: "text-blue-600 bg-blue-50" },
    { label: "New customers", value: data?.new_customers_30d.toLocaleString() ?? "—", icon: Users, tone: "text-violet-600 bg-violet-50" },
    { label: "Conv. rate", value: data ? `${data.conversion_rate}%` : "—", icon: TrendingUp, tone: "text-amber-600 bg-amber-50" },
    { label: "Pending orders", value: data?.pending_orders ?? "—", icon: Clock, tone: "text-orange-600 bg-orange-50" },
    { label: "Low stock", value: data?.low_stock ?? "—", icon: AlertTriangle, tone: "text-red-600 bg-red-50" },
  ];

  return (
    <AdminShell title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-lg grid place-items-center mb-3 ${c.tone}`}>
                <c.icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
              <p className="text-xl md:text-2xl font-bold mt-0.5">{isLoading ? "…" : c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h2 className="font-semibold mb-2">Wiring guide for Codex</h2>
          <p className="text-sm text-muted-foreground mb-3">
            All admin reads/writes route through <code className="bg-muted px-1 py-0.5 rounded text-xs">src/lib/admin-api.ts</code>.
            Each function is a stub returning mock data with a <code>TODO(codex)</code> marker — swap the body with a fetch to your VPS.
            Auth: pull <code>access_token</code> from Supabase and send as <code>Authorization: Bearer &lt;token&gt;</code>; the VPS verifies it against Supabase JWKS.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            <li>Set <code>VITE_VPS_API_BASE</code> in your environment.</li>
            <li>Bulk importer commit signature: <code>(rows) =&gt; {`{`} inserted, updated {`}`}</code>.</li>
            <li>Orders page already uses Supabase server functions — keep or migrate as you prefer.</li>
          </ul>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
