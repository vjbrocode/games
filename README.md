# Games

Browser games, each self-contained and playable from a URL. No install, no build step.

**Play them here: https://vjbrocode.github.io/games/**

## Games

| Game | Folder | Current | Notes |
| --- | --- | --- | --- |
| [Operation Nightfall](night-infiltration/) | `night-infiltration/` | v7 | 3D stealth FPS (three.js), now in two missions — Nightfall, then Sablewind. Needs a keyboard and mouse — desktop only. |
| [Island Skydive](island-skydive/) | `island-skydive/` | v1 | Helicopter and parachute over a tropical island (three.js). Keyboard and mouse, with on-screen controls on touch devices. |

### Operation Nightfall changelog

- **v7** — Mission 1, refreshed. A gradient sky dome and a moon instead of flat fog;
  PCFSoft shadow filtering on ULTRA with a normal bias against shadow acne; **dynamic
  resolution scaling** in the frame-rate governor, which trims pixel ratio before it
  drops a quality tier and restores it once frame time recovers; a **hit-direction
  indicator** and red vignette in place of the old body flash; slow field recovery back
  up to 50% health after six seconds without damage; a compass strip and an audible hit
  tick. Passes the full suite, 152/152. **This is the current Mission 1** —
  `night-infiltration/` forwards here, and its debrief opens Mission 2.
- **v6** — v5 plus the **CONTINUE — MISSION 2** link on the debrief screen. Nothing else
  changed; kept as its own file so v5 stays exactly as it shipped.
- **Mission 2 — `stage2.html` (Operation Sablewind)** — a second, standalone game file
  and the payoff to Raines' closing brief in v5: the coastal site he warned about.
  **Kestrel Point**, a hardened launcher site dug into a cliff, with a new armoury, a
  new mission and a garrison of around forty-six. Same engine philosophy and the same
  controls, but its actors are a proper object model (`Vehicle` → `Truck`, `Launcher`;
  `Charge`; `SentryTurret`; `PatrolBoat`; `Guard`), guards turn at a human rate and walk
  by distance covered rather than sliding, and the quality governor scales resolution
  before dropping a tier. It runs standalone — bookmark `stage2.html` to jump straight
  in — and links back to Mission 1.

