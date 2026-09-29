import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9284',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_haven_vis_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9284/json', res => {
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
        await window.game.loadMap("haven");
        window.game.startMatchFromSplash();
        const splash = document.getElementById("splash-screen");
        if (splash) splash.style.display = "none";
      })()
    `,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 3500));

  const info = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const meshCount = window.game.mapMesh ? window.game.mapMesh.children.length : 0;
        let sampleMats = [];
        if (window.game.mapMesh) {
          window.game.mapMesh.traverse(c => {
            if (c.isMesh && sampleMats.length < 5) {
              sampleMats.push({
                meshName: c.name,
                matName: c.material ? c.material.name : 'no-mat',
                matType: c.material ? c.material.type : null,
                hasMap: !!(c.material && c.material.map),
                color: c.material && c.material.color ? '#' + c.material.color.getHexString() : null,
                visible: c.visible
              });
            }
          });
        }
        return JSON.stringify({
          currentMap: window.game.currentMapKey,
          mapMeshPos: window.game.mapMesh ? window.game.mapMesh.position : null,
          mapMeshRot: window.game.mapMesh ? window.game.mapMesh.rotation : null,
          mapMeshScale: window.game.mapMesh ? window.game.mapMesh.scale : null,
          meshCount,
          sampleMats
        }, null, 2);
      })()
    `
  });

  console.log('HAVEN VISUAL DIAGNOSTICS:');
  console.log(info?.result?.value);

  proc.kill();
  process.exit(0);
};
