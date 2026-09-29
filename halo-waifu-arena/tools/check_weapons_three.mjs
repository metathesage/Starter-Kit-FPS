import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9250',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_wpn_rot',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2500));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9250/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
if (!page) {
  console.log('Page not found');
  proc.kill();
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  setTimeout(() => {
    // Evaluate weapon bounds in Three.js
    const expr = `
      (() => {
        try {
          const vm = window.game?.viewmodel;
          if (!vm) return { error: 'no game or viewmodel' };
          const res = {};
          for (const [key, entry] of Object.entries(vm.weaponGroups)) {
            const group = entry.group;
            if (!group || !group.children.length) {
              res[key] = { status: 'loading or empty' };
              continue;
            }
            const model = group.children[0];
            res[key] = {
              rot: [model.rotation.x, model.rotation.y, model.rotation.z],
              scale: [model.scale.x, model.scale.y, model.scale.z]
            };
          }
          return res;
        } catch (err) {
          return { error: err.message, stack: err.stack };
        }
      })()
    `;
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: { expression: expr, returnByValue: true }
    }));
  }, 2000);
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id === 2) {
    console.log('WEAPON BOUNDS IN VIEWMODEL:\n', JSON.stringify(msg.result.result.value, null, 2));
    proc.kill();
    process.exit(0);
  }
};
