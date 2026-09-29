import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9244',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_showcase_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9244/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
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
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const outDir = 'c:\\Users\\young\\OneDrive\\Documents\\Desktop\\GAME D3V\\halo-waifu-arena\\screenshots';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function takeShot(filename) {
  const shot = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    const fullPath = path.join(outDir, filename);
    fs.writeFileSync(fullPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${filename}`);
  }
}

ws.onopen = async () => {
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');
  await new Promise(r => setTimeout(r, 1500));

  // Dismiss splash by starting Haven
  await sendCmd('Runtime.evaluate', {
    expression: `
      window.game.loadMap("haven");
      window.game.startMatchFromSplash();
      const splash = document.getElementById("splash-screen");
      if (splash) splash.style.display = "none";
    `
  });
  await new Promise(r => setTimeout(r, 3500));

  // 1. Haven First-Person
  await sendCmd('Runtime.evaluate', { expression: 'window.game.setPerspective("FPS");' });
  await new Promise(r => setTimeout(r, 800));
  await takeShot('showcase_haven_fps.png');

  // 2. Haven Third-Person OTS
  await sendCmd('Runtime.evaluate', { expression: 'window.game.setPerspective("OTS");' });
  await new Promise(r => setTimeout(r, 800));
  await takeShot('showcase_haven_ots.png');

  // 3. Lockout First-Person
  await sendCmd('Runtime.evaluate', {
    expression: `(async () => { await window.game.loadMap("lockout"); window.game.setPerspective("FPS"); })()`,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3500));
  await takeShot('showcase_lockout_fps.png');

  // 4. Lockout Third-Person OTS
  await sendCmd('Runtime.evaluate', {
    expression: `window.game.setPerspective("OTS");`
  });
  await new Promise(r => setTimeout(r, 1200));
  await takeShot('showcase_lockout_ots.png');

  // 5. Rust First-Person
  await sendCmd('Runtime.evaluate', {
    expression: `(async () => { await window.game.loadMap("rust"); window.game.setPerspective("FPS"); })()`,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3500));
  await takeShot('showcase_rust_fps.png');

  // 6. Rust Third-Person OTS
  await sendCmd('Runtime.evaluate', {
    expression: `window.game.setPerspective("OTS");`
  });
  await new Promise(r => setTimeout(r, 1200));
  await takeShot('showcase_rust_ots.png');

  proc.kill();
  process.exit(0);
};
