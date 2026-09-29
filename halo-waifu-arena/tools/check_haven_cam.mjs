import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9274',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_haven_cam_' + Date.now(),
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9274/json', res => {
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
  await new Promise(r => setTimeout(r, 3000));

  const state = await sendCmd('Runtime.evaluate', {
    expression: `
      JSON.stringify({
        playerPos: window.game.character.pos,
        pitch: window.game.character.pitch,
        yaw: window.game.character.yaw,
        camRot: window.game.camera.rotation,
        pivotRot: window.game.cameraPivot.rotation,
        mapMeshPos: window.game.mapMesh ? window.game.mapMesh.position : null,
        mapMeshVisible: window.game.mapMesh ? window.game.mapMesh.visible : null
      }, null, 2)
    `
  });

  console.log('HAVEN CAM STATE:', state?.result?.value);
  proc.kill();
  process.exit(0);
};
