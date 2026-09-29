import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9255',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_angle_test',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9255/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

  setTimeout(() => {
    // Try setting ace rotation to [0, -Math.PI / 2, 0] or [0, Math.PI / 2, 0]
    // Let's test [0, Math.PI / 2, 0]
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (() => {
            const entry = window.game.viewmodel.weaponGroups.ace;
            const model = entry.group.children[0];
            // Test rotation
            model.rotation.set(0, Math.PI / 2, 0);
          })()
        `
      }
    }));

    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 4,
        method: 'Page.captureScreenshot',
        params: { format: 'png' }
      }));
    }, 800);
  }, 2000);
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id === 4 && msg.result?.data) {
    const buf = Buffer.from(msg.result.data, 'base64');
    fs.writeFileSync('ace_test_pi_over_2.png', buf);
    console.log('Saved ace_test_pi_over_2.png, size:', buf.length);
    proc.kill();
    process.exit(0);
  }
};
