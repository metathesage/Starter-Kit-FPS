import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9299',
  '--user-data-dir=' + process.env.TEMP + '\\edge_dbg2',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9299/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.type === 'page' || (t.url && t.url.includes('8080')));
if (!page) {
  console.log('No page found');
  proc.kill();
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));

  setTimeout(() => {
    ws.send(JSON.stringify({
      id: 10,
      method: 'Runtime.evaluate',
      params: {
        expression: `JSON.stringify({
          gameExists: !!window.game,
          lastError: window._lastError || null,
          hasScene: !!window.game?.scene,
          sceneChildrenCount: window.game?.scene?.children?.length,
          childrenNames: window.game?.scene?.children?.map(c => c.type + ':' + (c.name || 'unnamed')),
          cameraPos: window.game?.camera?.position?.toArray(),
          pivotPos: window.game?.cameraPivot?.position?.toArray(),
          charPos: window.game?.character?.pos?.toArray()
        })`,
        returnByValue: true
      }
    }));
  }, 3000);
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id === 10) {
    console.log('DEBUG DUMP:', msg.result?.result?.value);
    proc.kill();
    process.exit(0);
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map(a => a.value || a.description).join(' ');
    console.log('[BROWSER CONSOLE]', msg.params.type, text);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    console.error('[BROWSER ERROR]', msg.params.exceptionDetails);
  }
};
