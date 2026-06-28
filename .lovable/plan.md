# Next Round — Full Surface Overhaul

A themed batch across 4 surfaces. All additive layers (new `*-upgrade.css` + `*-upgrade.js` files, no rewrites of base templates). Each step is independently shippable.

## 1. Product page — conversion boosters
- **Sticky buy bar** on scroll: appears after hero leaves viewport, shows thumb + name + price + qty + "Add to cart". Hidden on desktop until scroll-past; full-width on mobile (above the safe-area inset).
- **Image gallery / thumbnails**: thumbnail strip under hero, click + arrow-key navigation, lazy-loaded. Falls back gracefully for single-image products.
- **Reviews & social proof block**: star summary (avg + count + bar chart), filter chips (5★/4★/with-photos), review cards w/ verified-buyer badge, "Helpful" vote, "recently purchased" live ticker driven by recent orders.

## 2. Home / Category — discovery polish
- **Faceted filters**: price range, brand, duration (collapsible sidebar on desktop, bottom-sheet on mobile).
- **Sort dropdown**: relevance / price ↑↓ / newest / best-selling.
- **Skeleton shimmer** while products load (instead of blank → pop-in).
- **URL-synced state** so filters survive refresh & are shareable.

## 3. Checkout — friction killers
- **Express pay row** at top: Apple Pay / Google Pay buttons (Payment Request API; gracefully hidden when unsupported).
- **Google Places address autocomplete** on the address field (single API key, debounced).
- **Inline card validation** + brand icon as user types.

## 4. Polish pass
- Bump cache-busters (`p8`, `c2`, etc.) on edited CSS/JS.
- Extend `tests/product_image_frame_test.py` style guard with a new test for the sticky buy bar (must not overlap content / must respect safe-area).

## Technical Notes
- All work in `public/` static layer (HTML + vanilla JS + CSS), matching existing `*-upgrade.*` pattern. No TanStack route changes.
- Apple/Google Pay use the browser **Payment Request API** only (no provider keys needed); if the user later wants real charges, we wire it to existing checkout backend.
- Google Places needs a `GOOGLE_PLACES_API_KEY` secret — I'll request it via `add_secret` when we reach step 3.
- Reviews ticker reads from existing orders table via a public read-only endpoint (or static seed if none exists yet — confirm in build).

## Suggested order
1 → 3 → 2 → 4 (product first since the user is actively viewing it, then checkout for revenue impact, then discovery, then polish).

Approve and I'll start with the product-page sticky buy bar + gallery.
