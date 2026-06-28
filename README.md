# GetOTTs UI Handoff

Private UI handoff repo for Lovable AI.

## What Is Included

- `public/` - production static frontend pages, CSS, JS, images, videos, Netlify config, sitemap, robots, and headers.
- `admin-ui/templates/` - FastAPI/Jinja admin page templates for design/reference work.
- `admin-ui/static/` - admin dashboard CSS, JS, and UI assets.

## What Is Not Included

- Backend Python API source, database migrations, deployment archives, VPS scripts, test dumps, screenshots, local caches, and credentials.
- Live API keys are replaced with placeholders in:
  - `public/js/config.js`
  - `admin-ui/static/js/config.js`

## How To Preview Public UI

From the repo root:

```bash
cd public
python -m http.server 4173
```

Open:

```text
http://localhost:4173
```

## Lovable Notes

Use `public/index.html` as the main customer storefront entry point. Product, category, checkout, order, dashboard, blog, legal, and support pages are all static HTML/CSS/JS files under `public/`.

Admin dashboard UI is present for reference under `admin-ui/`, but it expects the live backend/session system when used as an actual admin app.
