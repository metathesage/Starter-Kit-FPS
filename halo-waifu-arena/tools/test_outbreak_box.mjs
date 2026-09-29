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
  '--user-data-dir=' + process.env.TEMP + '\\edge_ob_box',
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

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

  setTimeout(async () => {
    const expr = `
      (() => {
        document.getElementById('start-prompt').style.display = 'none';
        window.game.switchWeapon(1);
        const entry = window.game.viewmodel.weaponGroups['outbreak'];
        const m = entry.group.children[0];
        m.rotation.set(0, Math.PI / 2, 0);
        m.scale.set(0.24, 0.24, 0.24);
        m.position.set(0, 0, 0);
      })()
    `;
    ws.send(JSON.stringify({ id: 3, method: 'Runtime.evaluate', params: { expression: expr } }));
    await new Promise(r => setTimeout(r, 400));

    // Measure box
    const measureExpr = `
      (() => {
        const entry = window.game.viewmodel.weaponGroups['outbreak'];
        const m = entry.group.children[0];
        // Calculate world bounds using Three from window or character
        const box = new window.game.character.pos.constructor(); // Vector3
        // We can get Box3 from THREE.Box3 if available, or compute from children
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        m.traverse(c => {
          if (c.isMesh && c.geometry) {
            c.geometry.computeBoundingBox();
            const b = c.geometry.boundingBox;
            minX = Math.min(minX, b.min.x * 0.24);
            maxX = Math.max(maxX, b.max.x * 0.24);
            minY = Math.min(minY, b.min.y * 0.24);
            maxY = Math.max(maxY, b.max.y * 0.24);
            minZ = Math.min(minZ, b.min.z * 0.24);
            maxZ = Math.max(maxZ, b.max.z * 0.24);
          }
        });
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const midZ = (minZ + maxZ) / 2;
        // Apply offset
        m.position.set(-midZ, -midY, midX);
        return { minX, maxX, minY, maxY, minZ, maxZ, midX, midY, midZ };
      })()
    `;
    ws.send(JSON.stringify({ id: 4, method: 'Runtime.evaluate', params: { expression: measureExpr, returnByValue: true } }));
    await new Promise(r => setTimeout(r, 400));

    ws.send(JSON.stringify({ id: 5, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  }, 2000);
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id === 4) console.log('Bounds result:', msg.result?.result?.value);
  if (msg.id === 5 && msg.result?.data) {
    fs.writeFileSync('outbreak_bounds_test.png', Buffer.from(msg.result.data, 'base64'));
    console.log('outbreak_bounds_test.png saved');
    proc.kill();
    process.exit(0);
  }
};
