import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9260',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_gallery',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9260/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

const weaponKeys = ['ace', 'outbreak', 'chaperone', 'sword', 'lament', 'hawkmoon', 'smg', 'shotgun', 'launcher'];

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

  setTimeout(async () => {
    // Dismiss start prompt
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: 'document.getElementById("start-prompt").style.display = "none"' }
    }));

    for (let i = 0; i < weaponKeys.length; i++) {
      const key = weaponKeys[i];
      // Switch weapon
      await new Promise(resolve => {
        ws.send(JSON.stringify({
          id: 10 + i,
          method: 'Runtime.evaluate',
          params: { expression: `window.game.switchWeapon(${i})` }
        }));
        setTimeout(resolve, 300);
      });

      // Capture screenshot
      await new Promise(resolve => {
        const shotId = 100 + i;
        const handler = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.id === shotId && msg.result?.data) {
            ws.removeEventListener('message', handler);
            fs.writeFileSync(`wpn_${key}.png`, Buffer.from(msg.result.data, 'base64'));
            console.log(`Saved wpn_${key}.png`);
            resolve();
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: shotId, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      });
    }

    proc.kill();
    process.exit(0);
  }, 2000);
};
