const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const ROOT = __dirname;
const THREE_ROOT = path.resolve(ROOT, 'vendor/three');
const PORT = Number(process.env.PORT)||8093;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav'
};
const lobbies = new Map();
const maxPlayers = 4;
function cleanLobby(lobby) {
  const now=Date.now();
  for(const [id,player] of lobby.players)if(now-player.seen>20000)lobby.players.delete(id);
  lobby.updated=now;
}
function publicPlayers(lobby, except) {
  cleanLobby(lobby);
  return [...lobby.players.values()].filter(p=>p.id!==except).map(({id,name,x,z,yaw,round})=>({id,name,x,z,yaw,round}));
}
function lanAddress() {
  const all=Object.values(os.networkInterfaces()).flat().filter(n=>n&&!n.internal&&n.family==='IPv4');
  return all.find(n=>/^192\.168\./.test(n.address)||/^10\./.test(n.address)||/^172\.(1[6-9]|2\d|3[01])\./.test(n.address))?.address||all[0]?.address||'127.0.0.1';
}
function readJSON(req) {
  return new Promise((resolve,reject)=>{
    let body='';req.on('data',chunk=>{body+=chunk;if(body.length>8192)reject(new Error('Request too large'));});
    req.on('end',()=>{try{resolve(JSON.parse(body||'{}'));}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);
  });
}
function sendJSON(res,status,payload) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(payload)); }
async function handleAPI(req,res,url) {
  if(url.pathname==='/api/lan-address'&&req.method==='GET')return sendJSON(res,200,{address:lanAddress(),port:PORT});
  if(url.pathname!=='/api/lobby')return false;
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return true;}
  if(req.method==='GET'){
    const lobby=lobbies.get(url.searchParams.get('id'));
    if(!lobby)return sendJSON(res,404,{error:'Lobby not found'});
    return sendJSON(res,200,{players:publicPlayers(lobby,url.searchParams.get('player'))});
  }
  if(req.method!=='POST')return sendJSON(res,405,{error:'Method not allowed'});
  try{
    const data=await readJSON(req),action=String(data.action||''),playerId=String(data.playerId||'').slice(0,64),name=String(data.name||'Operative').slice(0,24);
    if(!playerId)return sendJSON(res,400,{error:'Player id required'});
    let id=String(data.lobby||'').toUpperCase(),lobby=lobbies.get(id);
    if(action==='create'){
      id=crypto.randomBytes(3).toString('hex').toUpperCase();lobby={players:new Map(),updated:Date.now()};lobbies.set(id,lobby);
    } else if(!lobby)return sendJSON(res,404,{error:'Lobby not found or expired'});
    cleanLobby(lobby);
    if(action==='join'&&!lobby.players.has(playerId)&&lobby.players.size>=maxPlayers)return sendJSON(res,409,{error:'Lobby is full (4 players max)'});
    if(action==='leave'){lobby.players.delete(playerId);if(!lobby.players.size)lobbies.delete(id);return sendJSON(res,200,{ok:true});}
    if(!['create','join','sync'].includes(action))return sendJSON(res,400,{error:'Unknown lobby action'});
    const number=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(-10000,Math.min(10000,Number(value))):fallback;
    const current=lobby.players.get(playerId)||{id:playerId,name};
    current.name=name;current.x=number(data.x,current.x||0);current.z=number(data.z,current.z||0);current.yaw=number(data.yaw,current.yaw||0);current.round=Math.max(0,Math.min(999,Math.floor(number(data.round,current.round||0))));current.seen=Date.now();
    lobby.players.set(playerId,current);lobby.updated=Date.now();
    return sendJSON(res,200,{lobby:id,players:publicPlayers(lobby,playerId),count:lobby.players.size,maxPlayers});
  }catch(error){return sendJSON(res,400,{error:error.message||'Bad request'});}
}

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  if (decoded.startsWith('/vendor/three/')) return path.resolve(THREE_ROOT, decoded.slice('/vendor/three/'.length));
  return path.resolve(ROOT, `.${decoded === '/' ? '/index.html' : decoded}`);
}

http.createServer(async (req, res) => {
  const url=new URL(req.url,'http://localhost');
  if(process.env.DEBUG_HTTP)console.log(`${req.method} ${url.pathname}`);
  if(url.pathname.startsWith('/api/')){await handleAPI(req,res,url);return;}
  let file;
  try { file = resolveFile(req.url); } catch { res.writeHead(400).end('Bad request'); return; }
  const allowedRoot=file.startsWith(THREE_ROOT+path.sep)?THREE_ROOT:ROOT;
  if (file !== allowedRoot && !file.startsWith(allowedRoot + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Dead Girl Walking: http://localhost:${PORT} · LAN http://${lanAddress()}:${PORT}`));
setInterval(()=>{for(const [id,lobby] of lobbies){cleanLobby(lobby);if(!lobby.players.size&&Date.now()-lobby.updated>60000)lobbies.delete(id);}},15000).unref();
