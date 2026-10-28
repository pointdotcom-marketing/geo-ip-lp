# Moving geo-ip into pdc-code

Plan for moving this worker into `pdc-code/workers/` and serving its client scripts from the Point CDN (`https://files.point.com/code/`). Not started.

## Why

- Client scripts are pasted into Webflow custom code today, so every change is a manual copy and paste.
- pdc-code already builds `src/` into `dist/{staging,prod}` and deploys to R2 at `https://files.point.com/code/{env}/` on push to `staging` or `main`.
- pdc-code already pairs a worker with a client script this way: `workers/unsubscribe/` and `src/utility/unsubscribe.js` (see `pdc-code/docs/UNSUBSCRIBE-README.md`).

## Why not symlinks

Git stores a symlink as a path, and pdc-code's CI only checks out pdc-code, so a link into this repo would break the build. Keeping both halves in pdc-code removes the need for one. If this repo had to stay separate, copying built files into pdc-code would work, but a full move is simpler.

## Steps

| Step | Notes | Effort |
| --- | --- | --- |
| Move `worker.js`, `reno-costs.js`, `wrangler.toml`, `package.json` to `pdc-code/workers/geo-ip/` | Keep `name = "geo-ip-detector"` and `account_id` in `wrangler.toml`: the workers.dev URL comes from those two values, so the production address does not change. Update wrangler (this repo pins 4.7.1; unsubscribe uses ^4.151). | Small |
| Move `client.js` and `reno-client.js` into `pdc-code/src/page/` | List them in `src/page/README.md`. pdc-code's build minifies them, replacing this repo's `terser` step. | Small |
| Replace pasted code in Webflow with script tags | `<script src="https://files.point.com/code/prod/page/<file>.js"></script>`; point.dev pages load the `/staging/` path. Known location: the `/start/home-reno` page footer. Every other page or site setting that pastes `client.js` has to be found first. | Most of the work |
| Docs | Add a geo-ip section to `pdc-code/AGENTS.md` like the unsubscribe one; move `RENO_COSTS.md` and `research/` alongside the worker. | Small |
| History | Copy files and archive this repo, or keep history with `git subtree`. | Small |

Estimated total: about half a day, mostly the Webflow swap and staging checks.

## After the move

- Client scripts deploy with pdc-code's existing CI.
- The worker still deploys by hand (`bun run deploy` in `workers/geo-ip`), like the unsubscribe worker, unless a workflow is added.
- Check pdc-code's cache-busting for files.point.com before relying on instant script updates.
- Keep the rule from this repo: the `/` response is used in production, so add endpoints rather than change existing behavior.
