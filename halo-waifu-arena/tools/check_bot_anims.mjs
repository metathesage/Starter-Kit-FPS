import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9296',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_bot_check_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9296/json', res => {
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

ws.onopen = async () => {
  await sendCmd('Runtime.enable');
  await new Promise(r => setTimeout(r, 5500)); // Wait for initial boot & character load

  const res = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        return JSON.stringify(window.game.botManager.bots.map(b => ({
          name: b.name,
          modelLoaded: !!b.modelMesh,
          hasMixer: !!b.mixer,
          idlePlaying: b.idleAction ? b.idleAction.isRunning() : false,
          stepPlaying: b.stepAction ? b.stepAction.isRunning() : false,
          actions: b.mixer ? Object.keys(b).filter(k => k.includes('Action')).map(k => ({ [k]: !!b[k] })) : []
        })), null, 2);
      })()
    `
  });

  console.log('Bot loading result after 5.5s:');
  console.log(res?.result?.value);
  proc.kill();
  process.exit(0);
};
