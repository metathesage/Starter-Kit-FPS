import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9232',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_debug_miyazawa_clean',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2200));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9232/json', res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  setTimeout(() => {
    console.log('Requesting Mai switch...');
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: { expression: 'window.game._loadHeroine("mai");' }
    }));

    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const g = window.game;
            const res = [];
            g.heroineGroup.traverse(c => {
              if (c.name.includes('Socket') || c.name.includes('Hand') || c.name.includes('hand')) {
                const wp = new c.position.constructor();
                const wq = new c.quaternion.constructor();
                c.getWorldPosition(wp);
                c.getWorldQuaternion(wq);
                res.push({
                  name: c.name,
                  pos: [wp.x.toFixed(3), wp.y.toFixed(3), wp.z.toFixed(3)],
                  fwd: new c.position.constructor(0, 0, -1).applyQuaternion(wq).toArray().map(v=>v.toFixed(2)),
                  up: new c.position.constructor(0, 1, 0).applyQuaternion(wq).toArray().map(v=>v.toFixed(2))
                });
              }
            });
            return JSON.stringify(res, null, 2);
          })()`
        }
      }));
    }, 3500);
  }, 3500);
};

ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    console.log('[LOG]', msg.params.args.map(a => a.value || a.description || '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    console.error('[ERR]', msg.params.exceptionDetails);
  }
  if (msg.id === 3) {
    console.log('RESULT:\n', JSON.stringify(msg.result, null, 2));
    proc.kill();
    process.exit(0);
  }
};
