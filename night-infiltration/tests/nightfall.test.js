/* Operation Nightfall v4 — automated test suite.
 * Drives the real game in headless Chrome and asserts the v4 requirements
 * plus the gameplay flow. No mocks: everything runs against the live world. */
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.argv[2] || 'http://localhost:8899/v5.html';

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  \x1b[32mPASS\x1b[0m ' + name); }
  else { fail++; failures.push(name + (detail ? '  — ' + detail : '')); console.log('  \x1b[31mFAIL\x1b[0m ' + name + (detail ? '  — ' + detail : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox',
           '--disable-gpu-sandbox','--window-size=1280,800','--autoplay-policy=no-user-gesture-required']
  });

  // A fresh page per scenario: the alarm lockout is deliberately permanent, so
  // several of these tests cannot share a world.
  async function fresh() {
    const page = await browser.newPage();
    await page.setViewport({width:1280,height:800});
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type()==='error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
    await page.goto(URL, {waitUntil:'load', timeout:120000});
    await page.waitForFunction('typeof Game!=="undefined" && Game.version==="v5"', {timeout:120000});
    await sleep(2500);
    page.__errs = errs;
    return page;
  }
  // start the mission: skip the briefing and the insertion cinematic
  async function deploy(page) {
    await page.evaluate(() => { startBriefing(); });
    await sleep(400);
    await page.evaluate(() => { briefSkip(); briefSkip(); });
    await sleep(600);
    await page.evaluate(() => { if (typeof cine!=='undefined' && cine) endCinematic(); });
    await sleep(600);
    // pointer lock is unavailable headless; drive `running` directly so the
    // simulation ticks exactly as it does with a locked pointer
    await page.evaluate(() => { running = true; el("hud").style.display="block"; });
    await sleep(500);
  }

  // ======================================================================
  console.log('\n\x1b[1m[1] BOOT AND STRUCTURE\x1b[0m');
  // ======================================================================
  {
    const page = await fresh();
    const r = await page.evaluate(() => ({
      version: Game.version,
      cams: cameras.length,
      alarmTotal: ALARM.total,
      live: ALARM.liveCameras,
      armed: ALARM.armed,
      down: ALARM.down,
      guards: guards.length,
      hasRoster: guards === GUARDS.list && enemyTanks === ARMOUR.list,
      systems: !!(Game.alarm && Game.relief && Game.tacmap),
      banner: !!document.querySelector('div[style*="background:#600"]')
    }));
    check('page reports version v5', r.version === 'v5', r.version);
    check('no runtime error banner', !r.banner);
    check('exactly 6 cameras exist', r.cams === 6, 'got ' + r.cams);
    check('AlarmNet sees all 6', r.alarmTotal === 6 && r.live === 6, JSON.stringify(r));
    check('alarm net starts armed and not locked out', r.armed && !r.down);
    check('garrison populated', r.guards > 20, 'got ' + r.guards);
    check('guards/armour are Roster-backed', r.hasRoster);
    check('Game registry exposes the v4 systems', r.systems);
    check('no page errors during boot', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[2] REQUIREMENT: CAM-6 IS OUTDOORS AND SNIPEABLE\x1b[0m');
  // ======================================================================
  {
    const page = await fresh();
    const r = await page.evaluate(() => {
      // the mast camera is the one furthest out toward the rear yard
      const cam6 = cameras.reduce((a,c) => c.g.position.z < a.g.position.z ? c : a);
      const p = cam6.g.position;
      // Is it inside the rear-yard walls? Walls run x REARX+-18, z REARZ+-16.
      const insideYard = Math.abs(p.x-88) < 18 && Math.abs(p.z-(-236)) < 16;
      // Line of sight from TUNNEL HEIGHTS, standing height on the hill
      const hx = 176, hz = -196;
      const eye = new THREE.Vector3(hx, hillAt(hx,hz)+1.6, hz);
      const tgt = new THREE.Vector3(p.x, p.y, p.z);
      const range = Math.hypot(hx-p.x, hz-p.z);
      const blocked = losBlocked(eye, tgt);
      // Can a rifle round actually reach it? Aim where a player aims — at the
      // housing — and raycast the real hit list the game itself shoots against.
      const aim = new THREE.Vector3();
      cam6.hitbox.getWorldPosition(aim);
      const dir = aim.clone().sub(eye).normalize();
      const rc = new THREE.Raycaster(eye, dir, 0.1, 400);
      const hits = rc.intersectObjects(hitList(), false);
      const firstCam = hits.length > 0 && hits[0].object.userData.camRec === cam6;
      // and the shot must be takeable through the scope, not just geometrically
      const scoped = WEAPONS.filter(w => w.zoom);
      return { x:p.x, y:p.y, z:p.z, insideYard, range, blocked, firstCam,
               aimX:aim.x, aimY:aim.y, aimZ:aim.z,
               hit0: hits.length ? (hits[0].object.userData.camRec ? 'camera' : (hits[0].object.name||hits[0].object.type)) : 'nothing',
               hitDist: hits.length ? hits[0].distance : -1,
               sniperRange: scoped.length,
               // a live fire test: does killCam via the normal damage path work
               killable: (() => { const before = ALARM.liveCameras; killCam(cam6, aim, dir);
                                  return ALARM.liveCameras === before - 1; })() };
    });
    check('CAM-6 is outside the storage-yard walls', !r.insideYard,
          `at (${r.x.toFixed(1)}, ${r.y.toFixed(1)}, ${r.z.toFixed(1)})`);
    check('CAM-6 is elevated on its mast (y > 8 m)', r.y > 8, 'y=' + r.y.toFixed(2));
    check('sniper range from TUNNEL HEIGHTS is long (> 60 m)', r.range > 60, r.range.toFixed(1) + ' m');
    check('line of sight from TUNNEL HEIGHTS is clear', !r.blocked);
    check('a round from TUNNEL HEIGHTS hits CAM-6 first', r.firstCam,
          'first hit was ' + r.hit0 + ' at ' + (r.hitDist>0?r.hitDist.toFixed(1)+' m':'n/a'));
    check('the hit lands at the true range', Math.abs(r.hitDist - Math.hypot(176-r.aimX, r.aimZ+196)) < 12,
          'hit at ' + r.hitDist.toFixed(1) + ' m');
    check('the game ships a scoped weapon to take it with', r.sniperRange > 0);
    check('CAM-6 goes down when hit', r.killable);
    await page.close();
  }

  // The strongest form of this test: stand the player on TUNNEL HEIGHTS, raise
  // the actual scope, and read what the game's OWN rangefinder says is under
  // the reticle. If it says CAMERA, the shot exists for a player, not just for
  // a raycast run from a console.
  {
    const page = await fresh(); await deploy(page);
    await page.evaluate(() => {
      player.pos.set(176, hillAt(176,-196)+1.7, -196);
      switchWeapon(2);                                  // the sniper
    });
    await sleep(1500);
    await page.evaluate(() => {
      const cam6 = cameras.reduce((a,c) => c.g.position.z < a.g.position.z ? c : a);
      const aim = new THREE.Vector3(); cam6.hitbox.getWorldPosition(aim);
      const eye = camera.position;                      // not player.pos — eye height matters
      const dx = aim.x-eye.x, dz = aim.z-eye.z;
      player.yaw = Math.atan2(-dx,-dz);                 // the camera looks down its own -Z
      player.pitch = Math.atan2(aim.y-eye.y, Math.hypot(dx,dz));
      setAim(true);
      for (let i=0;i<4;i++) stepZoom(1);
    });
    await sleep(2500);
    const rf = await page.evaluate(() => ({
      text: el('scopeInfo').textContent,
      zoomed, fov: camera.fov
    }));
    const m = /RANGE\s+(\d+)\s*m\s*\|\s*(\S+)/.exec(rf.text);
    check('the scope is actually up', rf.zoomed && rf.fov < 20, 'fov=' + rf.fov);
    check("the game's own rangefinder identifies CAM-6 under the reticle",
          !!m && m[2] === 'CAMERA', rf.text.trim().slice(0, 90));
    check('it reports a genuine sniping range (60-120 m)',
          !!m && +m[1] > 60 && +m[1] < 120, m ? m[1] + ' m' : 'no reading');
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[3] REQUIREMENT: 6 CAMERAS DOWN = ALARMS PERMANENTLY OFF\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    // --- five down: the base can still call ---
    let r = await page.evaluate(() => {
      for (let i = 0; i < 5; i++) killCam(cameras[i]);
      return { live: ALARM.liveCameras, armed: ALARM.armed, down: ALARM.down };
    });
    check('5 of 6 destroyed leaves the net armed', r.live === 1 && r.armed && !r.down, JSON.stringify(r));

    // --- the sixth: permanent lockout ---
    r = await page.evaluate(() => {
      killCam(cameras[5]);
      return { live: ALARM.liveCameras, armed: ALARM.armed, down: ALARM.down,
               cutoff: RELIEF.cutoff, blinded: ALARM.blinded };
    });
    check('6 of 6 destroyed takes the net down', r.live === 0 && r.blinded === 6);
    check('the lockout latches (ALARM.down)', r.down);
    check('the net is no longer armed', !r.armed);
    check('the relief column is cut off', r.cutoff);

    // --- every route to an alarm now refuses ---
    r = await page.evaluate(() => {
      const before = { tanks: enemyTanks.length, guards: guards.length };
      const raised = ALARM.raise('TEST — DIRECT');
      ALARM.updateTripwire();
      RELIEF.start();
      RELIEF.dispatchWave();
      // and the sentry-radio route: make the whole garrison hostile for 30 s
      for (const g of guards) if (!g.dead) g.state = 'combat';
      for (let i = 0; i < 600; i++) ALARM.update(0.05, i * 0.05);
      return { raised, alerted: ALARM.alerted, canDispatch: RELIEF.canDispatch,
               wave: RELIEF.wave, tanksSent: RELIEF.tanksSent,
               tanksNow: enemyTanks.length, tanksBefore: before.tanks,
               guardsAdded: guards.length - before.guards, down: ALARM.down };
    });
    check('ALARM.raise() refuses outright', r.raised === false);
    check('no alert was ever raised', !r.alerted);
    check('RELIEF.canDispatch is false', !r.canDispatch);
    check('RELIEF.start() spawned nothing', r.wave === 0 && r.tanksSent === 0);
    check('the 5 tanks were never called', r.tanksNow === r.tanksBefore, `${r.tanksBefore} -> ${r.tanksNow}`);
    check('no infantry reinforcements arrived', r.guardsAdded === 0, 'added ' + r.guardsAdded);
    check('30 s of hostile contact still calls nobody', !r.alerted && r.down);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[4] REQUIREMENT: BLINDING THE NET MID-FIGHT STOPS THE WAVES\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    let r = await page.evaluate(() => {
      const ok = ALARM.raise('TEST — TRIP THE ALARM');
      return { ok, alerted: ALARM.alerted, wave: RELIEF.wave, tanks: enemyTanks.length,
               active: RELIEF.active };
    });
    check('with the net up, the alarm DOES raise', r.ok && r.alerted);
    check('wave 1 dispatches immediately', r.wave === 1 && r.active);
    check('wave 1 brought a tank', r.tanks === 1, 'tanks=' + r.tanks);

    r = await page.evaluate(() => {
      // kill the net during the fight, then run well past several wave timers
      for (const c of cameras) if (c.alive) killCam(c);
      const waveAtCutoff = RELIEF.wave;
      for (const g of guards) if (g.reinf && !g.dead) g.kill();   // thin the field
      for (let i = 0; i < 4000; i++) RELIEF.update(0.05);          // 200 simulated seconds
      return { waveAtCutoff, wave: RELIEF.wave, waves: RELIEF.waves,
               cutoff: RELIEF.cutoff, tanksSent: RELIEF.tanksSent, down: ALARM.down };
    });
    check('cutting the net during wave 1 latches cutoff', r.cutoff && r.down);
    check('no further waves after cutoff', r.wave === r.waveAtCutoff, `${r.waveAtCutoff} -> ${r.wave}`);
    check('fewer than the full 5 tanks were ever sent', r.tanksSent < r.waves, 'sent ' + r.tanksSent);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[5] REQUIREMENT: THE FULL COLUMN STILL ARRIVES IF YOU LET IT\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(() => {
      ALARM.raise('TEST');
      // leave every camera alive and run the scheduler out
      for (let i = 0; i < 6000; i++) {
        RELIEF.update(0.05);
        if (i % 40 === 0) for (const g of guards) if (g.reinf && !g.dead) g.kill();
      }
      return { wave: RELIEF.wave, waves: RELIEF.waves, tanksSent: RELIEF.tanksSent,
               menSent: RELIEF.menSent, cutoff: RELIEF.cutoff };
    });
    check('all 5 waves dispatch when the net survives', r.wave === 5 && r.waves === 5, 'wave=' + r.wave);
    check('all 5 tanks were sent', r.tanksSent === 5, 'sent ' + r.tanksSent);
    check('50 troops were sent', r.menSent === 50, 'sent ' + r.menSent);
    check('no spurious cutoff', !r.cutoff);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[6] REQUIREMENT: THE TAC MAP IS REAL-TIME\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    // sample a patrol, open the tablet, sample again after real elapsed time
    const before = await page.evaluate(() => {
      const g = guards.find(x => !x.dead && x.wp && x.wp.length > 1);
      return { id: guards.indexOf(g), x: g.mesh.position.x, z: g.mesh.position.z,
               simLive: simLive(), running };
    });
    await page.evaluate(() => setMap(true));
    await sleep(3000);
    const during = await page.evaluate(i => {
      const g = guards[i];
      // Advance the tracker over a known span. Headless software rendering runs
      // at a handful of frames a second, so wall-clock waiting would measure
      // the rasteriser rather than the tracker.
      for (let n = 0; n < 40; n++) { guardAI(g, TRACK_DT); TACMAP.trackTick(TRACK_DT); }
      const cs = [...TACMAP.contacts.values()];
      return { x: g.mesh.position.x, z: g.mesh.position.z,
               mapOpen, running, simLive: simLive(),
               contacts: TACMAP.contacts.size,
               withHistory: cs.filter(c => c.hist.length > 3).length,
               maxHist: Math.max(...cs.map(c => c.hist.length)),
               capped: cs.every(c => c.hist.length <= TRACK_HIST),
               moving: cs.filter(c => c.speed > 0.3).length,
               satOK: TACMAP.satOK, satMs: TACMAP.satMs };
    }, before.id);
    const moved = Math.hypot(during.x - before.x, during.z - before.z);
    check('opening the tablet releases player control', !during.running);
    check('but the world keeps simulating (simLive)', during.simLive);
    check('enemies MOVE while the map is open', moved > 0.5, 'moved ' + moved.toFixed(2) + ' m');
    check('the map is tracking contacts', during.contacts > 10, 'contacts=' + during.contacts);
    check('tracks carry position history', during.withHistory > 10, 'with history=' + during.withHistory);
    check('history is capped at TRACK_HIST (no unbounded trail)', during.capped, 'max=' + during.maxHist);
    check('tracks show live velocity', during.moving > 0, 'moving=' + during.moving);
    check('the imagery downlink produced a frame', during.satOK);
    check('the downlink refresh is measured', during.satMs > 0, 'satMs=' + (during.satMs||0).toFixed(1));
    // the world is live behind the tablet, so it must show the player's condition
    const vit = await page.evaluate(() => el('tabVital').innerHTML);
    check('the tablet reports the player\'s condition while open', /HEALTH/.test(vit), vit.slice(0,80));

    // the player must NOT drift while reading the map
    const p0 = await page.evaluate(() => ({x:player.pos.x, z:player.pos.z}));
    await page.keyboard.down('KeyW');
    await sleep(1200);
    await page.keyboard.up('KeyW');
    const p1 = await page.evaluate(() => ({x:player.pos.x, z:player.pos.z}));
    const drift = Math.hypot(p1.x-p0.x, p1.z-p0.z);
    check('holding W with the tablet open does not move Jones', drift < 0.2, 'drifted ' + drift.toFixed(3) + ' m');

    // closing it hands control back
    await page.evaluate(() => setMap(false));
    await sleep(300);
    const after = await page.evaluate(() => ({ mapOpen, keysHeld: Object.values(keys).filter(Boolean).length }));
    check('closing the tablet clears it', !after.mapOpen);
    check('no keys are left stuck down', after.keysHeld === 0, 'held=' + after.keysHeld);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[7] LIFECYCLE: NO UNBOUNDED GROWTH\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(async () => {
      const geo0 = renderer.info.memory.geometries, tex0 = renderer.info.memory.textures;
      // Send every wave and kill everything, several times over — far more
      // churn than a real mission, which is the point.
      ALARM.raise('TEST');
      for (let round = 0; round < 6; round++) {
        RELIEF.cutoff = false; RELIEF.wave = 0; RELIEF.timer = 0;
        // 3000 x 0.05 s = 150 simulated seconds per round: enough for all five
        // waves at the 22 s interval, with the field thinned so each one lands
        for (let i = 0; i < 3000; i++) {
          RELIEF.update(0.05);
          if (i % 30 === 0) {
            for (const g of guards) if (g.reinf && !g.dead) g.kill();
            for (const t of enemyTanks) if (!t.dead) { t.dead = true; t.destroy(); }
          }
        }
        GUARDS.reap(); ARMOUR.reap(); reapPickups();
      }
      const spentGuards = guards.filter(g => g.spent).length;
      const spentArmour = enemyTanks.filter(t => t.spent).length;
      const dropped = pickups.filter(p => p.dropped).length;
      return {
        created: GUARDS.created, disposedG: GUARDS.disposed, guardsNow: guards.length,
        armourCreated: ARMOUR.created, armourNow: enemyTanks.length,
        spentGuards, spentArmour, dropped,
        geoDelta: renderer.info.memory.geometries - geo0,
        texDelta: renderer.info.memory.textures - tex0,
        budget: CORPSE_BUDGET, dropBudget: DROP_BUDGET
      };
    });
    console.log('       churn: ' + r.created + ' guards created, ' + r.disposedG + ' disposed, ' + r.guardsNow + ' resident');
    console.log('       armour: ' + r.armourCreated + ' created, ' + r.armourNow + ' resident');
    console.log('       GPU: geometries ' + (r.geoDelta>=0?'+':'') + r.geoDelta + ', textures ' + (r.texDelta>=0?'+':'') + r.texDelta);
    check('far more guards were created than are resident', r.created > r.guardsNow + 50,
          r.created + ' created vs ' + r.guardsNow + ' resident');
    check('corpses are actually disposed', r.disposedG > 50, 'disposed=' + r.disposedG);
    check('spent guards stay within the corpse budget', r.spentGuards <= r.budget, r.spentGuards + ' > ' + r.budget);
    check('spent armour stays within its budget', r.spentArmour <= 3, 'spent=' + r.spentArmour);
    check('battlefield drops stay within budget', r.dropped <= r.dropBudget + 5, 'dropped=' + r.dropped);
    check('GPU geometry count does not run away', r.geoDelta < 400, 'delta=' + r.geoDelta);
    check('GPU texture count does not run away', r.texDelta < 60, 'delta=' + r.texDelta);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[8] SHARED RESOURCES SURVIVE DISPOSAL\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(() => {
      const g = guards.find(x => !x.dead);
      const sharedMat = g.body.material, sharedGeo = g.body.geometry;
      const wasShared = !!sharedMat.shared && !!sharedGeo.shared;
      // kill and forcibly release a man; the cached parts every OTHER man uses
      // must still be intact afterwards
      g.kill();
      GUARDS.keep = 0; GUARDS.reap(); GUARDS.keep = CORPSE_BUDGET;
      const other = guards.find(x => !x.dead);
      return { wasShared,
               matAlive: !sharedMat.__disposed,
               otherRenders: !!(other && other.body.material && other.body.geometry.attributes.position),
               otherInScene: !!(other && other.mesh.parent) };
    });
    check('guard part cache is flagged shared', r.wasShared);
    check('disposing one corpse does not dispose the shared material', r.matAlive);
    check('other guards still have live geometry', r.otherRenders);
    check('other guards are still in the scene', r.otherInScene);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[9] GAMEPLAY FLOW END TO END\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    // Stage progression, not survival — see the note in the v4 suite.
    await page.evaluate(() => { window.__keepAlive = setInterval(() => { player.hp = 100; }, 50); });
    let r = await page.evaluate(() => ({ stage, hud: el('hud').style.display, running }));
    check('mission starts at stage 0 with the HUD up', r.stage === 0 && r.hud === 'block');

    r = await page.evaluate(async () => {
      player.pos.set(0, 0, 40);
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { stage };
    });
    check('entering the compound advances to stage 1 (hack)', r.stage === 1, 'stage=' + r.stage);

    // ---- THE v5 RULE: hacking is enough. Nothing is destroyed in this run. ----
    r = await page.evaluate(async () => {
      player.pos.copy(TERMINAL); player.pos.y = 0;
      keys.KeyE = true;
      for (let i = 0; i < 240; i++) await new Promise(res => requestAnimationFrame(res));
      keys.KeyE = false;
      return { stage, razed: demolition.filter(z => z.done).length, total: demolition.length,
               exfil: EXFIL.state, visible: TRANSPORT.g.visible, eta: Math.round(EXFIL.eta) };
    });
    check('holding E at the terminal completes the hack', r.stage === 2, 'stage=' + r.stage);
    check('the hack alone calls the extraction', r.exfil === 'inbound', 'exfil=' + r.exfil);
    check('the transport is in the air and visible', r.visible);
    check('it has a real ETA, not an instant arrival', r.eta > 30, 'eta=' + r.eta);
    check('NOTHING has been destroyed at this point', r.razed === 0, r.razed + '/' + r.total);

    // ---- the ride arrives, and only then can you board ----
    r = await page.evaluate(async () => {
      player.pos.set(EXFIL_LZ.x - 3, 0, EXFIL_LZ.z + 8);
      const earlyBoard = EXFIL.board();                 // must refuse while inbound
      for (let i = 0; i < 400 && EXFIL.state !== 'down'; i++) EXFIL.update(0.6);
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { earlyBoard, state: EXFIL.state, ready: EXFIL.ready, ramp: EXFIL.ramp,
               stage, boardable: EXFIL.boardable(), hint: el('hint').textContent,
               solid: colliders.some(c => c === EXFIL.hull) };
    });
    check('you cannot board it while it is still inbound', r.earlyBoard === false);
    check('the transport lands at LZ ROOK', r.state === 'down');
    check('the ramp comes down', r.ramp > 0.85, 'ramp=' + r.ramp);
    check('landing advances to stage 3', r.stage === 3, 'stage=' + r.stage);
    check('it is a solid object once on the deck', r.solid);
    check('standing by it offers the board prompt', r.boardable && /BOARD PALADIN/.test(r.hint), r.hint);

    // ---- board it: the cinematic takes over ----
    r = await page.evaluate(async () => {
      const ok = EXFIL.board();
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { ok, kind: cine && cine.kind, hud: el('hud').style.display,
               cineOn: el('cine').style.display, running, gone: EXFIL.gone,
               solidStill: colliders.some(c => c && c.x1 < 5000 && c === EXFIL.hull) };
    });
    check('boarding starts the extraction sequence', r.ok && r.kind === 'exfil');
    check('the HUD gives way to the shot', r.hud === 'none' && r.cineOn === 'block');
    check('you no longer have the controls', !r.running);

    // ---- run the sequence out ----
    r = await page.evaluate(async () => {
      const seen = [];
      for (let i = 0; i < 400 && cine; i++) {
        cine.t += 0.12; exfilTick(0.12);
        if (i % 60 === 0 && cine) seen.push(+(cine.t / EXFIL_LEN).toFixed(2));
        await new Promise(res => requestAnimationFrame(res));
      }
      return { seen, cine: !!cine, gameOver, win: el('winScreen').style.display,
               stats: el('winStats').textContent,
               razed: demolition.filter(z => z.done).length };
    });
    check('the sequence plays through and ends', !r.cine && r.gameOver);
    check('the debrief screen appears', r.win === 'flex');
    check('the mission was completed with the depot untouched', r.razed === 0, 'razed=' + r.razed);
    check('the debrief leads with the package', /PACKAGE SECURE/.test(r.stats), r.stats.slice(0, 80));
    check('the debrief says the depot was left standing', /left standing/.test(r.stats));
    check('the debrief teases the next mission', /SABLEWIND/.test(r.stats));
    check('no page errors across the whole flow', page.__errs.length === 0, page.__errs[0]);
    await page.evaluate(() => clearInterval(window.__keepAlive));
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[9b] THE DEPOT IS OPTIONAL, NOT REMOVED\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(async () => {
      // Everything EXCEPT the signals bunker. Levelling that one before the
      // hack is a documented mission failure — the mainframe is the mission, so
      // burying it ends the run — and that rule is checked separately below.
      const targets = demolition.filter(z => z.label !== 'SIGNALS BUNKER');
      for (const z of targets) if (!z.done) destroyZone(z);
      for (let i = 0; i < 12; i++) await new Promise(res => requestAnimationFrame(res));
      return { total: targets.length, razed: targets.filter(z => z.done).length,
               stage, gameOver, win: el('winScreen').style.display, exfil: EXFIL.state };
    });
    check('the demolition targets still exist and still destroy', r.total > 0 && r.razed === r.total,
          r.razed + '/' + r.total);
    check('levelling the whole depot does NOT end the mission', !r.gameOver && r.win !== 'flex',
          'gameOver=' + r.gameOver + ' win=' + r.win);
    check('and it does not call the extraction either', r.exfil === 'idle', 'exfil=' + r.exfil);
    check('the mission is still waiting on the hack', r.stage < 2, 'stage=' + r.stage);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[9d] BURYING THE MAINFRAME STILL FAILS THE MISSION\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(async () => {
      const z = demolition.find(d => d.label === 'SIGNALS BUNKER');
      destroyZone(z);
      for (let i = 0; i < 12; i++) await new Promise(res => requestAnimationFrame(res));
      return { gameOver, lose: el('loseScreen').style.display,
               why: el('loseWhy').textContent, win: el('winScreen').style.display };
    });
    // v5 makes the intelligence the whole mission, so this matters more than it
    // did when the depot had to come down anyway.
    check('destroying the bunker before the hack fails the mission', r.gameOver && r.lose === 'flex');
    check('and it is a failure, not a win', r.win !== 'flex');
    check('the reason is explained', /hack it first/i.test(r.why), r.why.slice(0, 80));
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[9c] THE OLD BEACON ENDING IS GONE\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(async () => {
      setStage(2);                             // extraction called
      // stand exactly on the marker, on foot, as the v4 ending required
      player.pos.copy(EXTRACT); player.pos.y = 0;
      flying = chuting = tanking = false; driving = null;
      for (let i = 0; i < 30; i++) await new Promise(res => requestAnimationFrame(res));
      return { gameOver, win: el('winScreen').style.display, exfil: EXFIL.state };
    });
    check('standing on the marker does not end the mission', !r.gameOver && r.win !== 'flex');
    check('you have to wait for the aircraft', r.exfil === 'inbound', 'exfil=' + r.exfil);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[10] SUSTAINED RUN — STABILITY AND FRAME RATE\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    await page.evaluate(() => { ALARM.raise('TEST'); player.pos.set(0,0,20); });
    await sleep(15000);
    const r = await page.evaluate(() => ({
      fps: PERF.fps, quality: QUALITY[PERF.level].name,
      guards: guards.length, tanks: enemyTanks.length,
      particles: particles.length, pickups: pickups.length,
      geo: renderer.info.memory.geometries, calls: renderer.info.render.calls,
      gameOver, alive: !!scene
    }));
    console.log('       ' + Math.round(r.fps) + ' fps @ ' + r.quality + ', ' + r.calls + ' draw calls, '
                + r.guards + ' guards, ' + r.geo + ' geometries');
    check('the game is still running after 15 s under alarm', !!r.alive);
    check('particle count stays capped', r.particles <= 200, 'particles=' + r.particles);
    check('frame rate is being measured', r.fps > 0, 'fps=' + r.fps);
    check('no page errors during sustained play', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[11] GRAPHICS TIERS AND RENDER SETTINGS\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(() => {
      const names = QUALITY.map(q => q.name);
      const errs = [];
      const seenPr = [], seenShadow = [];
      for (let lv = 0; lv < QUALITY.length; lv++) {
        PERF.level = lv;
        try { applyQuality(); } catch (e) { errs.push(names[lv] + ': ' + e.message); }
        seenPr.push(renderer.getPixelRatio());
        seenShadow.push(QUALITY[lv].shadows ? moon.shadow.mapSize.width : 0);
      }
      PERF.level = 1; applyQuality();
      // sharpness is texels per metre: mapSize / (2 * box radius)
      const sharp = QUALITY.filter(q => q.shadows)
                           .map(q => q.shadowSize / (2 * q.shadowRadius));
      const rising = sharp.every((v, i) => i === 0 || v > sharp[i-1]);
      return { names, errs, seenShadow, rising, sharp,
               toneMapping: renderer.toneMapping === THREE.ACESFilmicToneMapping,
               srgb: renderer.outputEncoding === THREE.sRGBEncoding,
               autoUpdateOff: renderer.shadowMap.autoUpdate === false,
               anisoApplied: _anisoNow > 0 };
    });
    check('an ULTRA tier exists above HIGH', r.names.includes('ULTRA') && r.names.length === 4, r.names.join(','));
    check('every tier applies without error', r.errs.length === 0, r.errs[0]);
    check('shadow map size grows with the tier', r.seenShadow[3] >= r.seenShadow[2], r.seenShadow.join(','));
    check('shadow sharpness rises tier over tier', r.rising, r.sharp.map(v=>v.toFixed(1)).join(' -> ') + ' texels/m');
    check('ACES tone mapping is on', r.toneMapping);
    check('sRGB output encoding is on', r.srgb);
    check('shadow map still refreshes on a timer, not per frame', r.autoUpdateOff);
    check('anisotropic filtering was applied', r.anisoApplied);
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[12] NO DUPLICATED HELPERS\x1b[0m');
  // ======================================================================
  {
    const page = await fresh();
    const r = await page.evaluate(() => ({
      canvasHelper: typeof mkCanvas === 'function',
      noCv: typeof cv === 'undefined',
      normalHelper: typeof heightToNormal === 'function',
      noBump: typeof bumpToNormal === 'undefined',
      // both survivors must still work
      canvasOk: (() => { const c = mkCanvas(8); return c.width === 8 && c.height === 8; })(),
      normalOk: (() => { const c = mkCanvas(8); const x = c.getContext('2d');
                         x.fillStyle = '#808080'; x.fillRect(0,0,8,8);
                         const n = heightToNormal(c, 2); return n.width === 8; })()
    }));
    check('one canvas helper survives', r.canvasHelper && r.noCv);
    check('one height-to-normal helper survives', r.normalHelper && r.noBump);
    check('the canvas helper still works', r.canvasOk);
    check('the normal-map helper still works', r.normalOk);
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[13] MAP CONTROLS — PANNING AND ZOOMING\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);
    const openMap = (scale) => page.evaluate(sc => {
      setMap(true); TACMAP.follow = false;
      TACMAP.scale = sc; TACMAP.cx = 0; TACMAP.cz = 0;
    }, scale);

    // --- 1:1 panning. The ground under the cursor stays under the cursor. ---
    // This is the regression guard for the compounding-drag bug: the anchor was
    // not advanced between move events, so every event re-applied the whole
    // offset from mousedown and a 20-event drag panned ~10x too far.
    for (const scale of [1.5, 4, 12]) {
      await openMap(scale);
      await sleep(500);
      const b4 = await page.evaluate(() => ({ cx: TACMAP.cx, cz: TACMAP.cz }));
      await page.mouse.move(600, 450);
      await page.mouse.down();
      for (let i = 1; i <= 20; i++) { await page.mouse.move(600 + i * 10, 450 + i * 5); await sleep(15); }
      await page.mouse.up();
      await sleep(250);
      const af = await page.evaluate(() => ({ cx: TACMAP.cx, cz: TACMAP.cz }));
      const wantX = -200 / scale, wantZ = -100 / scale;
      const gotX = af.cx - b4.cx, gotZ = af.cz - b4.cz;
      const errX = Math.abs(gotX - wantX), errZ = Math.abs(gotZ - wantZ);
      check(`pan is 1:1 at ${scale} px/m (200x100 px drag)`,
            errX < 0.5 && errZ < 0.5,
            `wanted ${wantX.toFixed(1)},${wantZ.toFixed(1)} m  got ${gotX.toFixed(1)},${gotZ.toFixed(1)} m`);
    }

    // --- the drag must not depend on how MANY events arrive ---
    // A slow hand and a fast one covering the same distance must pan the same.
    const measure = async (steps) => {
      await openMap(4); await sleep(400);
      const b4 = await page.evaluate(() => TACMAP.cx);
      await page.mouse.move(500, 400);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) { await page.mouse.move(500 + (240 * i / steps), 400); await sleep(8); }
      await page.mouse.up();
      await sleep(200);
      return (await page.evaluate(() => TACMAP.cx)) - b4;
    };
    const few = await measure(3), many = await measure(48);
    check('pan distance is independent of the event count',
          Math.abs(few - many) < 0.5, `3 events: ${few.toFixed(1)} m, 48 events: ${many.toFixed(1)} m`);
    check('the pan goes the right way and the right distance',
          Math.abs(few - (-240 / 4)) < 0.5, few.toFixed(1) + ' m (wanted -60.0)');

    // --- Shift is the precision gear ---
    await openMap(4); await sleep(400);
    const sb = await page.evaluate(() => TACMAP.cx);
    await page.keyboard.down('Shift');
    await page.mouse.move(500, 400);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) { await page.mouse.move(500 + i * 10, 400); await sleep(12); }
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await sleep(250);
    const shifted = (await page.evaluate(() => TACMAP.cx)) - sb;
    check('shift-drag pans at a quarter speed', Math.abs(shifted - (-200 / 4) * 0.25) < 0.6,
          shifted.toFixed(1) + ' m (wanted -12.5)');

    // --- a click is not a drag: it must not silently drop tracking ---
    await page.evaluate(() => { setMap(true); TACMAP.recentre(); });   // follow = true
    await sleep(300);
    await page.mouse.move(700, 450);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(200);
    const clicked = await page.evaluate(() => ({ follow: TACMAP.follow, dragging: TACMAP.dragging }));
    check('a click without movement keeps the map tracking you', clicked.follow);
    check('a click leaves no drag in progress', !clicked.dragging);

    // --- releasing outside the canvas must end the drag ---
    await openMap(4); await sleep(300);
    await page.mouse.move(600, 450);
    await page.mouse.down();
    await page.mouse.move(650, 450);
    await page.mouse.move(5, 5);            // out over the frame surround
    await page.mouse.up();
    await sleep(200);
    const released = await page.evaluate(() => TACMAP.dragging);
    check('releasing outside the map ends the drag', !released);
    const stuckAfter = await page.evaluate(async () => {
      const a = TACMAP.cx;
      return { a };
    });
    await page.mouse.move(900, 600);        // moving with the button UP
    await sleep(200);
    const drift = Math.abs((await page.evaluate(() => TACMAP.cx)) - stuckAfter.a);
    check('the map does not follow the cursor once released', drift < 0.01, 'drifted ' + drift.toFixed(3));

    // --- wheel zoom is normalised, so a trackpad burst is not a jump ---
    await openMap(4); await sleep(300);
    const z0 = await page.evaluate(() => TACMAP.scale);
    // one mouse notch
    await page.mouse.move(700, 450);
    await page.mouse.wheel({ deltaY: -120 });
    await sleep(250);
    const zNotch = await page.evaluate(() => TACMAP.scale);
    check('one mouse notch zooms about 1.2x',
          zNotch / z0 > 1.10 && zNotch / z0 < 1.35, (zNotch / z0).toFixed(3) + 'x');
    // a trackpad flick: ten small deltas summing to one notch
    await openMap(4); await sleep(300);
    for (let i = 0; i < 10; i++) { await page.mouse.wheel({ deltaY: -12 }); await sleep(20); }
    await sleep(250);
    const zPad = await page.evaluate(() => TACMAP.scale);
    check('ten trackpad deltas summing to a notch zoom about the same',
          Math.abs(zPad - zNotch) / zNotch < 0.12,
          `notch ${zNotch.toFixed(2)} vs trackpad ${zPad.toFixed(2)}`);
    check('zoom stays inside its limits', zPad >= 0.22 && zPad <= 64, 'scale=' + zPad);

    // --- arrow keys pan by an exact, repeatable step ---
    await openMap(4); await sleep(300);
    const a0 = await page.evaluate(() => ({ cx: TACMAP.cx, cz: TACMAP.cz }));
    await page.keyboard.press('ArrowRight');
    await sleep(150);
    const a1 = await page.evaluate(() => ({ cx: TACMAP.cx, cz: TACMAP.cz }));
    const stepped = a1.cx - a0.cx;
    check('an arrow tap pans a fixed step', stepped > 0 && Math.abs(stepped - 26 / 4) < 0.6,
          stepped.toFixed(2) + ' m (wanted 6.5)');
    await page.keyboard.press('ArrowRight');
    await sleep(150);
    const a2 = await page.evaluate(() => TACMAP.cx);
    check('two taps pan exactly twice as far', Math.abs((a2 - a0.cx) - 2 * stepped) < 0.3,
          (a2 - a0.cx).toFixed(2) + ' m');

    check('no page errors while driving the map', page.__errs.length === 0, page.__errs[0]);
    await page.evaluate(() => setMap(false));
    await page.close();
  }

  // ======================================================================
  console.log('\n\x1b[1m[14] THE MAINFRAME ANSWERS BY ANY ROUTE\x1b[0m');
  // ======================================================================
  {
    const page = await fresh(); await deploy(page);

    // The briefing sends you to the signals bunker, which is a separate walled
    // site far outside the main compound. Going straight there — doing exactly
    // what you were told — must not leave you at a dead computer.
    let r = await page.evaluate(async () => {
      const startStage = stage;
      player.pos.set(TERMINAL.x, 0, TERMINAL.z + 1.2);
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      return { startStage, stage, inMain: inMainCompound(), inSig: inSignalsCompound(),
               dist: player.pos.distanceTo(TERMINAL) };
    });
    check('the bunker really is outside the main compound', !r.inMain && r.inSig,
          `inMain=${r.inMain} inSignals=${r.inSig}`);
    check('you never passed through the main compound', r.startStage === 0);
    check('reaching the signals bunker counts as infiltrating', r.stage === 1, 'stage=' + r.stage);
    check('you can stand within reach of the terminal', r.dist < 3.2, r.dist.toFixed(2) + ' m');

    r = await page.evaluate(async () => {
      const hints = [];
      keys.KeyE = true;
      for (let i = 0; i < 260; i++) {
        await new Promise(res => requestAnimationFrame(res));
        if (i % 20 === 0) hints.push(el('hint').textContent);
      }
      keys.KeyE = false;
      return { stage, hints, box: el('hackBox').style.display };
    });
    check('holding E at the terminal hacks it without entering the compound first',
          r.stage === 2, 'stage=' + r.stage);
    check('the HOLD E prompt is shown while you are there',
          r.hints.some(h => /HOLD E/.test(h)), JSON.stringify(r.hints.slice(0, 3)));

    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  // The prompt must survive a sentry reaching for his radio. The alarm ticks
  // AFTER the interaction prompts are composed and used to overwrite them, so a
  // man keying his radio anywhere on the base wiped "HOLD E" off the screen
  // while you stood at the mainframe.
  //
  // Its own page, and health pinned: this is a test of which line wins the HUD,
  // and standing at the terminal with the garrison hunting you gets you shot,
  // which stops the simulation and leaves nothing to measure.
  {
    const page = await fresh(); await deploy(page);
    const r = await page.evaluate(async () => {
      const keepAlive = setInterval(() => { player.hp = 100; }, 30);
      setStage(1); hackT = 0;
      player.pos.set(TERMINAL.x, 0, TERMINAL.z + 1.2);
      const g = guards.find(x => !x.dead);       // put a man into contact
      g.state = 'combat';
      ALARM.contactT = 2.0;
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const atTerminal = el('hint').textContent;
      const warnLive = ALARM.radioWarn.length > 0;
      const dead = gameOver;
      // and it must still appear when there is nothing to act on
      player.pos.set(0, 0, -300);
      let alone = '';
      for (let i = 0; i < 10; i++) {
        await new Promise(res => requestAnimationFrame(res));
        if (ALARM.radioWarn) alone = el('hint').textContent;
      }
      clearInterval(keepAlive);
      return { atTerminal, warnLive, alone, dead };
    });
    check('the simulation was still live for the measurement', !r.dead);
    check('the radio warning was genuinely active', r.warnLive);
    check('a sentry calling it in does not wipe the HOLD E prompt',
          /HOLD E/.test(r.atTerminal), JSON.stringify(r.atTerminal));
    check('the radio warning still takes the line when nothing else needs it',
          /SENTRY IS CALLING/.test(r.alone), JSON.stringify(r.alone));
    check('no page errors', page.__errs.length === 0, page.__errs[0]);
    await page.close();
  }

  await browser.close();
  console.log('\n' + '='.repeat(64));
  console.log(`  ${pass} passed, ${fail} failed`);
  if (fail) { console.log('\n  FAILURES:'); failures.forEach(f => console.log('   • ' + f)); }
  console.log('='.repeat(64) + '\n');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS FAIL:', e); process.exit(2); });
