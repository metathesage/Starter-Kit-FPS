// Electron shell for the LOCKOUT web game. Serves ./app over a private localhost port so fetch(),
// ES modules, WASM and audio behave exactly like they do on GitHub Pages.
const { app, BrowserWindow, globalShortcut, session } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'app');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain',
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.normalize(path.join(ROOT, p));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'GamepadButtonAxisEvents');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

app.whenReady().then(async () => {
  const port = await serve();
  const win = new BrowserWindow({
    width: 1600, height: 900, backgroundColor: '#05070c', autoHideMenuBar: true, title: 'LOCKOUT',
    webPreferences: { contextIsolation: true, backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));  // mic (voice chat), pointer lock, etc.
  win.loadURL(`http://127.0.0.1:${port}/index.html`);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => win.webContents.toggleDevTools());
});

app.on('window-all-closed', () => app.quit());
