import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9298',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_test_live',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9298/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.type === 'page' || (t.url && t.url.includes('8080')));
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

async function capture(filename) {
  const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (res?.data) {
    fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  }
}

ws.onopen = async () => {
  await sendCmd('Page.enable');
  await sendCmd('Runtime.enable');

  console.log('Waiting 4.5s for complete game, BVH collision and GLTF assets initialization...');
  await new Promise(r => setTimeout(r, 4500));

  // Hide start prompt
  await evalExpr(`
    (() => {
      const sp = document.getElementById("start-prompt");
      if (sp) sp.style.display = "none";
      if (window.game && window.game.audio) window.game.audio.init();
    })()
  `);

  await new Promise(r => setTimeout(r, 1000));

  // 1. Capture FPS view facing into Haven
  await capture('test_fps_center.png');

  // 2. Query bot telemetry
  const botInfo = await evalExpr(`
    (() => {
      if (!window.game || !window.game.botManager) return 'No botManager';
      const p = window.game.character.pos;
      return window.game.botManager.bots.map(b => ({
        name: b.name,
        pos: [b.pos.x.toFixed(1), b.pos.y.toFixed(1), b.pos.z.toFixed(1)],
        distToPlayer: Math.hypot(b.pos.x - p.x, b.pos.z - p.z).toFixed(1),
        speed: Math.hypot(b.vel.x, b.vel.z).toFixed(2),
        modelLoaded: !!b.modelMesh
      }));
    })()
  `);
  console.log('Bot telemetry:', JSON.stringify(botInfo, null, 2));

  // 3. Switch to 3rd person OTS
  console.log('Toggling 3rd person OTS...');
  await evalExpr('window.game.togglePerspective()');
  await new Promise(r => setTimeout(r, 1200));
  await capture('test_ots_maid.png');

  // 4. Switch Heroine to Miyazawa
  console.log('Switching Heroine to Miyazawa...');
  await evalExpr("window.game._loadHeroine('miyazawa')");
  await new Promise(r => setTimeout(r, 1500));
  await capture('test_ots_miyazawa.png');

  // 5. Switch Heroine to Lucy
  console.log('Switching Heroine to Lucy...');
  await evalExpr("window.game._loadHeroine('lucy')");
  await new Promise(r => setTimeout(r, 1500));
  await capture('test_ots_lucy.png');

  console.log('Done!');
  proc.kill();
  process.exit(0);
};
