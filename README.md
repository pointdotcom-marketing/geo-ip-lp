# Geo IP Landing Page

> **Moved:** this worker now lives in pdc-code at `workers/geo-ip/` and deploys from there (PNT-1375). Make changes there; this repo is kept for history until it's archived.

Geo-location detection service using Cloudflare Workers to dynamically personalize landing page content based on visitor's US state location.

## Usage

### Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start local development (http://localhost:8787)
npm run deploy       # Deploy to Cloudflare Workers
```

### Integration Steps

1. **Deploy Worker**: Run `npm run deploy` to deploy the geo-detection service
2. **Client scripts**: live in pdc-code (`src/page/start/geo-lp.js` and `src/page/start/geo-reno.js`), served from `https://files.point.com/code/{staging,prod}/page/start/`. Each /start page's footer custom code loads one with a `<script src>` tag.

## Architecture

- **worker.js**: Cloudflare Worker handling geo-detection via `request.cf.region` API
- **Client scripts**: in pdc-code `src/page/start/` (see above)
- **wrangler.toml**: Worker configuration (name: geo-ip-detector)

## Home Reno Page (`/start/home-reno`)

Separate endpoint; the original `/` response is untouched.

- **Endpoint**: `GET /home-reno` returns `{ stateAbbr, stateName, tokens }` with tokens `state`, `reno.avg`, `homeValue.pct`, `homeValue.source`. Outside operating states it returns `stateName: null` and no tokens. `?state=CO` previews a state.
- **Data**: `reno-costs.js` is a hand-updated snapshot; method and sources are in `RENO_COSTS.md`.
- **Client**: pdc-code `src/page/start/geo-reno.js`, loaded from the CDN in the page's footer custom code. An element with `data-geo-template` gets that text with `{token}`s filled in; if any token is missing it shows `data-geo-fallback` instead. `data-geo-group` on a wrapper makes its templated children switch together.
- **QA**: add `?geo-state=CO` to the page URL to preview a state, or `?geo-state=TX` to see fallbacks. Responses are cached for an hour.

| Element | `data-geo-template` | `data-geo-fallback` |
| --- | --- | --- |
| H1 | `Renovate your {state} home with your equity.` | `Renovate your home with your equity.` |
| Projects intro | `{state} homeowners who used Point for home improvements received {reno.avg} on average. With an HEI, ...` | `About 1 in 4 Point homeowners use their HEI for home improvements. With an HEI, ...` |
| Closing stat | `Home values in {state} rose {homeValue.pct} over the past 5 years ({homeValue.source}). 30,000+ homeowners have used Point.` | `30,000+ homeowners have used Point.` |

## Environment Variables

No environment variables required. Configuration is handled through:
- `WORKER_URL` and DOM selectors in the pdc-code client scripts

## Assumptions & Trade-offs

- **Assumptions**: Cloudflare's geo-detection is accurate; visitor allows cross-origin requests
- **Trade-offs**: Client-side rendering may cause brief flash of default content
- **Limitations**: US states only; requires Cloudflare Workers; 1-hour cache may delay updates

## Monitoring

- **Development**: `npm run dev` provides local logs at http://localhost:8787
- **Production**: `wrangler tail` streams live logs from deployed worker
- **Client Logs**: Errors sent to worker's `/log` endpoint (silent fail on logging errors)

## Customization

- **Headlines**: Edit state content mappings in `worker.js` (lines 45-56)
- **Target Elements**: Update selectors in pdc-code `src/page/start/geo-lp.js`
- **Cache Duration**: Modify `max-age` in worker.js response headers (default: 3600s)
