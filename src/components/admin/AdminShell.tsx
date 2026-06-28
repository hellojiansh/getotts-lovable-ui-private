import { Link, useRouterState } from "@tanstack/react-router";
import { ReactNode } from "react";
import { LayoutDashboard, Package, ShoppingBag, Ticket, ExternalLink, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/coupons", label: "Coupons", icon: Ticket },
  { to: "/admin/perf", label: "Performance", icon: Gauge },
];

export function AdminShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        {/* Sidebar — collapses to icons on tablet, hidden on phone */}
        <aside className="hidden md:flex md:w-16 lg:w-60 shrink-0 flex-col border-r bg-background sticky top-0 h-screen">
          <div className="h-14 flex items-center px-4 border-b">
            <Link to="/admin" className="font-bold text-sm flex items-center gap-2">
              <span className="inline-grid place-items-center h-7 w-7 rounded-md bg-primary text-primary-foreground text-[11px] font-black">GO</span>
              <span className="hidden lg:inline">Admin</span>
            </Link>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {NAV.map((n) => {
              const active = n.exact ? path === n.to : path.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline truncate">{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-2 border-t">
            <a href="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2">
              <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden lg:inline">View site</span>
            </a>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Topbar */}
          <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b">
            <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold truncate">{title}</h1>
              </div>
              <div className="flex items-center gap-2">{actions}</div>
            </div>
          </header>

          {/* Mobile pill nav */}
          <nav className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 border-b bg-background scrollbar-hidden">
            {NAV.map((n) => {
              const active = n.exact ? path === n.to : path.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <n.icon className="h-3.5 w-3.5" /> {n.label}
                </Link>
              );
            })}
          </nav>

          <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
