import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9264',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_diag_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9264/json', res => {
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
  await new Promise(r => setTimeout(r, 1500));

  await sendCmd('Runtime.evaluate', {
    expression: `
      (async () => {
        await window.game.loadMap("rust");
        window.game.startMatchFromSplash();
        const splash = document.getElementById("splash-screen");
        if (splash) splash.style.display = "none";
        window.game.setPerspective("FPS");
      })()
    `,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3000));

  const diag = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        try {
          const cp = window.game.camera.position;
          const closeMeshes = [];
          window.game.scene.traverse(obj => {
            if (obj.isMesh && obj.visible) {
              const dx = obj.position.x - cp.x;
              const dy = obj.position.y - cp.y;
              const dz = obj.position.z - cp.z;
              const dist = Math.hypot(dx, dy, dz);
              if (dist < 5.0) {
                closeMeshes.push({
                  name: obj.name,
                  parent: obj.parent ? obj.parent.name : null,
                  dist: dist.toFixed(2),
                  pos: [obj.position.x.toFixed(2), obj.position.y.toFixed(2), obj.position.z.toFixed(2)],
                  scale: [obj.scale.x.toFixed(2), obj.scale.y.toFixed(2), obj.scale.z.toFixed(2)]
                });
              }
            }
          });
          return JSON.stringify({
            camPos: [cp.x.toFixed(2), cp.y.toFixed(2), cp.z.toFixed(2)],
            playerPos: [window.game.character.pos.x.toFixed(2), window.game.character.pos.y.toFixed(2), window.game.character.pos.z.toFixed(2)],
            heroineVisible: window.game.heroineGroup.visible,
            heroineChildren: window.game.heroineGroup.children.map(c => ({ name: c.name, visible: c.visible })),
            closeMeshes: closeMeshes.slice(0, 15)
          }, null, 2);
        } catch(e) {
          return e.stack;
        }
      })()
    `
  });

  console.log('DIAG RESULT:', diag?.result?.value);
  proc.kill();
  process.exit(0);
};
