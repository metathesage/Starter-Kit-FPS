import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9280',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_ob_lam',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9280/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

  setTimeout(async () => {
    // Test Outbreak: rot [0, -Math.PI / 2, 0] vs [0, Math.PI / 2, 0], scale 0.55
    const testOutbreak = `
      (() => {
        document.getElementById('start-prompt').style.display = 'none';
        window.game.switchWeapon(1);
        const entry = window.game.viewmodel.weaponGroups['outbreak'];
        const m = entry.group.children[0];
        m.rotation.set(0, -Math.PI / 2, 0);
        m.scale.set(0.48, 0.48, 0.48);
        entry.def.pos = [0.18, -0.16, -0.38];
      })()
    `;
    ws.send(JSON.stringify({ id: 10, method: 'Runtime.evaluate', params: { expression: testOutbreak } }));
    await new Promise(r => setTimeout(r, 400));

    ws.send(JSON.stringify({ id: 11, method: 'Page.captureScreenshot', params: { format: 'png' } }));

    // Also test Lament with [ -0.35, 0.45, -0.25 ]
    setTimeout(() => {
      const testLament = `
        (() => {
          window.game.switchWeapon(4);
          const entry = window.game.viewmodel.weaponGroups['lament'];
          const m = entry.group.children[0];
          m.rotation.set(-0.35, 0.45, -0.25);
          m.scale.set(0.65, 0.65, 0.65);
          entry.def.pos = [0.22, -0.24, -0.42];
        })()
      `;
      ws.send(JSON.stringify({ id: 20, method: 'Runtime.evaluate', params: { expression: testLament } }));
      setTimeout(() => {
        ws.send(JSON.stringify({ id: 21, method: 'Page.captureScreenshot', params: { format: 'png' } }));
      }, 400);
    }, 1000);
  }, 2000);
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id === 11 && msg.result?.data) {
    fs.writeFileSync('test_outbreak_negpi2.png', Buffer.from(msg.result.data, 'base64'));
    console.log('test_outbreak_negpi2.png saved');
  }
  if (msg.id === 21 && msg.result?.data) {
    fs.writeFileSync('test_lament_tilt.png', Buffer.from(msg.result.data, 'base64'));
    console.log('test_lament_tilt.png saved');
    proc.kill();
    process.exit(0);
  }
};
