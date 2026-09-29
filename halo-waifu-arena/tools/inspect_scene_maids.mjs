import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9254',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_inspect_maids_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9254/json', res => {
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
      window.game.loadMap("rust");
      window.game.startMatchFromSplash();
      const splash = document.getElementById("splash-screen");
      if (splash) splash.style.display = "none";
    `
  });
  await new Promise(r => setTimeout(r, 3000));

  const info = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const results = [];
        window.game.scene.traverse(obj => {
          if (obj.isMesh && obj.visible) {
            const name = (obj.name || '') + ' (parent: ' + (obj.parent ? obj.parent.name : 'none') + ')';
            if (name.toLowerCase().includes('maid') || name.toLowerCase().includes('mai') || name.toLowerCase().includes('skirt') || name.toLowerCase().includes('body') || name.toLowerCase().includes('heroine')) {
              results.push({
                name,
                pos: [obj.position.x.toFixed(2), obj.position.y.toFixed(2), obj.position.z.toFixed(2)],
                scale: [obj.scale.x.toFixed(2), obj.scale.y.toFixed(2), obj.scale.z.toFixed(2)],
                parent: obj.parent ? obj.parent.name : 'root'
              });
            }
          }
        });
        const hPos = window.game.heroineGroup.position;
        const hScale = window.game.heroineGroup.scale;

        const bots = window.game.botManager.bots.map(b => {
          return {
            name: b.name,
            pos: [b.pos.x.toFixed(2), b.pos.y.toFixed(2), b.pos.z.toFixed(2)],
            hasMesh: !!b.modelMesh,
            scale: b.modelMesh ? [b.modelMesh.scale.x.toFixed(2), b.modelMesh.scale.y.toFixed(2), b.modelMesh.scale.z.toFixed(2)] : 'none',
            visible: b.root.visible
          };
        });

        return JSON.stringify({
          camPos: [window.game.camera.position.x.toFixed(2), window.game.camera.position.y.toFixed(2), window.game.camera.position.z.toFixed(2)],
          heroineGroup: {
            pos: [hPos.x.toFixed(2), hPos.y.toFixed(2), hPos.z.toFixed(2)],
            scale: [hScale.x.toFixed(2), hScale.y.toFixed(2), hScale.z.toFixed(2)],
            visible: window.game.heroineGroup.visible,
            children: window.game.heroineGroup.children.map(c => ({ name: c.name, scale: [c.scale.x, c.scale.y, c.scale.z] }))
          },
          bots,
          meshSample: results.slice(0, 10)
        }, null, 2);
      })()
    `
  });

  console.log('INFO OBJECT:', JSON.stringify(info));
  proc.kill();
  process.exit(0);
};
