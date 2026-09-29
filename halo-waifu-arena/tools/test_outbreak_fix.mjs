import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9272',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_outbreak',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9272/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

  setTimeout(async () => {
    // Dismiss prompt
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: 'document.getElementById("start-prompt").style.display = "none"; window.game.switchWeapon(1);' }
    }));
    await new Promise(r => setTimeout(r, 400));

    // Center and rotate outbreak
    const expr = `
      (() => {
        const entry = window.game.viewmodel.weaponGroups['outbreak'];
        const m = entry.group.children[0];
        m.rotation.set(0, Math.PI / 2, 0);
        m.scale.set(0.65, 0.65, 0.65);
        m.position.set(-0.25, 0.05, 0.15);
        entry.def.pos = [0.18, -0.16, -0.38];
      })()
    `;
    ws.send(JSON.stringify({ id: 4, method: 'Runtime.evaluate', params: { expression: expr } }));
    await new Promise(r => setTimeout(r, 400));

    ws.send(JSON.stringify({ id: 5, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  }, 2000);
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id === 5 && msg.result?.data) {
    fs.writeFileSync('outbreak_fixed.png', Buffer.from(msg.result.data, 'base64'));
    console.log('outbreak_fixed.png saved');
    proc.kill();
    process.exit(0);
  }
};
