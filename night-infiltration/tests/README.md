# Operation Nightfall — automated tests

The game is a single self-contained HTML file with no build step. These tests
are the exception: they drive the real thing in a real browser and assert
against the live world, so they need Node and a Chrome you already have.

Nothing here is served to players. The game does not import it, and deleting
this folder does not affect the game.

## Running them

```sh
# 1. serve the game (the tests need http:// — three.js is loaded from a CDN)
cd ..
python3 -m http.server 8899

# 2. in another terminal
cd tests
npm install
npm test                        # defaults to http://localhost:8899/v5.html
node nightfall.test.js http://localhost:8899/v4.html   # or any other build
```

`CHROME` at the top of `nightfall.test.js` points at the macOS Chrome path;
change it if yours is elsewhere.

## What they cover

Each numbered block gets a fresh page, because several of the things under test
are deliberately one-way and cannot share a world.

| # | Block | What it proves |
| --- | --- | --- |
| 1 | Boot and structure | The page loads, reports v4, builds six cameras and the garrison, and wires the `Game` registry. |
| 2 | CAM-6 is outdoors and snipeable | The sixth camera is outside the storage-yard walls, up a mast, with a clear line from TUNNEL HEIGHTS — verified by raycast **and** by reading what the game's own scope rangefinder says is under the reticle. |
| 3 | Six down = alarms permanently off | Five down still arms; the sixth latches the lockout, and every route to an alarm (direct raise, tripwire, sentry radio, wave scheduler) then refuses. No tanks, no infantry, ever. |
| 4 | Blinding the net mid-fight | Cutting the net during wave 1 stops waves 2–5 for good. |
| 5 | The column still arrives if you let it | With the net intact all five waves and fifty troops dispatch, so the lockout is a real choice and not a broken scheduler. |
| 6 | The tac map is real-time | The world keeps simulating while the tablet is open, enemies actually move, contacts carry bounded position history and live velocity, the downlink produces frames — and Jones does not drift when a key is held. |
| 7 | No unbounded growth | Hundreds of guards and tanks are created and killed; corpses, wrecks and dropped kit stay inside their budgets and the GPU object counts do not run away. |
| 8 | Shared resources survive disposal | Releasing a corpse does not dispose the cached geometry and materials every other soldier is using. |
| 9 | Gameplay flow end to end | Stage 0 → infiltrate → hack the mainframe → Paladin 2-1 is called and flies in → it lands at LZ ROOK and drops the ramp → board it → the extraction sequence plays → debrief. Asserts the whole run completes with **nothing destroyed**. |
| 9b | The depot is optional, not removed | Every demolition target still exists and still destroys, but levelling the lot neither ends the mission nor calls the ride. |
| 9c | The old beacon ending is gone | Standing on the LZ marker on foot does not end the mission; you have to wait for the aircraft and board it. |
| 9d | Burying the mainframe still fails | Destroying the signals bunker before hacking it is still a mission failure, with the reason explained. |
| 10 | Sustained run | Fifteen seconds under a full alarm with no page errors and capped particles. |
| 11 | Graphics tiers | All four tiers apply cleanly, shadow sharpness rises tier over tier, tone mapping / sRGB / timed shadow refresh are on. |
| 12 | No duplicated helpers | The two pairs of copy-pasted texture helpers really were collapsed to one each, and both still work. |
| 13 | Map controls | Panning is 1:1 at every zoom and independent of how many move events arrive (the guard against the compounding-drag bug), shift is a quarter-speed gear, a click does not drop tracking, releasing outside the canvas ends the drag, wheel zoom is normalised so a trackpad burst matches a mouse notch, and arrow keys pan an exact repeatable step. |
| 14 | The mainframe answers by any route | Going straight to the signals bunker — which is outside the main compound, and where the briefing sends you — still lets you hack the terminal, and a sentry keying his radio does not wipe the HOLD E prompt off the screen. |

## Mission 2 — `stage2.html` (Operation Sablewind)

`stage2.html` is a second, standalone game file: same engine philosophy, same
controls, a new coastal map (Kestrel Point), a new armoury and a new mission.
It is not driven by these tests yet. `v6.html` is v5 plus a **CONTINUE — MISSION 2**
link on the debrief screen (nothing else changed), and `index.html` now forwards
to v6. The old builds (v1–v5) are untouched.

A quick smoke check for stage 2 from the console of a running game:

```js
Game.version            // "sablewind-2"
Game.guards.length      // the garrison (~46 at load)
Game.plantAll(); Game.hack(); Game.detonate();   // drives the whole mission
Game.exfil.t = 149;     // fast-forwards Paladin 2-1 onto the pad
```

## v7 — Mission 1, refreshed

`v7.html` is v6 (v5 + the Mission 2 link) with: a gradient sky dome and moon,
PCFSoft shadow filtering on ULTRA and a normal bias against shadow acne, dynamic
resolution scaling in the frame-rate governor (pixel ratio is trimmed before a
tier is dropped, and restored when the frame time recovers), a hit-direction
indicator and red vignette instead of the body box-shadow flash, slow field
recovery up to 50% health after six seconds without damage, a compass strip and
an audible hit tick. `index.html` forwards to v7. It passes this whole suite
(152/152, same as v5):

```sh
node nightfall.test.js http://localhost:8899/v7.html   # the version check in block 1 expects "v5"; set it to "v7"
```

## Stage 2 v2 — object model and models

Stage 2's actors are classes now (`Vehicle` → `Truck`, `Launcher`; `Charge`;
`SentryTurret`; `PatrolBoat`; `Guard` was already one): the constructor builds
the model and registers it with the world, `update(dt)` is called from the main
loop, `damage()`/`destroy()`/`sink()` are the only ways they get hurt. The
trucks and the launcher chassis are Nightfall's M939 model (real wheels, glass,
cab interior); the launcher adds a fourth axle, outriggers, an erector and four
tubes; a planted charge is a `Charge` stuck to the launcher's fuel tank with a
blinking LED. Guards turn at a human rate and their gait is driven by distance
covered (no more sliding or snapping), the camera no longer adds recoil drift or
per-frame shake noise, and the quality governor scales resolution before it
drops a tier and never recompiles shaders for a resolution step.
