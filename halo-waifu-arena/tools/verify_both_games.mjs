import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testUrl(url, name) {
  console.log(`\n=== TESTING ${name}: ${url} ===`);
  const port = 9230 + Math.floor(Math.random() * 50);
  const proc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + process.env.TEMP + `\\edge_test_${port}`,
    url
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/json`, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
  if (!page) {
    console.error('Target not found for', url);
    proc.kill();
    return;
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => {
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: {
            expression: `({
              title: document.title,
              canvas: !!document.querySelector('canvas'),
              canvasSize: document.querySelector('canvas') ? { w: document.querySelector('canvas').width, h: document.querySelector('canvas').height } : null,
              errors: window._lastError
            })`,
            returnByValue: true
          }
        }));
      }, 2000);
    };

    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error(`[${name} EXCEPTION]`, msg.params.exceptionDetails);
      }
      if (msg.id === 3) {
        console.log(`[${name} EVAL RESULT]`, JSON.stringify(msg.result?.result?.value));
        proc.kill();
        resolve();
      }
    };
  });
}

await testUrl('http://localhost:8080', 'HALO WAIFU ARENA');
await testUrl('http://localhost:8080/d3/', 'WAIFU DESTINY');
process.exit(0);
