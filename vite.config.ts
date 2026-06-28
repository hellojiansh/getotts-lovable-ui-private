// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Dev-only: mirror the Netlify `_redirects` clean-URL rules so links like
// /login, /dashboard, /checkout work in `bun dev` the same way they do in
// production (Netlify rewrites them to the matching .html under public/).
// React routes (defined under src/routes) take precedence — this only fires
// when no TanStack route matches and the request resolves to a static .html.
const cleanUrlMap: Record<string, string> = {
  "/about": "/about.html",
  "/blog": "/blog.html",
  "/contact": "/contact.html",
  "/dashboard": "/dashboard.html",
  "/how-to-use": "/how-to-use.html",
  "/checkout": "/checkout.html",
  "/login": "/login.html",
  "/order": "/order.html",
  "/post": "/post.html",
  "/privacy": "/privacy.html",
  "/refund": "/refund.html",
  "/register": "/register.html",
  "/terms": "/terms.html",
  "/wallet": "/dashboard.html",
};

const cleanUrlDevPlugin = {
  name: "getotts-clean-url-dev-rewrite",
  configureServer(server: any) {
    server.middlewares.use((req: any, _res: any, next: any) => {
      try {
        const url = (req.url || "").split("?")[0];
        const target = cleanUrlMap[url];
        if (target) {
          const file = resolve(process.cwd(), "public" + target);
          if (existsSync(file)) {
            req.url = target + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
          }
        } else if (url.startsWith("/product/")) {
          const file = resolve(process.cwd(), "public/product.html");
          if (existsSync(file)) req.url = "/product.html" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
        } else if (url.startsWith("/category/")) {
          const file = resolve(process.cwd(), "public/category.html");
          if (existsSync(file)) req.url = "/category.html" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
        } else if (url.startsWith("/blog/")) {
          const file = resolve(process.cwd(), "public/post.html");
          if (existsSync(file)) req.url = "/post.html" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "");
        }
      } catch {}
      next();
    });
  },
};
// Avoid unused warning if the import surface ever changes.
void readFileSync;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [cleanUrlDevPlugin],
  },
});
