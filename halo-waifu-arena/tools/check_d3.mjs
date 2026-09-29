import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const d3Path = path.resolve('../d3/index.html');

console.log('Testing d3 at:', d3Path);

const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9225',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_d3_diag',
  `file:///${d3Path.replace(/\\/g, '/')}`
]);

await new Promise(r => setTimeout(r, 2000));

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9225/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

try {
  const targets = await getTargets();
  const page = targets.find(t => t.url && t.url.includes('d3'));
  if (!page) {
    console.log('Page target not found:', targets);
    proc.kill();
    process.exit(1);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    ws.send(JSON.stringify({ id: 3, method: 'Page.enable' }));
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 4,
        method: 'Runtime.evaluate',
        params: { expression: 'document.title + " | canvas: " + !!document.querySelector("canvas")' }
      }));
    }, 2000);
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
    } else if (msg.method === 'Log.entryAdded') {
      console.log('[BROWSER LOG]', msg.params.entry);
    } else if (msg.id === 4) {
      console.log('[EVAL RESULT]', msg.result);
      setTimeout(() => {
        proc.kill();
        process.exit(0);
      }, 500);
    }
  };
} catch (e) {
  console.error(e);
  proc.kill();
}
