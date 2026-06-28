import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMyRole } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · GetOTTs" }] }),
  beforeLoad: async () => {
    try {
      const role = await getMyRole();
      if (!role.isAdmin) throw redirect({ to: "/orders" });
    } catch {
      throw redirect({ to: "/orders" });
    }
  },
  component: () => <Outlet />,
});
