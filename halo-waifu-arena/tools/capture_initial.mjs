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
  '--user-data-dir=' + process.env.TEMP + '\\edge_shot_init',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9227/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

const targets = await getTargets();
const page = targets.find(t => t.url && t.url.includes('localhost:8080'));

if (!page) {
  console.log('Page target not found');
  proc.kill();
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

  // Take screenshot at 1.5s (before click)
  setTimeout(() => {
    ws.send(JSON.stringify({
      id: 3,
      method: 'Page.captureScreenshot',
      params: { format: 'png' }
    }));
  }, 1500);
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id === 3 && msg.result && msg.result.data) {
    const buf = Buffer.from(msg.result.data, 'base64');
    fs.writeFileSync('initial_load_live.png', buf);
    console.log('Initial screenshot saved, size:', buf.length);
    proc.kill();
    process.exit(0);
  }
};