- **v5** — the mission is the intelligence, and the ending is a scene.
  - **Hacking the mainframe is the mission.** v4 would not let you leave until all
    nineteen demolition targets were rubble, which turned a stealth infiltration into
    a demolition derby: you took the thing you came for and were then told the job
    wasn't done until the valley was flat. Take the drive and go. The depot targets,
    the tank, the gunship and both nukes are all still there and all still work —
    they're a **bonus counted in the debrief**, not a gate. A clean in-and-out with
    the place untouched is a legitimate run, and so is leaving it a crater.
  - **The extraction is an aircraft, not a marker.** Walking into a green cylinder is
    a checkpoint, not a rescue. The moment the uplink completes, Anya calls
    **Paladin 2-1** — a tandem-rotor transport, deliberately nothing like the gunship
    you fly yourself — and you watch it run in from beyond the mountains for ninety
    seconds while you cross open ground to **LZ ROOK**, east of the wire. It flares,
    puts its wheels down, drops the ramp and waits. Stand by it and press `F`.
  - **The ending is a shot list.** Four cuts, not one slow drift: low and wide on the
    pad as she picks up; riding the open ramp looking back at the compound falling
    away; outside off the port side as she banks for the ridge; then the camera falls
    back and lets her go over the mountain ring as dawn comes up. Anya, the aircrew
    and **Col. Raines** talk over the top of it, and the Chief briefs the next job:
    the mainframe wasn't a garrison box, it was a relay, and there's a second site on
    the coast. **Operation Sablewind.**
  - **The objective line has one owner.** It used to be written by the stage change,
    by the alarm going up and by the camera net going down, each clobbering the last —
    so tripping the alarm after the hack permanently replaced "get to LZ ROOK" with
    "hold out". In v5 that line is the only thing telling you where your ride is. The
    stage owns it now; the alarm and the ETA append to it.
  - **Paladin 2-1 is a CH-47F Chinook.** The transport was a slab with two discs on the
    roof. It is now built from the shapes that actually identify one: a constant
    cross-section fuselage extruded down the length, a blunt raked nose with a two-pane
    windscreen and chin bubbles, the **sponsons** down the lower sides that carry the
    fuel and the main gear, a small forward pylon and a tall swept aft one with the two
    turboshafts slung either side, counter-rotating wide-chord heads that droop on the
    deck and cone up under load, and twin forward wheels. The cabin is cut straight
    through the fuselage, so the open ramp reveals a real red-lit bay — floor, benches,
    ribs, bulkhead — rather than an orange rectangle painted on the tail. You should be
    able to name her across a valley at night.
  - **The freeze after the hack is gone.** three.js recompiles every material in the
    scene when the light count changes, and this level has around a thousand. Every
    muzzle flash created a `PointLight`, added it, and removed it eighty milliseconds
    later — two full shader rebuilds. Every shell impact, two more. Hacking the
    mainframe is what calls in the relief column, so five tanks would start shelling
    you and the game rebuilt every shader several times a second. Measured over
    fourteen seconds of sustained explosions the old build rendered **zero frames**;
    the new one renders throughout and compiles one program. Nothing creates a light at
    runtime any more (`LightPool`), the transport parks under the valley instead of
    being hidden (an invisible subtree's lights are not counted, so revealing it
    rebuilt everything too), the relief column's tank is built once and cloned
    (`TankFactory`) rather than laid out afresh mid-firefight, the mainframe screen
    repaints ten times a second instead of sixty, explosion fireballs left their own
    `setInterval` for the frame loop, and shaders pre-compile at load.
  - **Shorter briefing, and help that arrives when it is needed.** The briefing is nine
    beats instead of twelve and every line is tighter; the dossier, the start-screen
    hook and the control reference are cut to what you have to know. The objective line
    now carries range and compass bearing — a first-time player reads "get to LZ ROOK"
    and has never heard of LZ Rook — and a `Tutor` fires seven one-shot hints, each
    tied to the moment it becomes true rather than dumped on the start screen.
  - Burying the signals bunker before you've hacked it still fails the mission, and
    matters more than it did: the intelligence is now the entire objective.

- **v4** — the sixth camera, a live map, and an object model that can let go.
  - **The storage-yard camera moved outdoors.** It used to be bracketed to the gate
    post *inside* a compound walled on all four sides and tucked behind a ridge, so
    there was no firing position anywhere in the valley from which you could see it.
    It now stands on a ten-metre lattice mast on open ground east of the yard, and
    TUNNEL HEIGHTS has a clean 77 m line onto the head — a scope shot, with the
    tree line kept clear for it and a red obstruction lamp so you can find it in the
    dark. Blinding all six without tripping the alarm is a real run now, not a
    theoretical one.
  - **Killing the alarm is permanent.** Six cameras still are the alarm system, but
    v3 only consulted them for the *first* call: blind the last one during wave two
    and waves three, four and five still crossed the ridge, which contradicted the
    objective. `AlarmNet` now latches a one-way lockout the moment the sixth camera
    dies, and every route to reinforcements — direct alert, perimeter tripwire,
    sentry radio, and the wave scheduler itself — asks it every time. Whatever has
    already crossed the ridge you still have to fight; nothing further is ever sent.
  - **The tactical tablet is real time.** v3 gated the whole simulation on the
    pointer lock, and the tablet has to release the pointer lock to be usable — so
    opening the map stopped the world and the "satellite downlink" was a photograph.
    The world now keeps running while you read it. Every contact carries a fading
    motion trail and a dashed leader showing where it will be in three seconds,
    there is a track table with bearing, range and closing speed, and the footer
    shows your condition because a sentry who can see you can still shoot you.
    Jones stands still while the map is up; he no longer walks blind if you were
    holding a key when you raised it.
  - **Objects can now be destroyed, not just created.** v3 never removed anything:
    fifty relief troops meant fifty corpses still being walked by the AI, the radar,
    the map and the detection meter for the rest of the session, with fifty models
    still resident on the GPU. v4 adds `disposeObject3D`, a `Roster` collection with
    a budget, and a build-time pass that marks shared geometry and materials so
    releasing one corpse cannot blank the material every other soldier is using.
    Bodies, wrecks and dropped kit now stay within a fixed ceiling.
  - **Graphics and performance.** A new ULTRA tier (4K shadows over a tighter box —
    roughly four times the shadow texels per metre of MEDIUM — 1.75x pixel ratio,
    16x anisotropy) that the auto-tuner only climbs to after eight seconds of
    headroom. The garrison is walked once a frame instead of twice, the CCTV wall
    repaints on a real timer instead of a coin toss on the millisecond clock, and
    dead armour has left the update loop.
  - **Map controls that hold still.** Dragging the tablet is 1:1 — the ground under
    the cursor stays under the cursor — at any zoom and regardless of how fast you
    move. The arrow keys nudge the view by an exact, repeatable step, holding
    <kbd>SHIFT</kbd> drops any pan or zoom into a quarter-speed precision gear, and
    wheel zoom is normalised by delta size so a trackpad flick behaves like a mouse
    notch instead of rocketing. A click no longer silently stops the map following
    you, and a drag released outside the frame no longer sticks to the cursor.
  - **The mainframe is no longer a dead computer.** Anya's briefing sends you to the
    signals bunker, a separate walled site 200 m north-west of the base — but
    "infiltrated" was tested only against the main compound's footprint, so a player
    who went where they were told arrived at stage 0 and the terminal simply did not
    respond: no prompt, no progress bar, no explanation. Reaching either site now
    counts, and the terminal answers on arrival by any route. Separately, the alarm
    ticked after the interaction prompts were composed and overwrote them, so a
    sentry reaching for his radio anywhere on the base wiped "HOLD E — HACK THE
    MAINFRAME" off the screen while you stood at it. The line you can act on now
    wins; the radio warning fills it only when there is nothing to act on.
  - **Housekeeping.** Two pairs of copy-pasted texture helpers collapsed into one
    each, an inline favicon so every load no longer fires a 404, and the first
    automated test suite for the game — 152 assertions against the real thing in a
    real browser; see `night-infiltration/tests/`.
