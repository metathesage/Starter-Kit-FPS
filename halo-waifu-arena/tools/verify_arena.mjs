import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9277',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_verify',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9277/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

function sendCmd(method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalExpr(expression) {
  const res = await sendCmd('Runtime.evaluate', { expression, returnByValue: true });
  return res?.result?.value;
}

async function captureShot(filename) {
  const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (res?.data) {
    fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  }
}

ws.onopen = async () => {
  await sendCmd('Page.enable');
  await sendCmd('Runtime.enable');

  console.log('--- Checking game boot status ---');
  await new Promise(r => setTimeout(r, 2500));

  // Check errors
  const bootErr = await evalExpr('window._lastError || null');
  console.log('Boot error:', bootErr);

  // Hide start prompt to engage
  await evalExpr(`
    (() => {
      const sp = document.getElementById("start-prompt");
      if (sp) sp.style.display = "none";
      if (window.game && window.game.audio) window.game.audio.init();
    })()
  `);

  console.log('--- Simulating 3 seconds of gameplay & tactical bot movement ---');
  await new Promise(r => setTimeout(r, 3000));

  // Inspect Bots State
  const botStats = await evalExpr(`
    (() => {
      if (!window.game || !window.game.botManager) return null;
      const bm = window.game.botManager;
      const playerPos = window.game.character.pos;
      return bm.bots.map(b => {
        const dx = b.pos.x - playerPos.x;
        const dz = b.pos.z - playerPos.z;
        const dist = Math.hypot(dx, dz);
        const speed = Math.hypot(b.vel.x, b.vel.z);
        return {
          name: b.name,
          pos: [b.pos.x.toFixed(2), b.pos.y.toFixed(2), b.pos.z.toFixed(2)],
          dist: dist.toFixed(2),
          speed: speed.toFixed(2),
          alive: b.alive,
          shield: b.shield.toFixed(0),
          health: b.health.toFixed(0)
        };
      });
    })()
  `);

  console.log('Bot telemetry:', JSON.stringify(botStats, null, 2));

  // Capture FPS Combat Screenshot
  await captureShot('haven_combat_fps.png');

  // Switch to 3rd person OTS
  console.log('--- Switching to 3rd person OTS ---');
  await evalExpr('window.game.togglePerspective()');
  await new Promise(r => setTimeout(r, 1000));
  await captureShot('haven_ots_maid.png');

  // Cycle to Miyazawa
  console.log('--- Switching Heroine to Miyazawa ---');
  await evalExpr("window.game._loadHeroine('miyazawa')");
  await new Promise(r => setTimeout(r, 1200));
  await captureShot('haven_ots_miyazawa.png');

  // Test weapon firing & sound/voice trigger
  console.log('--- Testing weapon fire & hit feedback ---');
  await evalExpr(`
    (() => {
      if (window.game && window.game.botManager.bots[0]) {
        // Deal damage to first bot to test voice line & hit reaction
        window.game.botManager.bots[0].takeDamage(70, 'head', new THREE.Vector3(0,0,1), window.game.botManager.bots[0].pos, 'YOU');
      }
    })()
  `);
  await new Promise(r => setTimeout(r, 800));
  await captureShot('haven_damage_feedback.png');

  // Navigate to D3 Firing Range to verify D3 weapons
  console.log('--- Navigating to D3 Tactical Firing Range ---');
  await sendCmd('Page.navigate', { url: 'http://localhost:8080/d3/' });
  await new Promise(r => setTimeout(r, 3500));
  await captureShot('d3_firing_range_verified.png');

  console.log('--- Verification Complete ---');
  proc.kill();
  process.exit(0);
};
