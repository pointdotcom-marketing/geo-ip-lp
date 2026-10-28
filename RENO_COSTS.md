# Home Reno Page Data

`reno-costs.js` is a hand-updated snapshot served by `GET /home-reno`. Nothing queries a warehouse at request time: refresh the numbers, edit the file, redeploy.

## What the page shows

| Token | Meaning | Source |
| --- | --- | --- |
| `{state}` | Visitor's state name (operating states only) | Cloudflare geo, `US_STATES` in `worker.js` |
| `{reno.avg}` | Average funded HEI for homeowners whose use of funds includes home improvement, rounded to the nearest $1,000 | Point, `ANALYTICS.MASTER_REPORTING.HEI_CONTRACTS` |
| `{homeValue.pct}` / `{homeValue.source}` | 5-year house price change, whole percent; only sent when positive | FHFA purchase-only state HPI (public domain) |

The page's "about 1 in 4 Point homeowners use their HEI for home improvements" line is static copy in Webflow: about 25% of HEIs funded Sep 2025 – Aug 2026 list home improvement.

## Point home-improvement average (snapshot 2026-10-28)

- Contracts funded 2025-09-01 to 2026-08-31 (trailing 12 months). The window ends at the last fully classified month: use-of-funds classification lags new fundings (Sep 2026 7% unclassified, Oct 2026 45%).
- Home improvement = `USE_OF_FUNDS_PRIMARY_CLASSIFICATION` or `USE_OF_FUNDS_SECONDARY_CLASSIFICATION` = `'Home Improvement'`.
- Shown only where a state has at least 30 such contracts. DC, HI and KY fall below; MA has had no fundings since Feb 2025. Those states get the page's fallback copy.
- Same method as the live state averages in `US_STATES` (trailing 12 months of `INVESTMENT_AMOUNT` by `STATE`), which were last set on 2025-09-25.
- Raw query results are internal and stay out of this public repo (`research/point/` is gitignored). Needs the same compliance review as the existing state-average claims.

## State averages on other pages (`US_STATES` in `worker.js`)

Refreshed 2026-10-28 with the same window and table, all funded HEIs, rounded to the nearest $1,000 (the values are stored rounded; the code does not round). DC (under 30 HEIs) and MA (none since Feb 2025) keep their 2025 values; KY (under 30) still has no average. Previous values were set 2025-09-25 from the 12 months before that date.

## FHFA home values

Purchase-only state index, seasonally adjusted, 2026Q2 vs 2021Q2, from `hpi_po_state.txt`. DC (-2.3%) is not shown because the copy says "rose".

## Sources considered and dropped

- **Remodeling 2025 Cost vs. Value**: per-state project costs, but its terms forbid use in a web app or database without a paid Zonda license.
- **EnergySage**: solar costs; terms forbid republishing without written permission.
- **Census American Housing Survey 2023**: public domain, but medians are far below the HEI range and most states only get regional figures. Kept for reference in `research/ahs/` (`compute_ranges.py` rebuilds it).
