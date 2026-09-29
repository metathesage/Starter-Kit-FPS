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
  '--user-data-dir=' + process.env.TEMP + '\\edge_full_suite_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9298/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

const targets = await getTargets();
const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

function sendCmd(method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function captureScreen(filename) {
  const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (res && res.data) {
    fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot ${filename}`);
  }
}

ws.onopen = async () => {
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');
  await new Promise(r => setTimeout(r, 5500)); // wait for initial boot & asset load

  // Close splash screen
  await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        window.game.startMatchFromSplash();
        const splash = document.getElementById("splash-screen");
        if (splash) splash.style.display = "none";
      })()
    `
  });
  await new Promise(r => setTimeout(r, 500));

  console.log('=== 1. VERIFYING CS BLACKHAWK MAP & SHOOTING ===');
  // Fire weapon
  await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        window.game.shoot();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 100));

  const csStatus = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const vm = window.game.viewmodel;
        const p = window.game.character.pos;
        return JSON.stringify({
          map: window.game.currentMapKey,
          playerPos: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)],
          grounded: window.game.character.grounded,
          flashType: vm.flashMesh ? vm.flashMesh.type : null,
          flashMatType: vm.flashMesh && vm.flashMesh.material ? vm.flashMesh.material.type : null,
          botsCount: window.game.botManager.bots.length,
          botsAnimated: window.game.botManager.bots.filter(b => b.mixer && (b.stepAction || b.idleAction)).length
        }, null, 2);
      })()
    `
  });
  console.log('CS Status:', csStatus?.result?.value);
  await captureScreen('./screenshots/suite_1_cs_blackhawk.png');

  console.log('\n=== 2. VERIFYING HAVEN MAP & SOLID GROUND ===');
  await sendCmd('Runtime.evaluate', {
    expression: `(async () => { await window.game.loadMap("haven"); })()`,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3500));

  const havenStatus = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const p = window.game.character.pos;
        const gy = window.game.collision ? window.game.collision.groundHeight(p.x, p.z, p.y + 4, 15) : null;
        let texturedCount = 0;
        if (window.game.mapMesh) {
          window.game.mapMesh.traverse(c => {
            if (c.isMesh && c.material && c.material.map) texturedCount++;
          });
        }
        return JSON.stringify({
          map: window.game.currentMapKey,
          playerPos: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)],
          groundY: gy,
          grounded: window.game.character.grounded,
          velY: window.game.character.vel.y,
          texturedMeshes: texturedCount,
          botsCount: window.game.botManager.bots.length,
          botsAnimated: window.game.botManager.bots.filter(b => b.mixer).length
        }, null, 2);
      })()
    `
  });
  console.log('Haven Status:', havenStatus?.result?.value);
  await captureScreen('./screenshots/suite_2_haven.png');

  console.log('\n=== 3. VERIFYING LOCKOUT MAP & SOLID GROUND ===');
  await sendCmd('Runtime.evaluate', {
    expression: `(async () => { await window.game.loadMap("lockout"); })()`,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3500));

  const lockoutStatus = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const p = window.game.character.pos;
        const gy = window.game.collision ? window.game.collision.groundHeight(p.x, p.z, p.y + 4, 15) : null;
        let texturedCount = 0;
        if (window.game.mapMesh) {
          window.game.mapMesh.traverse(c => {
            if (c.isMesh && c.material && c.material.map) texturedCount++;
          });
        }
        return JSON.stringify({
          map: window.game.currentMapKey,
          playerPos: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)],
          groundY: gy,
          grounded: window.game.character.grounded,
          velY: window.game.character.vel.y,
          texturedMeshes: texturedCount,
          botsCount: window.game.botManager.bots.length,
          botsAnimated: window.game.botManager.bots.filter(b => b.mixer).length
        }, null, 2);
      })()
    `
  });
  console.log('Lockout Status:', lockoutStatus?.result?.value);
  await captureScreen('./screenshots/suite_3_lockout.png');

  proc.kill();
  process.exit(0);
};
