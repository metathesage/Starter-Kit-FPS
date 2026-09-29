import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9235',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_debug_socket',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2200));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9235/json', res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

  setTimeout(() => {
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          document.getElementById('start-prompt').click();
          window.game.togglePerspective();
          window.game._loadHeroine('miyazawa');
          return 'ok';
        })()`
      }
    }));

    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 4,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const g = window.game;
            const hand = g.heroineHandBone;
            const socket = g.heroineWeaponSocket;
            const hp = new hand.position.constructor();
            const hq = new hand.quaternion.constructor();
            hand.getWorldPosition(hp);
            hand.getWorldQuaternion(hq);
            const sp = new socket.position.constructor();
            const sq = new socket.quaternion.constructor();
            socket.getWorldPosition(sp);
            socket.getWorldQuaternion(sq);
            return JSON.stringify({
              heroine: g.currentHeroineKey,
              handBone: hand.name,
              handWorldPos: [hp.x.toFixed(2), hp.y.toFixed(2), hp.z.toFixed(2)],
              socketParent: socket.parent ? socket.parent.name : null,
              socketWorldPos: [sp.x.toFixed(2), sp.y.toFixed(2), sp.z.toFixed(2)],
              socketScale: [socket.scale.x.toFixed(3), socket.scale.y.toFixed(3), socket.scale.z.toFixed(3)],
              socketChildren: socket.children.map(c => ({ name: c.name, scale: c.scale.x }))
            }, null, 2);
          })()`
        }
      }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
      }, 500);
    }, 4500);
  }, 4000);
};

ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.id === 4) {
    const val = (msg.result && msg.result.result) ? msg.result.result.value : (msg.result ? msg.result.value : null);
    console.log('HAND & SOCKET AUDIT:\n', val);
  }
  if (msg.id === 10 && msg.result && msg.result.data) {
    const buf = Buffer.from(msg.result.data, 'base64');
    fs.writeFileSync('cs_test_miyazawa_socket.png', buf);
    console.log('Saved cs_test_miyazawa_socket.png (' + (buf.length / 1024).toFixed(1) + ' KB)');
    proc.kill();
    process.exit(0);
  }
};
