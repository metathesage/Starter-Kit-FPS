import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9297',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_lockout_view_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9297/json', res => {
      let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

const targets = await getTargets();
const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

function sendCmd(method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const handler = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id === id) { ws.removeEventListener('message', handler); resolve(msg.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws.onopen = async () => {
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');
  await new Promise(r => setTimeout(r, 3000));

  await sendCmd('Runtime.evaluate', {
    expression: `
      (async () => {
        await window.game.loadMap("lockout");
        window.game.startMatchFromSplash();
        const splash = document.getElementById("splash-screen");
        if (splash) splash.style.display = "none";

        // Face towards the center bridge and towers
        window.game.character.yaw = 0.45;
        window.game.character.pitch = -0.15;
      })()
    `,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3000));

  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    fs.writeFileSync('./screenshots/lockout_facing_center.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved ./screenshots/lockout_facing_center.png');
  }

  proc.kill();
  process.exit(0);
};
