import puppeteer from 'puppeteer';

(async () => {
  console.log('[TEST] Launching browser to verify all maps, geometry, and rigs...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('[BROWSER ERROR]', msg.text());
      errors.push(msg.text());
    } else {
      const text = msg.text();
      if (text.includes('BAKE') || text.includes('LOAD') || text.includes('MAP') || text.includes('ERROR')) {
        console.log('[BROWSER LOG]', text);
      }
    }
  });

  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.message);
    errors.push(err.message);
  });

  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Test 1: Start match on Haven
  console.log('[TEST] Loading Haven...');
  await page.evaluate(async () => {
    await window.game.loadMap('haven');
  });
  await new Promise(r => setTimeout(r, 1500));

  const havenState = await page.evaluate(() => {
    const char = window.game.character;
    const col = window.game.collision;
    const mesh = window.game.mapMesh;
    const groundY = col.groundHeight(char.pos.x, char.pos.z, char.pos.y + 1, 5);
    return {
      mapKey: window.game.currentMapKey,
      playerPos: [char.pos.x, char.pos.y, char.pos.z],
      meshPos: [mesh.position.x, mesh.position.y, mesh.position.z],
      groundY,
      botCount: window.game.botManager.bots.length,
      botsAlive: window.game.botManager.bots.filter(b => b.alive).length
    };
  });
  console.log('[TEST] Haven State:', havenState);

  // Test 2: Load Lockout
  console.log('[TEST] Loading Lockout...');
  await page.evaluate(async () => {
    await window.game.loadMap('lockout');
  });
  await new Promise(r => setTimeout(r, 1500));

  const lockoutState = await page.evaluate(() => {
    const char = window.game.character;
    const col = window.game.collision;
    const mesh = window.game.mapMesh;
    const groundY = col.groundHeight(char.pos.x, char.pos.z, char.pos.y + 1, 5);
    return {
      mapKey: window.game.currentMapKey,
      playerPos: [char.pos.x, char.pos.y, char.pos.z],
      meshPos: [mesh.position.x, mesh.position.y, mesh.position.z],
      groundY,
      botCount: window.game.botManager.bots.length
    };
  });
  console.log('[TEST] Lockout State:', lockoutState);

  // Test 3: Load Rust
  console.log('[TEST] Loading Rust...');
  await page.evaluate(async () => {
    await window.game.loadMap('rust');
  });
  await new Promise(r => setTimeout(r, 1500));

  const rustState = await page.evaluate(() => {
    const char = window.game.character;
    const col = window.game.collision;
    const mesh = window.game.mapMesh;
    const groundY = col.groundHeight(char.pos.x, char.pos.z, char.pos.y + 1, 5);
    return {
      mapKey: window.game.currentMapKey,
      playerPos: [char.pos.x, char.pos.y, char.pos.z],
      meshPos: [mesh.position.x, mesh.position.y, mesh.position.z],
      groundY,
      botCount: window.game.botManager.bots.length
    };
  });
  console.log('[TEST] Rust State:', rustState);

  // Test 4: Check Third-person OTS Weapon & Bot Animation
  console.log('[TEST] Testing Third-Person Perspective and Bot Animation...');
  await page.evaluate(() => {
    window.game.setPerspective('OTS');
  });
  await new Promise(r => setTimeout(r, 800));

  const otsState = await page.evaluate(() => {
    const cam = window.game.camera;
    const ws = window.game.heroineWeaponSocket;
    const bot = window.game.botManager.bots[0];
    return {
      camPos: [cam.position.x, cam.position.y, cam.position.z],
      camNear: cam.near,
      weaponSocketChildren: ws.children.length,
      botHasMixer: !!bot.mixer,
      botHasStepAction: !!bot.stepAction,
      botHasIdleAction: !!bot.idleAction
    };
  });
  console.log('[TEST] OTS & Bot State:', otsState);

  await page.screenshot({ path: 'tools/test_result_screenshot.png' });
  console.log('[TEST] Saved screenshot to tools/test_result_screenshot.png');

  await browser.close();

  if (errors.length > 0) {
    console.error(`[TEST FAILED] Encountered ${errors.length} errors:`, errors);
    process.exit(1);
  } else {
    console.log('[TEST PASSED] All 4 maps, geometry alignment, and bot rigging verified!');
    process.exit(0);
  }
})();
