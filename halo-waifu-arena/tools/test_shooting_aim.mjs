import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9240',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_debug_aim',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2200));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9240/json', res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

  setTimeout(() => {
    // 1. Engage combat
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          document.getElementById('start-prompt').click();
          return 'engaged';
        })()`
      }
    }));

    // Wait 3s for round to start and bots to position
    setTimeout(() => {
      // 2. Fire 3 shots in FPS mode
      ws.send(JSON.stringify({
        id: 4,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const g = window.game;
            // Simulate firing
            g.weapons._fire(
              g.camera.getWorldPosition(new g.camera.position.constructor()),
              g.character.yaw,
              g.character.pitch,
              g.botManager.bots,
              g.aimCrosshairTarget,
              g.weaponMuzzleWorldPos
            );
            return {
              ammo: g.weapons.ammo,
              tracers: g.tracers.length,
              target: g.aimCrosshairTarget,
              muzzle: g.weaponMuzzleWorldPos
            };
          })()`,
          returnByValue: true
        }
      }));

      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 10,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
      }, 300);

      // 3. Toggle to OTS and fire 3 shots
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 5,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              const g = window.game;
              g.togglePerspective();
              // Fire in OTS mode
              g.weapons._fire(
                g.camera.getWorldPosition(new g.camera.position.constructor()),
                g.character.yaw,
                g.character.pitch,
                g.botManager.bots,
                g.aimCrosshairTarget,
                g.weaponMuzzleWorldPos
              );
              return {
                perspective: g.perspective,
                ammo: g.weapons.ammo,
                tracers: g.tracers.length,
                target: g.aimCrosshairTarget,
                muzzle: g.weaponMuzzleWorldPos
              };
            })()`,
            returnByValue: true
          }
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 20,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 300);
      }, 1500);
    }, 3500);
  }, 4000);
};

ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.id === 4) {
    const val = (msg.result && msg.result.result) ? msg.result.result.value : (msg.result ? msg.result.value : null);
    console.log('[FPS FIRE TEST]:\n', JSON.stringify(val, null, 2));
  }
  if (msg.id === 5) {
    const val = (msg.result && msg.result.result) ? msg.result.result.value : (msg.result ? msg.result.value : null);
    console.log('[OTS FIRE TEST]:\n', JSON.stringify(val, null, 2));
  }
  if (msg.id === 10 && msg.result && msg.result.data) {
    fs.writeFileSync('cs_test_fps_fire.png', Buffer.from(msg.result.data, 'base64'));
    console.log('Saved cs_test_fps_fire.png');
  }
  if (msg.id === 20 && msg.result && msg.result.data) {
    fs.writeFileSync('cs_test_ots_fire.png', Buffer.from(msg.result.data, 'base64'));
    console.log('Saved cs_test_ots_fire.png');
    proc.kill();
    process.exit(0);
  }
};
