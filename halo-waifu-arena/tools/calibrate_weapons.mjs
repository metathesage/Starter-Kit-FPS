import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const candidateConfigs = {
  ace: { rot: [0, Math.PI / 2, 0], scale: 0.9, pos: [0.18, -0.15, -0.32], adsPos: [0, -0.115, -0.24] },
  outbreak: { rot: [0, Math.PI / 2, 0], scale: 0.26, pos: [0.16, -0.16, -0.38], adsPos: [0, -0.125, -0.28] },
  chaperone: { rot: [0, 0, 0], scale: 0.85, pos: [0.18, -0.18, -0.38], adsPos: [0, -0.135, -0.28] },
  sword: { rot: [-Math.PI / 2.2, 0.25, -0.2], scale: 0.65, pos: [0.22, -0.24, -0.36], adsPos: [0.08, -0.18, -0.3] },
  lament: { rot: [-Math.PI / 2.3, 0.2, -0.15], scale: 0.52, pos: [0.22, -0.26, -0.42], adsPos: [0.08, -0.18, -0.35] },
  hawkmoon: { rot: [0, 0, 0], scale: 0.85, pos: [0.18, -0.15, -0.32], adsPos: [0, -0.115, -0.24] },
  smg: { rot: [0, Math.PI / 2, 0], scale: 0.85, pos: [0.16, -0.15, -0.34], adsPos: [0, -0.12, -0.26] },
  shotgun: { rot: [0, Math.PI / 2, 0], scale: 0.78, pos: [0.18, -0.18, -0.38], adsPos: [0, -0.13, -0.28] },
  launcher: { rot: [0, 0, 0], scale: 0.75, pos: [0.20, -0.18, -0.42], adsPos: [0, -0.14, -0.32] }
};

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9265',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_calibrate',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9265/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

  setTimeout(async () => {
    // Hide start prompt
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: 'document.getElementById("start-prompt").style.display = "none"' }
    }));

    const keys = Object.keys(candidateConfigs);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const cfg = candidateConfigs[key];

      // Apply calibration to live viewmodel
      const expr = `
        (() => {
          const vm = window.game.viewmodel;
          window.game.switchWeapon(${i});
          const entry = vm.weaponGroups['${key}'];
          if (entry && entry.group.children[0]) {
            const m = entry.group.children[0];
            m.rotation.set(${cfg.rot[0]}, ${cfg.rot[1]}, ${cfg.rot[2]});
            m.scale.set(${cfg.scale}, ${cfg.scale}, ${cfg.scale});
            entry.def.pos = [${cfg.pos.join(',')}];
            entry.def.adsPos = [${cfg.adsPos.join(',')}];
          }
        })()
      `;
      ws.send(JSON.stringify({ id: 20 + i, method: 'Runtime.evaluate', params: { expression: expr } }));
      await new Promise(r => setTimeout(r, 350));

      // Capture screenshot
      await new Promise(resolve => {
        const shotId = 200 + i;
        const handler = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.id === shotId && msg.result?.data) {
            ws.removeEventListener('message', handler);
            fs.writeFileSync(`calib_${key}.png`, Buffer.from(msg.result.data, 'base64'));
            console.log(`Calibrated screenshot saved: calib_${key}.png`);
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
