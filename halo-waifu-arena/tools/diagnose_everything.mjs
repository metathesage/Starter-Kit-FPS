import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9294',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_diag_all_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9294/json', res => {
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

const consoleLogs = [];

ws.onopen = async () => {
  ws.addEventListener('message', (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
      consoleLogs.push(`[${msg.params.type.toUpperCase()}] ${args}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleLogs.push(`[EXCEPTION] ${JSON.stringify(msg.params.exceptionDetails)}`);
    }
  });

  await sendCmd('Runtime.enable');
  await sendCmd('Log.enable');
  await sendCmd('Network.enable');

  await new Promise(r => setTimeout(r, 1500));

  // 1. Check startup state
  console.log('--- STARTUP CONSOLE LOGS ---');
  consoleLogs.forEach(l => console.log(l));
  consoleLogs.length = 0;

  // 2. Load Haven and check
  console.log('\n--- TESTING HAVEN ---');
  await sendCmd('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          await window.game.loadMap("haven");
          window.game.startMatchFromSplash();
          const s = document.getElementById("splash-screen");
          if (s) s.style.display = "none";
        } catch(e) {
          console.error("HAVEN LOAD ERROR:", e.stack);
        }
      })()
    `,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3000));

  const havenDiag = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const p = window.game.character.pos;
        const gy = window.game.collision ? window.game.collision.groundHeight(p.x, p.z, p.y + 5, 20) : null;
        const bots = window.game.botManager.bots.map(b => ({
          name: b.name,
          pos: [b.pos.x.toFixed(2), b.pos.y.toFixed(2), b.pos.z.toFixed(2)],
          alive: b.alive,
          hasMixer: !!b.mixer,
          idlePlaying: b.idleAction ? b.idleAction.isRunning() : false,
          stepPlaying: b.stepAction ? b.stepAction.isRunning() : false,
          actions: b.mixer ? Object.keys(b).filter(k => k.includes('Action')).map(k => ({ [k]: !!b[k] })) : []
        }));
        return JSON.stringify({
          playerPos: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)],
          groundY: gy,
          grounded: window.game.character.grounded,
          velY: window.game.character.vel.y,
          botsCount: bots.length,
          botsSample: bots.slice(0, 3)
        }, null, 2);
      })()
    `
  });
  console.log('Haven Diag:', havenDiag?.result?.value);
  consoleLogs.forEach(l => console.log(l));
  consoleLogs.length = 0;

  // 3. Test shooting
  console.log('\n--- TESTING SHOOTING ---');
  await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        window.game.shoot();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 200));

  const shootDiag = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const vm = window.game.viewmodel;
        return JSON.stringify({
          flashMeshVisible: vm.flashMesh ? vm.flashMesh.visible : null,
          flashOpacity: vm.flashMesh && vm.flashMesh.material ? vm.flashMesh.material.opacity : null,
          flashMatType: vm.flashMesh && vm.flashMesh.material ? vm.flashMesh.material.type : null,
          tracersCount: window.game.tracers.length,
          activeKey: vm.activeKey
        }, null, 2);
      })()
    `
  });
  console.log('Shoot Diag:', shootDiag?.result?.value);
  consoleLogs.forEach(l => console.log(l));
  consoleLogs.length = 0;

  // 4. Test Lockout
  console.log('\n--- TESTING LOCKOUT ---');
  await sendCmd('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          await window.game.loadMap("lockout");
        } catch(e) {
          console.error("LOCKOUT LOAD ERROR:", e.stack);
        }
      })()
    `,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3000));

  const lockoutDiag = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const p = window.game.character.pos;
        const gy = window.game.collision ? window.game.collision.groundHeight(p.x, p.z, p.y + 5, 20) : null;
        return JSON.stringify({
          playerPos: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)],
          groundY: gy,
          grounded: window.game.character.grounded,
          velY: window.game.character.vel.y,
          mapMeshFound: !!window.game.mapMesh
        }, null, 2);
      })()
    `
  });
  console.log('Lockout Diag:', lockoutDiag?.result?.value);
  consoleLogs.forEach(l => console.log(l));

  proc.kill();
  process.exit(0);
};
