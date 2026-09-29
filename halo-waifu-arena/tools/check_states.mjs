import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9234',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_shot_verify_json2',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9234/json', res => {
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
    const id = Math.floor(Math.random() * 100000);
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

ws.onopen = async () => {
  await sendCmd('Runtime.enable');
  await new Promise(r => setTimeout(r, 2000));

  // 1. Haven
  await sendCmd('Runtime.evaluate', { expression: "window.game.loadMap('haven');", awaitPromise: true });
  await new Promise(r => setTimeout(r, 2500));
  const resHaven = await sendCmd('Runtime.evaluate', {
    expression: "JSON.stringify({ map: window.game.currentMapKey, playerPos: window.game.character.pos, meshPos: window.game.mapMesh.position, groundY: window.game.collision.groundHeight(window.game.character.pos.x, window.game.character.pos.z, window.game.character.pos.y + 1, 5), bots: window.game.botManager.bots.length })"
  });
  console.log('HAVEN CHECK:', resHaven?.result?.value ?? resHaven);

  // 2. Lockout
  await sendCmd('Runtime.evaluate', { expression: "window.game.loadMap('lockout');", awaitPromise: true });
  await new Promise(r => setTimeout(r, 2500));
  const resLockout = await sendCmd('Runtime.evaluate', {
    expression: "JSON.stringify({ map: window.game.currentMapKey, playerPos: window.game.character.pos, meshPos: window.game.mapMesh.position, groundY: window.game.collision.groundHeight(window.game.character.pos.x, window.game.character.pos.z, window.game.character.pos.y + 1, 5), bots: window.game.botManager.bots.length })"
  });
  console.log('LOCKOUT CHECK:', resLockout?.result?.value ?? resLockout);

  // 3. Rust
  await sendCmd('Runtime.evaluate', { expression: "window.game.loadMap('rust');", awaitPromise: true });
  await new Promise(r => setTimeout(r, 2500));
  const resRust = await sendCmd('Runtime.evaluate', {
    expression: "JSON.stringify({ map: window.game.currentMapKey, playerPos: window.game.character.pos, meshPos: window.game.mapMesh.position, groundY: window.game.collision.groundHeight(window.game.character.pos.x, window.game.character.pos.z, window.game.character.pos.y + 1, 5), bots: window.game.botManager.bots.length })"
  });
  console.log('RUST CHECK:', resRust?.result?.value ?? resRust);

  // 4. OTS
  await sendCmd('Runtime.evaluate', { expression: "window.game.setPerspective('OTS');" });
  await new Promise(r => setTimeout(r, 1000));
  const resOTS = await sendCmd('Runtime.evaluate', {
    expression: "JSON.stringify({ perspective: window.game.perspective, camPos: window.game.camera.position, bone: window.game.heroineHandBone ? window.game.heroineHandBone.name : 'NONE', weaponKey: window.game.weapons.currentKey })"
  });
  console.log('OTS CHECK:', resOTS?.result?.value ?? resOTS);

  proc.kill();
  process.exit(0);
};
