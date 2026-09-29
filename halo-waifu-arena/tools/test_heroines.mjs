import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9227',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_shot_heroines',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2200));

const targets = await new Promise((res, rej) => {
  http.get('http://localhost:9227/json', r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => res(JSON.parse(d)));
  }).on('error', rej);
});
const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

  setTimeout(() => {
    // Switch to OTS and load Miyazawa
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: 'window.game.togglePerspective(); window.game._loadHeroine("miyazawa");' }
    }));

    // Wait 3.5s for Miyazawa to load and settle
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 10,
        method: 'Runtime.evaluate',
        params: { expression: 'window.game.heroineGroup.children.map(c => ({ name: c.name, type: c.type, visible: c.visible, pos: c.position }))' }
      }));

      ws.send(JSON.stringify({
        id: 20,
        method: 'Page.captureScreenshot',
        params: { format: 'png' }
      }));

      // Now test Lucy with rotY: Math.PI
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 25,
          method: 'Runtime.evaluate',
          params: { expression: 'window.game._loadHeroine("lucy");' }
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 30,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 3000);
      }, 2000);
    }, 3500);
  }, 3500);
};

ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled') {
    console.log('[LOG]', m.params.args.map(a => a.value || a.description || '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    console.error('[ERR]', m.params.exceptionDetails);
  }
  if (m.id === 10 && m.result) {
    console.log('[MIYAZAWA CHILDREN]', JSON.stringify(m.result.value || m.result));
  }
  if (m.id === 20 && m.result && m.result.data) {
    fs.writeFileSync('cs_test_miyazawa.png', Buffer.from(m.result.data, 'base64'));
    console.log('Saved cs_test_miyazawa.png');
  }
  if (m.id === 30 && m.result && m.result.data) {
    fs.writeFileSync('cs_test_lucy.png', Buffer.from(m.result.data, 'base64'));
    console.log('Saved cs_test_lucy.png');
    proc.kill();
    process.exit(0);
  }
};
