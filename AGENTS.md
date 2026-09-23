# AGENTS.md - geo-ip-lp

Cloudflare Worker (`geo-ip-detector`) that reads the visitor's location from
`request.cf` and returns state-specific landing-page copy as JSON, plus a
browser script (`client.js`) that is pasted into Webflow custom code to fetch
that JSON and rewrite page elements. Plain JavaScript, no build step for the
worker, no tests.

## Layout

- `worker.js` - the Worker (ES module). `US_STATES` holds state codes, names,
  and `avgAmount`; `generate*Headline` / `addStateAvgFootnote` are the copy
  templates; `STATE_CONTENT` is the lookup keyed by code and uppercase name.
  `fetch` routes: `OPTIONS` (CORS preflight), `POST /log-error`, `POST /log`,
  and everything else returns the geo JSON.
- `client.js` - IIFE pasted into Webflow. `WORKER_URL` and the `*_SELECTOR`
  constants are at the top. Sends info logs to `/log` and errors to
  `/log-error`.
- `wrangler.toml` - Worker name `geo-ip-detector`, `main = "worker.js"`,
  observability enabled. No bindings, no env vars.
- `tsconfig.json` (worker, `@cloudflare/workers-types`) and
  `tsconfig.client.json` (client, DOM lib) - JSDoc typecheck only, `noEmit`.
- `local-docs/geo-ip-lp.md` - older long-form notes; partly stale (mentions
  `STATE_HEADLINES` etc. that no longer exist). Trust the code.
- `.github/workflows/ci.yml` - runs `npm ci` + `npm run check` on PRs and
  pushes to `main`.

## Verify

```bash
npm ci
npm run check    # tsc on worker.js + client.js, then node --check on both
```

`npm run typecheck` runs just the two `tsc` passes.

## Run locally

```bash
npm run dev      # wrangler dev, http://localhost:8787
npm run build    # terser client.js -> dist/client.min.js (gitignored)
```

`request.cf` is populated by `wrangler dev`, so local responses reflect your
own location. The `?path=` query param stands in for the page path (the
client sends it; the worker also checks `Referer`).

## Conventions and gotchas

- Types are JSDoc only. Keep `npm run check` at zero errors; don't convert to
  TypeScript or add a bundler.
- `client.js` must stay a self-contained IIFE with no imports: it is copied by
  hand into Webflow. Changing it in the repo does nothing until someone pastes
  it into the site.
- Headlines are HTML (`<br>`, `<span class="headline-underline-decoration">`)
  and are written with `innerHTML` on the client.
- Path variants: `/start/united-states` swaps 600k for 750k and uses the
  alternate social-proof line; `/start/usa/hea` suppresses the headline;
  `/avg` uses `avgPageHeadline`. Footnote is suppressed on both `/start/...`
  variants.
- States without `avgAmount` (e.g. `KY`) get a headline but null
  `avgHeadline` / `footnote`; the client falls back to default text.
- Route matching is `request.url.includes(...)`, so `/log-error` must be
  checked before `/log`.
- Responses are cached for 1 hour (`Cache-Control: max-age=3600`).
- Formatting: 2-space indent, double quotes, semicolons (no formatter is
  configured; `.prettierignore` exists but prettier is not installed).

## Do not run

These deploy or touch production. Do not run them unless the user explicitly
asks:

- `npm run deploy` / `wrangler deploy` - deploys the live `geo-ip-detector`
  Worker used by point.com landing pages.
- `wrangler tail` - streams production logs, which include visitor IP and
  postal code (PII). Don't paste its output into chats or PRs.
- Any `wrangler secret`, `wrangler rollback`, or `wrangler versions deploy`.
