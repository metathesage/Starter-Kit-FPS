import http from 'node:http';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const proc = spawn(edgePath, [
  '--headless=new',
  '--window-size=1280,720',
  '--remote-debugging-port=9230',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_debug_clean',
  'http://localhost:8080/index.html'
]);

await new Promise(r => setTimeout(r, 2200));

const targets = await new Promise((resolve, reject) => {
  http.get('http://localhost:9230/json', res => {
    let d = ''; res.on('data', c => d += c);
    res.on('end', () => resolve(JSON.parse(d)));
  }).on('error', reject);
});

const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
const ws = new WebSocket(page.webSocketDebuggerUrl);

ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  setTimeout(() => {
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: `({
          heroineKey: window.game.currentHeroineKey,
          heroineGroupChildren: window.game.heroineGroup.children.map(c => ({ name: c.name, type: c.type, visible: c.visible })),
          handBone: window.game.heroineHandBone ? window.game.heroineHandBone.name : null,
          socketParent: window.game.heroineWeaponSocket.parent ? window.game.heroineWeaponSocket.parent.name : null,
          socketPos: window.game.heroineWeaponSocket.position,
          socketWorldPos: (() => {
            const v = new window.game.heroineWeaponSocket.position.constructor();
            window.game.heroineWeaponSocket.getWorldPosition(v);
            return v;
          })(),
          socketChildren: window.game.heroineWeaponSocket.children.length
        })`,
        returnByValue: true
      }
    }));
  }, 4000);
};

ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.method === 'Runtime.consoleAPICalled') {
    console.log('[CONSOLE]', msg.params.args.map(a => a.value || a.description || '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    console.error('[EXCEPTION]', msg.params.exceptionDetails);
  }
  if (msg.id === 2) {
    console.log('MAI STATE:', JSON.stringify(msg.result.value, null, 2));
    ws.send(JSON.stringify({
      id: 3,
      method: 'Runtime.evaluate',
      params: { expression: 'window.game._loadHeroine("miyazawa");' }
    }));
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 4,
        method: 'Runtime.evaluate',
        params: {
          expression: `({
            heroineKey: window.game.currentHeroineKey,
            heroineGroupChildren: window.game.heroineGroup.children.map(c => ({ name: c.name, type: c.type, visible: c.visible })),
            handBone: window.game.heroineHandBone ? window.game.heroineHandBone.name : null,
            socketParent: window.game.heroineWeaponSocket.parent ? window.game.heroineWeaponSocket.parent.name : null,
            socketPos: window.game.heroineWeaponSocket.position,
            socketWorldPos: (() => {
              const v = new window.game.heroineWeaponSocket.position.constructor();
              window.game.heroineWeaponSocket.getWorldPosition(v);
              return v;
            })(),
            socketChildren: window.game.heroineWeaponSocket.children.length
          })`,
          returnByValue: true
        }
      }));
    }, 3000);
  }
  if (msg.id === 4) {
    console.log('MIYAZAWA STATE:', JSON.stringify(msg.result.value, null, 2));
    proc.kill();
    process.exit(0);
  }
};
