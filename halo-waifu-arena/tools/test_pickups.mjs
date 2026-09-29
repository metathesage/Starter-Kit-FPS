import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const artifactDir = 'C:\\Users\\young\\.gemini\\antigravity-ide\\brain\\fde98397-e55f-4fa7-b2e5-c24baffcfe9a';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9232',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_shot_test_pickups',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9232/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

const targets = await getTargets();
const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
if (!page) {
  proc.kill();
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);

function sendCommand(id, method, params = {}) {
  return new Promise((resolve) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws.onopen = async () => {
  await sendCommand(1, 'Runtime.enable');
  await sendCommand(2, 'Page.enable');
  await new Promise(r => setTimeout(r, 3500));

  // Dismiss splash
  await sendCommand(3, 'Runtime.evaluate', {
    expression: 'window.game.startMatchFromSplash(); "deployed"'
  });
  await new Promise(r => setTimeout(r, 1000));

  // Teleport player near Chaperone pickup
  console.log('[PICKUP TEST] Moving player near Chaperone pickup...');
  await sendCommand(4, 'Runtime.evaluate', {
    expression: `
      window.game.character.pos.set(-13.48, -2.26, 27.8);
      window.game.character.yaw = 0;
      window.game.simulate(0.016);
      "teleported"
    `
  });
  await new Promise(r => setTimeout(r, 500));

  // Capture screenshot with [E] EQUIP prompt visible
  const shotPrompt = await sendCommand(5, 'Page.captureScreenshot', { format: 'png' });
  if (shotPrompt.result?.data) {
    fs.writeFileSync(`${artifactDir}/shot7_weapon_pickup_prompt.png`, Buffer.from(shotPrompt.result.data, 'base64'));
    console.log('Saved shot7_weapon_pickup_prompt.png');
  }

  // Collect pickup
  console.log('[PICKUP TEST] Collecting pickup...');
  await sendCommand(6, 'Runtime.evaluate', {
    expression: `
      const p = window.game.pickups.pickups.find(p => p.weaponKey === 'chaperone');
      if (p) window.game.pickups._collectPickup(p, (slot) => window.game.switchWeapon(slot));
      window.game.weapons.def.name
    `
  });
  await new Promise(r => setTimeout(r, 500));

  const shotEquipped = await sendCommand(7, 'Page.captureScreenshot', { format: 'png' });
  if (shotEquipped.result?.data) {
    fs.writeFileSync(`${artifactDir}/shot8_weapon_equipped.png`, Buffer.from(shotEquipped.result.data, 'base64'));
    console.log('Saved shot8_weapon_equipped.png');
  }

  console.log('[PICKUP TEST] Finished!');
  ws.close();
  proc.kill();
  process.exit(0);
};
