# Deploying Vesper Drift (Cloudflare Pages)

The game is a static site: `npm run build` writes it to `dist/`, Cloudflare Pages serves that folder. It runs standalone at
`https://play.r7orbit.io/` and can be framed by `https://r7orbit.io` and `https://www.r7orbit.io`.

## Cloudflare Pages settings

Create the project with **Workers & Pages > Create > Pages > Connect to Git** and pick this repository.

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(leave empty, the repo root)* |
| Environment variable | `NODE_VERSION` = `22` (the build uses only Node built-ins; `package.json` asks for Node >= 22) |
| Custom domain | `play.r7orbit.io` |

There are no npm dependencies, so there is nothing to install and no lockfile is needed.

## Manual steps for the author

1. Cloudflare dashboard: create the Pages project as above and run the first deploy. Confirm it builds
   (`build: dist/ ready: 70 files, ~4.5 MiB`) and that `https://<project>.pages.dev/` loads the game.
2. Project > **Custom domains > Set up a custom domain** > `play.r7orbit.io`.
   - If the `r7orbit.io` zone is on Cloudflare, accept the DNS record it offers (a proxied CNAME `play` to `<project>.pages.dev`).
   - If DNS is somewhere else, add `CNAME play -> <project>.pages.dev` there and wait for the certificate to become active.
3. On the r7orbit.io site, add the iframe (snippet below). If that site sends its own `Content-Security-Policy`, its
   `frame-src` (or `child-src`) must allow `https://play.r7orbit.io`.
4. After the first deploy, open `https://play.r7orbit.io/` directly, then the page that embeds it, and run the checklist at the end.

### Embed snippet

```html
<iframe src="https://play.r7orbit.io/" title="Vesper Drift" loading="lazy"
        style="width:100%; aspect-ratio:16/9; border:0; background:#070914"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        allow="fullscreen; autoplay" allowfullscreen></iframe>
```

What the iframe needs, and what it does not:

| Needed | Why |
|---|---|
| `allow-scripts` | It is a JavaScript game. |
| `allow-same-origin` | Without it the frame gets an opaque origin: ES modules (which are fetched with CORS) fail to load, and settings in `localStorage` are lost. |
| `allowfullscreen` (or `allow="fullscreen"`) | Fullscreen is **not** a sandbox flag. **`allow-fullscreen` is not a valid sandbox token**: Chrome logs "'allow-fullscreen' is an invalid sandbox flag" and ignores it. The game has no fullscreen button today, so this only matters if the host page adds one (`iframe.requestFullscreen()`). |
| `allow-pointer-lock` | Harmless but unused: the game never calls the Pointer Lock API (steering is "hold the pointer to thrust toward it"). |
| Not needed | `allow-popups`, `allow-forms`, `allow-modals`, `allow-top-navigation`. `allow="autoplay"` is also not needed: audio starts on the first click or key press inside the frame, which counts as a user gesture. |

Give the frame a real size (the game fills the iframe and follows its resizes). A first click inside the frame gives it
keyboard focus; the title screen's "Initiate drift" button is that click. Until then, keys go to the host page.

## What `npm run build` does

`tools/build.mjs` (Node built-ins only) produces:

```
dist/
  index.html                    game page; import map and script tag point at the hashed folder
  assets/<hash>/src/            every game module (demo pages and *.md are left out)
  assets/<hash>/vendor/three/   only the Three.js files the game imports, plus LICENSE
  og-image.png                  copy of docs/video/brand-kit/screenshots/07-hud-black-hole.png (1.7 MiB)
  404.html, _headers            from deploy/
```

- Gameplay code is copied byte for byte. The only rewrites are the two paths in `index.html`.
- Nothing from `docs/`, `video/`, `tests/`, `tools/` or `.r7/` is shipped. The one file read from `docs/video/` is the
  og-image above, so keep that screenshot (or change `OG_SOURCE` in `tools/build.mjs`).
- The build fails if an import does not resolve, resolves with the wrong letter case (Windows accepts it, Cloudflare's
  Linux does not) or points outside what it ships, and if any file is over Pages' 25 MiB limit.
- `<hash>` is a content hash of everything in the folder, so `_headers` can mark `/assets/*` as `immutable`. `index.html`
  is always revalidated, so a new deploy is picked up on the next load.
- `404.html` turns off Pages' single-page-app fallback, so a wrong URL is a real 404 instead of the game page.

## `_headers`

`deploy/_headers` is copied to `dist/_headers`:

- `Content-Security-Policy: frame-ancestors 'self' https://r7orbit.io https://www.r7orbit.io` on every file. Other
  sites cannot frame the game. No `X-Frame-Options` is sent (it cannot express an allow-list and would conflict).
  That is the whole CSP: no `script-src`, so the import map and WebGL work unchanged.
- `/assets/*`: `public, max-age=31536000, immutable`. `/` and `/index.html`: `max-age=0, must-revalidate`. `/og-image.png`: one day.
- `nosniff` and `strict-origin-when-cross-origin` as basic hygiene.

Pages' per-deployment URLs (`<hash>.<project>.pages.dev`) and branch previews send the same CSP, so **r7orbit.io cannot
frame a preview**. Open previews directly in a tab.

## Developer tools in the public build

The Dev start button, the backtick developer menu and the `?stage=` / `?form=` jumps are only active on `localhost` or
with `?dev=1` in the URL (`src/main3d.js`, `devOn`). On `play.r7orbit.io` a visitor sees none of it. `?debug=emitters`
(a render overlay) and `window.__vd` (console access to the sim) still exist but are not visible or linked.

## Test a build locally

```
npm run build
npx serve dist          # or: python -m http.server 8000 --directory dist
```

`localhost` has the dev tools on, so to see what the public sees, open the page through another host name
(for example `http://127.0.0.2:8000/` on Windows/Linux). The local servers do not apply `_headers`; the headers only
exist on Cloudflare.

## Checklist after a deploy

- `https://play.r7orbit.io/` shows the title screen; the browser console has no errors.
- No "Dev start" button on the title screen; `https://play.r7orbit.io/?dev=1` shows it.
- The embedding page shows the game; click it, steer with the mouse and WASD, sound starts after the click.
- `curl -sI https://play.r7orbit.io/ | grep -i content-security-policy` shows the `frame-ancestors` line.
- A page on any other origin that frames the game gets a blocked frame.
- Resizing the browser window or the iframe resizes the game.
