import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';

  let filePath;
  if (cleanUrl === '/d3' || cleanUrl === '/d3/') {
    filePath = path.join(__dirname, '../d3/index.html');
  } else if (cleanUrl.startsWith('/d3/')) {
    filePath = path.join(__dirname, '..', cleanUrl);
  } else {
    filePath = path.join(__dirname, cleanUrl);
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${cleanUrl}`);
    return;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const idx = path.join(filePath, 'index.html');
    if (fs.existsSync(idx)) {
      filePath = idx;
    } else {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    file.on('error', () => {});
    res.on('error', () => {});
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    });
    const file = fs.createReadStream(filePath);
    file.on('error', () => {});
    res.on('error', () => {});
    file.pipe(res);
  }
});

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') return;
  console.log('[SERVER WARN]', err.message);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[WAIFU ARENA] Port ${PORT} already active.`);
  } else {
    console.error('[SERVER ERROR]', err);
  }
});

server.listen(PORT, () => {
  console.log(`[WAIFU ARENA] Serving Haven PvP at http://localhost:${PORT}`);
  console.log(`[WAIFU ARENA] Serving Tactical Firing Range at http://localhost:${PORT}/d3/`);
});
