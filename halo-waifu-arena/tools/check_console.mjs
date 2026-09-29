import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--remote-debugging-port=9288',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_dbg',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9288/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Log.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const args = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      console.log(`[CONSOLE ${type.toUpperCase()}]`, args);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
    }
  };

  setTimeout(async () => {
    // Check window.game state
    const evalId = 100;
    ws.send(JSON.stringify({
      id: evalId,
      method: 'Runtime.evaluate',
      params: {
        expression: `({
          gameExists: !!window.game,
          character: !!window.game?.character,
          collision: !!window.game?.collision,
          weapons: !!window.game?.weapons,
          botManager: !!window.game?.botManager,
          sceneChildren: window.game?.scene?.children?.length,
          lastError: window._lastError
        })`,
        returnByValue: true
      }
    }));
  }, 4000);

  setTimeout(() => {
    proc.kill();
    process.exit(0);
  }, 6000);
};
