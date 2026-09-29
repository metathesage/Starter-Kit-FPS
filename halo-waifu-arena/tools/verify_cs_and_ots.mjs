import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9228',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_shot_verify_final',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2200));

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9228/json', res => {
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

  // Wait 3.5s for initial assets to load
  setTimeout(() => {
    // 1. Click start prompt to engage match
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: 'document.getElementById("start-prompt").click(); window.game ? window.game.currentMapKey : "none"' }
    }));

    // 2. Capture 1st Person FPS Gameplay with AK-47
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 10,
        method: 'Page.captureScreenshot',
        params: { format: 'png' }
      }));
    }, 1800);

    // 3. Toggle into 3rd Person OTS mode (Mai Maid)
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 11,
        method: 'Runtime.evaluate',
        params: { expression: 'window.game.togglePerspective(); window.game.perspective' }
      }));

      // Capture Mai in 3rd Person OTS
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 20,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
      }, 1500);

      // 4. Switch to Miyazawa in 3rd person
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 21,
          method: 'Runtime.evaluate',
          params: { expression: 'window.game._loadHeroine("miyazawa"); "loading miyazawa"' }
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 30,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));

          // 5. Switch to Lucy in 3rd person
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 31,
              method: 'Runtime.evaluate',
              params: { expression: 'window.game._loadHeroine("lucy"); "loading lucy"' }
            }));

            setTimeout(() => {
              ws.send(JSON.stringify({
                id: 40,
                method: 'Page.captureScreenshot',
                params: { format: 'png' }
              }));

              // Query match state
              setTimeout(() => {
                ws.send(JSON.stringify({
                  id: 50,
                  method: 'Runtime.evaluate',
                  params: {
                    expression: 'JSON.stringify({ csMatch: window.game.csMatch, living: window.game.botManager.getLivingCounts(), bots: window.game.botManager.bots.map(b => ({ name: b.name, team: b.team, alive: b.alive, hp: b.health })) })',
                    returnByValue: true
                  }
                }));
              }, 1000);
            }, 2500);
          }, 3000);
        }, 2800);
      }, 3500);
    }, 4000);
  }, 3500);
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
    console.log('[BROWSER CONSOLE]', msg.params.type, text);
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
  }

  if (msg.id === 3 && msg.result) {
    console.log('[TEST] Game map active:', msg.result.value || msg.result);
  }

  if (msg.id === 10 && msg.result && msg.result.data) {
    const buf = Buffer.from(msg.result.data, 'base64');
    fs.writeFileSync('cs_shot1_fps_ak47.png', buf);
    console.log('[TEST 1/4] Saved cs_shot1_fps_ak47.png (' + (buf.length / 1024).toFixed(1) + ' KB)');
  }

  if (msg.id === 20 && msg.result && msg.result.data) {
    const buf = Buffer.from(msg.result.data, 'base64');
    fs.writeFileSync('cs_shot2_ots_mai.png', buf);
    console.log('[TEST 2/4] Saved cs_shot2_ots_mai.png (' + (buf.length / 1024).toFixed(1) + ' KB)');
  }

  if (msg.id === 30 && msg.result && msg.result.data) {
    const buf = Buffer.from(msg.result.data, 'base64');
    fs.writeFileSync('cs_shot3_ots_miyazawa.png', buf);
    console.log('[TEST 3/4] Saved cs_shot3_ots_miyazawa.png (' + (buf.length / 1024).toFixed(1) + ' KB)');
  }

  if (msg.id === 40 && msg.result && msg.result.data) {
    const buf = Buffer.from(msg.result.data, 'base64');
    fs.writeFileSync('cs_shot4_ots_lucy.png', buf);
    console.log('[TEST 4/4] Saved cs_shot4_ots_lucy.png (' + (buf.length / 1024).toFixed(1) + ' KB)');
  }

  if (msg.id === 50 && msg.result) {
    console.log('[MATCH STATUS]', msg.result.value || msg.result);
    proc.kill();
    process.exit(0);
  }
};
