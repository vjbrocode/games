# Games

Browser games, each self-contained and playable from a URL. No install, no build step.

**Play them here: https://vjbrocode.github.io/games/**

## Games

| Game | Folder | Current | Notes |
| --- | --- | --- | --- |
| [Operation Nightfall](night-infiltration/) | `night-infiltration/` | v2 | 3D stealth FPS (three.js). Needs a keyboard and mouse — desktop only. |
| [Island Skydive](island-skydive/) | `island-skydive/` | v1 | Helicopter and parachute over a tropical island (three.js). Keyboard and mouse, with on-screen controls on touch devices. |

### Operation Nightfall changelog

- **v2** — fixed a start screen that was unusable on smaller displays: the briefing
  button sat below the fold with no way to scroll to it, so players could not get past
  the first page. Trimmed the wall of text to a short hook plus the eight keys you need,
  moved the full reference behind a collapsible panel, added the missing mobile viewport
  tag, and made the briefing screen fit short viewports too.
- **v1** — first public release.

### Island Skydive changelog

- **v1** — first public release.

## Repo layout

```
.
├── index.html                  landing page — lists every game
├── night-infiltration/
│   ├── index.html              stable entry point → forwards to current version
│   ├── v1.html                 the game, version 1
│   └── v2.html                 the game, version 2  ← current
├── island-skydive/
│   ├── index.html              stable entry point → forwards to current version
│   └── v1.html                 the game, version 1  ← current
└── .github/workflows/
    └── deploy-pages.yml        publishes the repo root to GitHub Pages
```

Every game lives in its own folder and is served at `/<folder>/` — e.g.
`https://vjbrocode.github.io/games/night-infiltration/`.

## Versioning

Each release is its own file, `vN.html`, and **older versions are never deleted or
overwritten** — every one stays playable at its own permanent URL:

- `night-infiltration/` → always the current release (share this one)
- `night-infiltration/v2.html` → v2, forever
- `night-infiltration/v1.html` → v1, forever
- `island-skydive/` → always the current release
- `island-skydive/v1.html` → v1, forever

The folder's `index.html` is a small forwarder, not a copy of the game, so keeping old
versions around costs one file per release and nothing else.

### Releasing a new version

1. Add the new file alongside the old one, e.g. `night-infiltration/v3.html`.
2. Bump the version string inside it — it appears in three places: the `<title>`, the
   `<h1>` on the start screen, and `version:` in the `GAME` object.
3. In `night-infiltration/index.html`, change the three `v2.html` references to `v3.html`
   (canonical link, meta refresh, and the no-JS fallback link).
4. Update the **Current** column and the changelog above.
5. Push to `main`.

## Adding a game

1. Create a folder at the repo root, e.g. `my-game/`.
2. Put the first release in it as `v1.html`, plus any assets it needs — reference them
   with **relative** paths (`./sprites/x.png`, never `/sprites/x.png`, which breaks
   under the `/games/` path prefix).
3. Copy `night-infiltration/index.html` into the new folder as its forwarder.
4. Add one entry to the `GAMES` array near the bottom of the root `index.html`.
5. Add a row to the table above.
6. Commit and push to `main` — the deploy runs automatically.

## Running locally

Opening `index.html` straight off disk mostly works, but a local server matches what
Pages actually serves:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`, which publishes the
repo root as-is. This requires **Settings → Pages → Source: GitHub Actions** to be set
once in the repository settings.
