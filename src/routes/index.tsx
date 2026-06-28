import { createFileRoute, redirect } from "@tanstack/react-router";

// The full GetOTTs storefront UI lives as static files under /public.
// Redirect the root URL to the storefront's index.html entry point.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/index.html" });
  },
  component: () => null,
});
