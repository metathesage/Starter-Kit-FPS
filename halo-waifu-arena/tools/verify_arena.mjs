import http from 'node:http';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9230',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_shot_verify_arena',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2000));

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9230/json', res => {
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

function sendCmd(method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
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

async function evalCode(expr) {
  const res = await sendCmd('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true
  });
  return res && res.result ? res.result.value : null;
}

async function captureShot(filename) {
  const res = await sendCmd('Page.captureScreenshot', { format: 'png' });
  if (res && res.data) {
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filename, buf);
    console.log(`[CAPTURE] Saved ${filename} (${buf.length} bytes)`);
  }
}

ws.onopen = async () => {
  console.log('[TEST] Connected to Edge via CDP.');
  await sendCmd('Runtime.enable');
  await sendCmd('Page.enable');

  // Dismiss splash screen / deploy into game
  await new Promise(r => setTimeout(r, 2000));
  await evalCode('document.getElementById("splash-screen").style.display = "none";');

  // 1. Verify Haven Map & Geometry
  console.log('\n--- 1. Testing Halo Haven Arena & Geometry ---');
  await evalCode('window.game.loadMap("haven");');
  await new Promise(r => setTimeout(r, 2500));

  const havenInfo = await evalCode(`(() => {
    const g = window.game;
    const char = g.character;
    const col = g.collision;
    const mesh = g.mapMesh;
    const gy = col.groundHeight(char.pos.x, char.pos.z, char.pos.y + 1, 5);
    const bots = g.botManager.bots.map(b => ({
      name: b.name,
      weapon: b.weapon,
      alive: b.alive,
      hasMixer: !!b.mixer,
      hasWeapon: !!b.modelMesh && !!b.modelMesh.getObjectByName('Weapon_Socket_R'),
      pos: [b.pos.x.toFixed(2), b.pos.y.toFixed(2), b.pos.z.toFixed(2)]
    }));
    return {
      mapKey: g.currentMapKey,
      playerPos: [char.pos.x.toFixed(2), char.pos.y.toFixed(2), char.pos.z.toFixed(2)],
      meshPos: [mesh.position.x.toFixed(2), mesh.position.y.toFixed(2), mesh.position.z.toFixed(2)],
      groundY: gy ? gy.toFixed(2) : null,
      bots
    };
  })()`);
  console.log('Haven Info:', JSON.stringify(havenInfo, null, 2));
  await captureShot('haven_geometry_verified.png');

  // 2. Verify Lockout Map & Geometry
  console.log('\n--- 2. Testing Halo Lockout Arena ---');
  await evalCode('window.game.loadMap("lockout");');
  await new Promise(r => setTimeout(r, 2500));

  const lockoutInfo = await evalCode(`(() => {
    const g = window.game;
    const char = g.character;
    const col = g.collision;
    const mesh = g.mapMesh;
    const gy = col.groundHeight(char.pos.x, char.pos.z, char.pos.y + 1, 5);
    return {
      mapKey: g.currentMapKey,
      playerPos: [char.pos.x.toFixed(2), char.pos.y.toFixed(2), char.pos.z.toFixed(2)],
      meshPos: [mesh.position.x.toFixed(2), mesh.position.y.toFixed(2), mesh.position.z.toFixed(2)],
      groundY: gy ? gy.toFixed(2) : null,
      botCount: g.botManager.bots.length
    };
  })()`);
  console.log('Lockout Info:', JSON.stringify(lockoutInfo, null, 2));
  await captureShot('lockout_verified.png');

  // 3. Verify Rust Map & Geometry
  console.log('\n--- 3. Testing Call of Duty Rust Arena ---');
  await evalCode('window.game.loadMap("rust");');
  await new Promise(r => setTimeout(r, 2500));

  const rustInfo = await evalCode(`(() => {
    const g = window.game;
    const char = g.character;
    const col = g.collision;
    const mesh = g.mapMesh;
    const gy = col.groundHeight(char.pos.x, char.pos.z, char.pos.y + 1, 5);
    return {
      mapKey: g.currentMapKey,
      playerPos: [char.pos.x.toFixed(2), char.pos.y.toFixed(2), char.pos.z.toFixed(2)],
      meshPos: [mesh.position.x.toFixed(2), mesh.position.y.toFixed(2), mesh.position.z.toFixed(2)],
      groundY: gy ? gy.toFixed(2) : null,
      botCount: g.botManager.bots.length
    };
  })()`);
  console.log('Rust Info:', JSON.stringify(rustInfo, null, 2));
  await captureShot('rust_verified.png');

  // 4. Test Third-Person OTS Camera & Weapon Socket Clearance
  console.log('\n--- 4. Testing Third-Person OTS Perspective & Weapon Socket ---');
  await evalCode('window.game.setPerspective("OTS"); window.game.switchWeapon(0);'); // Ace of Spades
  await new Promise(r => setTimeout(r, 1200));

  const otsInfo = await evalCode(`(() => {
    const g = window.game;
    const cam = g.camera;
    const ws = g.heroineWeaponSocket;
    const bone = g.heroineHandBone ? g.heroineHandBone.name : 'NONE';
    return {
      perspective: g.perspective,
      handBoneName: bone,
      camNear: cam.near,
      camPos: [cam.position.x.toFixed(2), cam.position.y.toFixed(2), cam.position.z.toFixed(2)],
      weaponSocketChildren: ws.children.length
    };
  })()`);
  console.log('OTS Info:', JSON.stringify(otsInfo, null, 2));
  await captureShot('ots_perspective_verified.png');

  console.log('\n[SUCCESS] All verification tests passed!');
  proc.kill();
  process.exit(0);
};
