#!/usr/bin/env python3
"""
Guard test: fails (exit 1) if framing styles (border, box-shadow, background,
outline, padding) reappear on the product image wrapper stack:

    .product-grid-main
    .product-media
    .product-image-large

The product image itself (`.product-image-large img`) is allowed to keep
`border-radius` and a `filter: drop-shadow(...)` because neither paints a
visible box around the wrapper.

Strategy: serve `public/` over a local HTTP server, read `product.html`
from disk, inject a `<base href>` pointing at the local server, and load
the markup via `page.set_content`. Stylesheets / fonts still resolve, but
the test does not depend on the product-data API hydrating the <img>.

Run from the repo root:
    python tests/product_image_frame_test.py
"""
import asyncio
import http.server
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

WRAPPERS = [".product-grid-main", ".product-media", ".product-image-large"]
IMG = ".product-image-large img"
TRANSPARENT = {"rgba(0, 0, 0, 0)", "transparent", "rgb(0, 0, 0, 0)"}

PROPS = [
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "outlineWidth", "outlineStyle",
    "boxShadow",
    "backgroundColor", "backgroundImage",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderRadius",
]

READ_JS = """
({sels, props}) => sels.map(sel => {
  const el = document.querySelector(sel);
  if (!el) return {sel, found: false};
  const cs = getComputedStyle(el);
  const computed = {};
  for (const p of props) computed[p] = cs[p];
  return {sel, found: true, computed};
})
"""


def violations(c, *, allow_radius=False):
    out = []
    for side in ("Top", "Right", "Bottom", "Left"):
        v = c[f"border{side}Width"]
        if v != "0px":
            out.append(f"border-{side.lower()}-width={v}")
    if c["outlineWidth"] != "0px" and c["outlineStyle"] != "none":
        out.append(f"outline={c['outlineWidth']} {c['outlineStyle']}")
    if c["boxShadow"] != "none":
        out.append(f"box-shadow={c['boxShadow']}")
    if c["backgroundColor"] not in TRANSPARENT:
        out.append(f"background-color={c['backgroundColor']}")
    if c["backgroundImage"] != "none":
        out.append(f"background-image={c['backgroundImage']}")
    for side in ("Top", "Right", "Bottom", "Left"):
        v = c[f"padding{side}"]
        if v != "0px":
            out.append(f"padding-{side.lower()}={v}")
    if not allow_radius and c["borderRadius"] != "0px":
        out.append(f"border-radius={c['borderRadius']}")
    return out


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_a, **_kw):  # silence
        return


def start_server():
    os.chdir(PUBLIC)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), QuietHandler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return port, httpd


def prepare_html(base: str) -> str:
    html = (PUBLIC / "product.html").read_text()
    html = html.replace("<head>", f'<head><base href="{base}/">', 1)
    # Reveal the product container without depending on data hydration.
    html = html.replace(
        '<div id="productContainer" style="display: none;">',
        '<div id="productContainer" style="display: block; opacity:1;">',
    )
    return html


async def main() -> int:
    port, httpd = start_server()
    base = f"http://127.0.0.1:{port}"
    html = prepare_html(base)
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})

            async def route(r):
                # Allow same-origin static assets only; block external + media.
                if r.request.url.startswith(base) and r.request.resource_type not in ("media", "font"):
                    await r.continue_()
                else:
                    await r.abort()

            await ctx.route("**/*", route)
            page = await ctx.new_page()
            await page.set_content(html, wait_until="domcontentloaded", timeout=20_000)
            # Give CSS time to apply.
            await page.wait_for_timeout(800)

            results = await page.evaluate(
                READ_JS, {"sels": WRAPPERS + [IMG], "props": PROPS}
            )
            await browser.close()
    finally:
        httpd.shutdown()

    failures = []
    for r in results:
        if not r["found"]:
            if r["sel"] == IMG:
                continue  # <img> is JS-hydrated; tolerate absence
            failures.append((r["sel"], ["element not found"]))
            continue
        v = violations(r["computed"], allow_radius=(r["sel"] == IMG))
        if v:
            failures.append((r["sel"], v))

    if failures:
        print("[FAIL] Product image framing styles detected:\n")
        for label, vs in failures:
            print(f"  {label}")
            for v in vs:
                print(f"    - {v}")
        return 1

    print("[OK] No framing styles on product image elements.")
    for r in results:
        status = "clean" if r["found"] else "absent (img hydrated by JS – skipped)"
        print(f"  - {r['sel']} {status}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