- **v3** — the build v4 was developed from, never published on its own. Enlarged the
  compound and the valley around it, added the signals bunker, the mountain service
  tunnel and the rear supply yard, the six-camera alarm net and the relief column,
  the ATGM, and a tactical tablet whose base layer is the live scene rendered a
  second time through an orthographic camera. Began the conversion from one long
  script to classes.

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
│   ├── v2.html                 the game, version 2
│   ├── v3.html                 the game, version 3
│   ├── v4.html                 the game, version 4
│   ├── v5.html                 the game, version 5
│   ├── v6.html                 the game, version 6 (v5 + the Mission 2 link)
│   ├── v7.html                 the game, version 7  ← current Mission 1
│   ├── stage2.html             Mission 2 — Operation Sablewind (standalone)
│   └── tests/                  automated tests (Node + Chrome; not served to players)
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
- `night-infiltration/stage2.html` → Mission 2, Operation Sablewind
- `night-infiltration/v7.html` → v7, forever
- `night-infiltration/v6.html` → v6, forever
- `night-infiltration/v5.html` → v5, forever
- `night-infiltration/v4.html` → v4, forever
- `night-infiltration/v3.html` → v3, forever
- `night-infiltration/v2.html` → v2, forever
- `night-infiltration/v1.html` → v1, forever
- `island-skydive/` → always the current release
- `island-skydive/v1.html` → v1, forever

The folder's `index.html` is a small forwarder, not a copy of the game, so keeping old
versions around costs one file per release and nothing else.

### Releasing a new version

1. Add the new file alongside the old one, e.g. `night-infiltration/v8.html`.
2. Bump the version string inside it — it appears in three places: the `<title>`, the
   `<h1>` on the start screen, and `version:` in the `Game` object.
3. In `night-infiltration/index.html`, change the three `v7.html` references to `v8.html`
   (canonical link, meta refresh, and the no-JS fallback link).
4. Update the **Current** column and the changelog above.
5. Run the tests against the new file before you publish it:
   `cd night-infiltration/tests && node nightfall.test.js http://localhost:8899/v8.html`
   (see `night-infiltration/tests/README.md`).
6. If the release changes where the story goes next, update the forward link on the
   debrief screen (`v7.html` points at `stage2.html`) and the back link in `stage2.html`.
7. Push to `main`.

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
