import http from 'node:http';

async function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9223/json', res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

try {
  const targets = await getTargets();
  const page = targets.find(t => t.url && t.url.includes('localhost:8080'));
  if (!page) {
    console.log('No page found');
    process.exit(0);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onopen = () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `({
          readyState: document.readyState,
          hasGame: !!window.game,
          gameInitialized: window.game ? !!window.game.character : false,
          hasCanvas: !!document.querySelector('canvas'),
          canvasWidth: document.querySelector('canvas')?.width,
          canvasHeight: document.querySelector('canvas')?.height,
          lastError: window._lastError
        })`,
        returnByValue: true
      }
    }));
  };
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === 1) {
      console.log('STATUS:', JSON.stringify(msg.result, null, 2));
      process.exit(0);
    }
  };
} catch (e) {
  console.error(e);
}
