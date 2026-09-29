import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9229',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_shot_anims',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2200));

const targets = await new Promise((res, rej) => {
  http.get('http://localhost:9229/json', r => {
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
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: 'document.getElementById("start-prompt").click(); window.game.togglePerspective();' }
    }));

    setTimeout(() => {
      // Test ani_idle_basic_new vs no animation
      ws.send(JSON.stringify({
        id: 4,
        method: 'Runtime.evaluate',
        params: { expression: 'window.game._loadHeroine("miyazawa");' }
      }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
        setTimeout(() => {
          proc.kill();
          process.exit(0);
        }, 1000);
      }, 3500);
    }, 1500);
  }, 3500);
};

ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id === 10 && m.result && m.result.data) {
    fs.writeFileSync('miyazawa_anim_test.png', Buffer.from(m.result.data, 'base64'));
    console.log('Saved miyazawa_anim_test.png');
  }
};
