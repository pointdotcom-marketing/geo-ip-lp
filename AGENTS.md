# Agent Operating Instructions - geo-ip-lp

## Build & Development Commands
```bash
npm install          # Install dependencies
npm run dev          # Start Wrangler dev server (localhost:8787)
npm run deploy       # Deploy to Cloudflare Workers
wrangler tail        # Stream logs from deployed worker
```

## Code Style & Conventions
- **Language:** JavaScript (ES6+ modules for Worker, IIFE for client)
- **Formatting:** 2-space indentation, semicolons required, double quotes for strings
- **Variables:** camelCase for functions/variables, UPPER_SNAKE_CASE for constants
- **Error Handling:** Use try-catch blocks, fail gracefully with console.error
- **Comments:** Remove console.log statements before production, keep minimal inline comments
- **Functions:** Small, composable functions with descriptive names (e.g., `generateHeadline`, `getStateContent`)
- **Data:** Use const objects/arrays for static data, reduce/map for transformations

## Project Structure
- `worker.js` - Cloudflare Worker (ES6 modules, handles geo-detection & CORS)
- `client.js` - Client-side script (IIFE pattern, updates DOM based on geo data)
- `reno-costs.js` - Hand-updated state data for the `/home-reno` endpoint (method in `RENO_COSTS.md`)
- `reno-client.js` - Client script for /start/home-reno (fills `data-geo-template` elements)
- `wrangler.toml` - Worker configuration (name: geo-ip-detector)
- The `/` response is used in production: add new endpoints, don't change existing behavior

## Important Notes
- Always update `WORKER_URL` in client.js after deployment
- Follow Cursor rules in `.cursor/rules/` for workflow, testing, and code quality
- Use innerHTML for headline updates (content contains HTML tags)
- Cache responses with `Cache-Control: max-age=3600` (1 hour)

## Subagents

- Security Agent: Specialized agent for security auditing and hardening
- Accessibility Agent: Specialized agent for accessibility auditing and WCAG compliance
- CodeRabbit Agent: Specialized agent for automated code reviews using CodeRabbit CLI

## Cursor Rules (.cursor/rules/)

Follow applicable cursor rules and the PLAN→CODE→TESTS→NOTES workflow, strict typing, validate inputs, handle errors, focused diffs, small composable functions.