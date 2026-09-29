import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
const $ = (id) => document.getElementById(id);
addEventListener('error',event=>{console.error('Game runtime error:',event.error||event.message);const s=$('load-status');if(s){s.textContent=`GAME ERROR · ${event.message||'CHECK CONSOLE'}`;$('loading').classList.add('active');}});
addEventListener('unhandledrejection',event=>{console.error('Game promise rejected:',event.reason);});
// ============ RENDERER / SCENE ============
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080c);
scene.fog = new THREE.FogExp2(0x0a0e12, 0.012);
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.08, 400);
camera.position.set(0, 1.68, 20);
const renderer = new THREE.WebGLRenderer({ canvas: $('game-canvas'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
let qualityScale=1, qualityTimer=0, emaDt=1/60;
scene.add(new THREE.HemisphereLight(0x9db4dd, 0x201d16, 1.15));
scene.add(new THREE.AmbientLight(0x6a7484, 0.5));
const moon = new THREE.DirectionalLight(0xa9c2f0, 1.3);
moon.position.set(-30, 50, 25); scene.add(moon);
// ============ HELPERS ============
const R = Math.random;
const random = (a,b)=>a+R()*(b-a);
const obstacles=[];
function setLoad(n,t){ const f=$('load-fill'),s=$('load-status'); if(f)f.style.width=`${Math.round(n*100)}%`; if(s)s.textContent=t; }
// ============ ASSET LOADING (sequential, avoids parse spikes) ============
const loader = new GLTFLoader();
const loaded = {};
const assets = [
  ['kasumi','/assets/characters/kasumi.glb'],
  ['skeletonWarrior','/assets/enemies/skeleton_Warrior.glb'],['skeletonRogue','/assets/enemies/skeleton_Rogue.glb'],
  ['skeletonMinion','/assets/enemies/skeleton_Minion.glb'],['skeletonMage','/assets/enemies/skeleton_Mage.glb'],
  ['rigGeneral','/assets/enemies/rig_general.glb'],['rigMovement','/assets/enemies/rig_movement.glb'],
  ['fox','/assets/enemies/fox.glb'],['trex','/assets/enemies/trex.glb'],['dragon','/assets/enemies/dragon.glb'],
  ['hawkmoon','/assets/weapons/hawkmoon.glb'],['shotgun','/assets/weapons/sakura_shotgun.glb'],['smg','/assets/weapons/hanami_smg.glb'],
  ['acr','/assets/weapons/acr.glb'],['izanagis','/assets/weapons/izanagis.glb'],['vex','/assets/weapons/vex.glb'],
  ['chestProp','/assets/props/chest.glb'],['perkJug','/assets/props/perk_jug.glb'],['perkCola','/assets/props/perk_cola.glb'],
  ['perkTap','/assets/props/perk_tap.glb'],['perkStam','/assets/props/perk_stam.glb'],
  ['grave_fence','/assets/graveyard/fence.gltf'],['grave_arch','/assets/graveyard/arch_gate.gltf'],
  ['grave_crypt','/assets/graveyard/crypt.gltf'],['grave_coffin','/assets/graveyard/coffin_decorated.gltf'],
  ['grave_stone','/assets/graveyard/gravestone.gltf'],['grave_a','/assets/graveyard/grave_A.gltf'],['grave_b','/assets/graveyard/grave_B.gltf'],
  ['grave_lantern','/assets/graveyard/post_lantern.gltf'],['grave_pumpkin','/assets/graveyard/pumpkin_orange_jackolantern.gltf'],
  ['grave_tree','/assets/graveyard/tree_dead_large.gltf'],
];
function loadGLTF(url){ return new Promise((res,rej)=>loader.load(url,g=>res(g),undefined,rej)); }
for(let i=0;i<assets.length;i++){
  const [key,url]=assets[i]; setLoad(i/assets.length,`LOADING ${key.toUpperCase()} · ${i+1}/${assets.length}`);
  try{ loaded[key]=await loadGLTF(url); }catch(e){ console.warn('missing asset',url,e); }
  setLoad((i+1)/assets.length,`LOADING ${key.toUpperCase()} · ${i+1}/${assets.length}`);
}
function normalized(root, height){
  root.updateMatrixWorld(true);
  const box3=new THREE.Box3().setFromObject(root), size=box3.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(height/Math.max(size.y,.001)); root.updateMatrixWorld(true);
  const sb=new THREE.Box3().setFromObject(root), c=sb.getCenter(new THREE.Vector3());
  const anchor=new THREE.Group(); anchor.add(root);
  root.position.x-=c.x; root.position.y-=sb.min.y; root.position.z-=c.z;
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; if(o.material) o.material.side=THREE.FrontSide; } });
  return anchor;
}
// ============ MAP: OUTPOST 7 (hand-built, every solid registers its collider) ============
const GX=52, GZ=52;
function concreteTex(){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d'); g.fillStyle='#2a2d33'; g.fillRect(0,0,64,64);
  for(let i=0;i<900;i++){ g.fillStyle=['#2e3138','#26292f','#33373e'][(R()*3)|0]; g.fillRect((R()*64)|0,(R()*64)|0,1,1); }
  g.fillStyle='#3a3e46'; g.fillRect(0,0,64,2); g.fillRect(0,0,2,64);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(22,22); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const mapMats={
  ground:new THREE.MeshStandardMaterial({ map:concreteTex(), roughness:.95 }),
  wall:new THREE.MeshStandardMaterial({ color:0x3d434c, roughness:.9 }),
  darkWall:new THREE.MeshStandardMaterial({ color:0x23272e, roughness:.9 }),
  trim:new THREE.MeshBasicMaterial({ color:0xc6ff62 }),
  amber:new THREE.MeshBasicMaterial({ color:0xffb457 }),
  hot:new THREE.MeshStandardMaterial({ color:0x572a12, emissive:0xff6a1a, emissiveIntensity:1.2 }),
  candle:new THREE.MeshBasicMaterial({ color:0xffd88a }),
};
function solid(w,h,d,mat,x,y,z,ry=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z); m.rotation.y=ry; scene.add(m);
  m.updateMatrixWorld(true); obstacles.push(new THREE.Box3().setFromObject(m)); return m;
}
function decal(w,d,x,z,color=0x30343b){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshStandardMaterial({ color, roughness:1 }));
  m.rotation.x=-Math.PI/2; m.position.set(x,.015,z); scene.add(m); return m;
}
{
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140), mapMats.ground);
  ground.rotation.x=-Math.PI/2; ground.position.y=-.02; scene.add(ground);
  // perimeter
  solid(108,9,1.5,mapMats.wall, 0,4.5,-53); solid(108,9,1.5,mapMats.wall, 0,4.5,53);
  solid(1.5,9,108,mapMats.wall, -53,4.5,0); solid(1.5,9,108,mapMats.wall, 53,4.5,0);
  // south dividing wall (spawn plaza <-> middle), main gate gap x -6..6
  solid(42,6,1.2,mapMats.wall, -27,3,20); solid(42,6,1.2,mapMats.wall, 27,3,20);
  // chapel / foundry side walls with gaps at x=±14
  solid(1.2,6,34,mapMats.darkWall, -14,3,3); solid(1.2,6,34,mapMats.darkWall, 14,3,3);
  // north wall with gaps at x=±10
  solid(30,6,1.2,mapMats.wall, -37,3,-20); solid(30,6,1.2,mapMats.wall, 37,3,-20); solid(8,6,1.2,mapMats.wall, 0,3,-20);
  // gate lintels + trim
  for(const [x,z,w] of [[0,20,14],[-14,3,8],[14,3,8],[-10,-20,8],[10,-20,8],[0,-20,8]]){
    const l=new THREE.Mesh(new THREE.BoxGeometry(w,.5,1.4), mapMats.darkWall);
    l.position.set(x,6.2,z); scene.add(l);
  }
  // plaza decals
  decal(30,24, 0,36); decal(20,60, -33,0); decal(20,60, 33,0); decal(60,24, 0,-36);
  // CHAPEL (west): altar, candles, cross
  solid(6,1.2,2.4,mapMats.darkWall, -40,.6,-8);
  for(let i=0;i<6;i++){ const cd=new THREE.Mesh(new THREE.BoxGeometry(.18,.5,.18),mapMats.candle); cd.position.set(-42+i*.8,1.45,-8); scene.add(cd); }
  solid(.6,5,.6,mapMats.darkWall, -40,2.5,-8); solid(2.6,.6,.6,mapMats.darkWall, -40,3.6,-8);
  // FOUNDRY (east): furnace + chimney + barrels
  solid(7,4,4,mapMats.darkWall, 40,2,-8);
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(3,1.6,.3), mapMats.hot); mouth.position.set(36.4,1,-8); mouth.rotation.y=Math.PI/2; scene.add(mouth);
  solid(2,9,2,mapMats.darkWall, 42,4.5,-14);
  const barrelM=new THREE.MeshStandardMaterial({ color:0x5a3a22, roughness:.7, metalness:.3 });
  for(const [x,z] of [[28,4],[29.5,5],[28.7,6.4],[30,-12],[31.4,-11]]){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,1.8,10), barrelM);
    b.position.set(x,.9,z); scene.add(b); b.updateMatrixWorld(true); obstacles.push(new THREE.Box3().setFromObject(b));
  }
  // BELLTOWER court (north): four pillars + roof + bell
  for(const [x,z] of [[-4,-38],[4,-38],[-4,-30],[4,-30]]) solid(1.4,9,1.4,mapMats.wall, x,4.5,z);
  solid(12,1,12,mapMats.darkWall, 0,9.5,-34);
  const bell=new THREE.Mesh(new THREE.SphereGeometry(1,12,10), new THREE.MeshStandardMaterial({ color:0x8a7a3a, metalness:.7, roughness:.35 }));
  bell.position.set(0,7.6,-34); scene.add(bell);
  // crates
  const crateM=new THREE.MeshStandardMaterial({ color:0x4d5a3a, roughness:.9 });
  for(const [x,z,s,ry] of [[-10,34,2.2,.4],[12,40,2.6,1.1],[-26,12,2.4,.2],[26,12,2.4,1.4],[-8,-30,2.2,.8],[10,-32,2.6,.1],[-44,30,2.4,.5],[44,30,2.4,1.2]]){
    const m=new THREE.Mesh(new THREE.BoxGeometry(s,s,s),crateM);
    m.position.set(x,s/2,z); m.rotation.y=ry; scene.add(m); m.updateMatrixWorld(true); obstacles.push(new THREE.Box3().setFromObject(m));
  }
  // graveyard kit accents (visual, colliders where solid)
  const kit=(key,x,z,s,ry,collide,w=2,d=2)=>{
    const src=loaded[key]?.scene; if(!src) return;
    const m=src.clone(true); m.position.set(x,0,z); m.rotation.y=ry; m.scale.setScalar(s);
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
    scene.add(m);
    if(collide){ m.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(m); b.expandByScalar(.2); obstacles.push(b); }
  };
  kit('grave_crypt',-24,32,1.1,.4,true,7,6); kit('grave_crypt',24,32,1.1,-.4,true,7,6);
  kit('grave_coffin',-36,44,1,.7,true); kit('grave_coffin',36,44,1,-.7,true);
  kit('grave_tree',-46,-46,1.2,1,true); kit('grave_tree',46,-46,1.2,2.4,true); kit('grave_tree',-46,8,1,.5,true); kit('grave_tree',46,8,1,2,true);
  for(let i=0;i<14;i++) kit(['grave_stone','grave_a','grave_b'][i%3], -44+(i*6.8)%88, i%2?46:-46, random(.9,1.2), random(0,6), false);
  for(const [x,z] of [[-8,28],[8,28],[-20,-28],[20,-28]]) kit('grave_pumpkin',x,z,1.2,random(0,6),false);
  // lantern posts: 2 real lights, rest emissive
  const postM=new THREE.MeshStandardMaterial({ color:0x2c3138, roughness:.6, metalness:.4 });
  const lampM=new THREE.MeshBasicMaterial({ color:0xffc46f });
  const lanterns=[[-6,26,.9],[6,26,.9],[-18,-14,1],[18,-14,1],[-30,-34,0],[30,-34,0]];
  for(const [x,z,kind] of lanterns){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,4.4,8),postM); p.position.set(x,2.2,z); scene.add(p);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),lampM); lamp.position.set(x,4.5,z); scene.add(lamp);
    if(kind){ const l=new THREE.PointLight(0xffb457,7,24,1.8); l.position.set(x,4.6,z); scene.add(l); }
  }
}
const PLAYER_SPAWN=new THREE.Vector3(0,0,42);
const GATES=[new THREE.Vector3(-44,0,44),new THREE.Vector3(44,0,44),new THREE.Vector3(-44,0,-44),new THREE.Vector3(44,0,-44),new THREE.Vector3(0,0,-48),new THREE.Vector3(-20,0,48),new THREE.Vector3(20,0,48),new THREE.Vector3(-48,0,0)];
function openSpot(clear=1.4, tries=60){
  for(let i=0;i<tries;i++){
    const x=random(-GX+3,GX-3), z=random(-GZ+3,GZ-3);
    if(!obstacles.some(b=>x>b.min.x-clear&&x<b.max.x+clear&&z>b.min.z-clear&&z<b.max.z+clear)) return new THREE.Vector3(x,0,z);
  }
  return PLAYER_SPAWN.clone();
}
function farSpot(from, minD=20){
  for(let i=0;i<80;i++){ const p=openSpot(); if(p.distanceTo(from)>minD) return p; }
  return openSpot();
}
const MOUNT={
  hawkmoon:{ f:[0,-1,0], u:[1,0,0] }, shotgun:{ f:[1,0,0], u:[0,1,0] }, smg:{ f:[1,0,0], u:[0,1,0] },
  acr:{ f:[0,-1,0], u:[1,0,0] }, izanagis:{ f:[0,0,1], u:[0,1,0] }, vex:{ f:[1,0,0], u:[0,1,0] },
};
const _mf=new THREE.Vector3(), _mu=new THREE.Vector3(), _mr=new THREE.Vector3(), _mm=new THREE.Matrix4();
function aimMount(obj, key){
  const cfg=MOUNT[key]||MOUNT.shotgun;
  _mf.set(...cfg.f).normalize(); _mu.set(...cfg.u).normalize();
  _mr.crossVectors(_mu,_mf).normalize();
  _mu.crossVectors(_mf,_mr).normalize();
  _mm.makeBasis(_mr,_mu,_mf.clone().negate());
  obj.quaternion.setFromRotationMatrix(_mm);
}
function mountCal(key){
  try{ return JSON.parse(localStorage.getItem('dgw-mount-'+key) || 'null'); }catch{ return null; }
}
function applyMount(obj, key){
  aimMount(obj, key);
  const c=mountCal(key);
  if(c){ obj.rotateY(c.y||0); obj.rotateX(c.x||0); }
}

// ============ SYSTEMS PLACEMENT ============
const doors=[], barriers=[], wallbuys=[], perkMachines=[];
const darkM=new THREE.MeshStandardMaterial({ color:0x14171c, roughness:.8 });
const woodM=new THREE.MeshStandardMaterial({ color:0x6b4a2e, roughness:.9 });
const debrisM=new THREE.MeshStandardMaterial({ color:0x4a4438, roughness:1 });
function floatLabel(text, color='#e8f0e4', y=3.4){
  const c=document.createElement('canvas'); c.width=256; c.height=80;
  const g=c.getContext('2d'); g.fillStyle='rgba(0,0,0,.72)'; g.fillRect(0,0,256,80);
  g.font='bold 30px monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillStyle=color;
  const words=text.split(' '); let lines=[''];
  for(const w of words){ const t=lines[lines.length-1]+(lines[lines.length-1]?' ':'')+w;
    if(t.length>16&&lines.length<2) lines.push(w); else lines[lines.length-1]=t; }
  lines.slice(0,2).forEach((l,i)=>g.fillText(l,128,28+i*30));
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.4), new THREE.MeshBasicMaterial({ map:t, transparent:true }));
  m.position.y=y; return m;
}
function propModel(key, height){
  const src=loaded[key]?.scene; if(!src) return null;
  const m=normalized(src.clone(true), height); scene.add(m); return m;
}
// Mystery chest on pedestal
const chestPos=openSpot(2.5);
const chest={ pos:chestPos.clone(), cost:950, rolling:false, lid:null };
{
  const ped=new THREE.Mesh(new THREE.BoxGeometry(3.4,1,2.6), darkM);
  ped.position.set(chestPos.x,.5,chestPos.z); scene.add(ped);
  const ch=propModel('chestProp',1.1);
  if(ch){ ch.position.set(chestPos.x,1,chestPos.z); chest.lid=ch;
    ch.traverse(o=>{ if(o.isMesh&&/lid|top|cover/i.test(o.name)) chest.lidMesh=o; }); }
  const lamp=new THREE.PointLight(0x9d7bff,6,18,1.8); lamp.position.set(chestPos.x,3.4,chestPos.z); scene.add(lamp);
  const label=floatLabel('MYSTERY BOX 950','#c9b3ff',4.6); label.position.x=chestPos.x; label.position.z=chestPos.z; scene.add(label);
}
// Perk machines with floating product models
const perkDefs=[
  ['jug','JUGGER-NOG',2500,'perkJug',0xd23c3c],['cola','SPEED COLA',2000,'perkCola',0x53c24a],
  ['tap','DOUBLE TAP',2000,'perkTap',0xe07b2a],['stam','STAMINA UP',1500,'perkStam',0xe8d23c],
];
for(const [key,name,cost,prop,color] of perkDefs){
  const p=farSpot(chestPos,12);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(2.4,3,1.6), darkM);
  cab.position.set(p.x,1.5,p.z); scene.add(cab);
  const strip=new THREE.Mesh(new THREE.BoxGeometry(2.5,.5,1.7), new THREE.MeshBasicMaterial({ color }));
  strip.position.set(p.x,3.2,p.z); scene.add(strip);
  const item=propModel(prop,.9);
  if(item){ item.position.set(p.x,4.3,p.z); item.userData.spin=true; perkMachines.push({ key,name,cost,pos:p.clone(),spinner:item }); }
  else perkMachines.push({ key,name,cost,pos:p.clone(),spinner:null });
  const label=floatLabel(`${name} ${cost}`,'#e8f0e4',5.6); label.position.x=p.x; label.position.z=p.z; scene.add(label);
}
// Pack-a-Punch
const papPos=farSpot(chestPos,18);
const pap={ pos:papPos.clone(), cost:2500 };
{
  const cab=new THREE.Mesh(new THREE.BoxGeometry(3,3.4,2), darkM);
  cab.position.set(papPos.x,1.7,papPos.z); scene.add(cab);
  const strip=new THREE.Mesh(new THREE.BoxGeometry(3.1,.5,2.1), new THREE.MeshBasicMaterial({ color:0x63e6ff }));
  strip.position.set(papPos.x,3.6,papPos.z); scene.add(strip);
  const label=floatLabel('PACK-A-PUNCH 2500','#9be6ff',4.9); label.position.x=papPos.x; label.position.z=papPos.z; scene.add(label);
  const lamp=new THREE.PointLight(0x63e6ff,5,16,1.8); lamp.position.set(papPos.x,3.2,papPos.z); scene.add(lamp);
}
// Wallbuys: chalk frame + floating real gun
function addWallbuy(weapon,cost){
  const p=openSpot(2);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.5,.12), new THREE.MeshBasicMaterial({ color:0xd8e2d5 }));
  frame.position.set(p.x,1.9,p.z); frame.lookAt(camera.position.x,1.9,camera.position.z); scene.add(frame);
  const gun=propModel(weapon,.55);
  if(gun){ gun.position.set(p.x,1.9,p.z); applyMount(gun, weapon); gun.userData.spin=true; wallbuys.push({ weapon,cost,pos:p.clone(),spinner:gun }); }
  else wallbuys.push({ weapon,cost,pos:p.clone(),spinner:null });
  const label=floatLabel(`${weapon.toUpperCase()} ${cost}`,'#ffc868',3.4); label.position.x=p.x; label.position.z=p.z; scene.add(label);
}
addWallbuy('acr',1500); addWallbuy('izanagis',1800);
// Supply vaults (locked debris compounds with a bonus cache)
function addVault(name,cost){
  const c=openSpot(4);
  const g=new THREE.Group(); g.position.set(c.x,0,c.z); scene.add(g);
  const blockers=[];
  for(let i=0;i<10;i++){
    const a=i/10*Math.PI*2, r=4.2;
    const d=new THREE.Mesh(new THREE.BoxGeometry(2.4,random(1,2.2),1), debrisM);
    d.position.set(Math.cos(a)*r, .8, Math.sin(a)*r); d.rotation.y=-a; g.add(d);
    if(i%2===0) blockers.push(new THREE.Box3(new THREE.Vector3(c.x+Math.cos(a)*r-1.2,0,c.z+Math.sin(a)*r-1.2),new THREE.Vector3(c.x+Math.cos(a)*r+1.2,3,c.z+Math.sin(a)*r+1.2)));
  }
  for(const b of blockers){ b.isDoor=true; obstacles.push(b); }
  const cache=new THREE.Mesh(new THREE.BoxGeometry(1.2,.9,.9), new THREE.MeshStandardMaterial({ color:0x405d42, emissive:0x163c20, emissiveIntensity:.6 }));
  cache.position.set(c.x,.55,c.z); scene.add(cache);
  const label=floatLabel(`${name} VAULT ${cost}`,'#ffc868',4.2); label.position.set(c.x,0,c.z); scene.add(label); g.add(label); label.position.set(0,4.2,0);
  doors.push({ name, cost, opened:false, group:g, blockers, cachePos:new THREE.Vector3(c.x,0,c.z) });
}
addVault('IRON',750); addVault('GOLD',1250);
// Rebuildable street barriers
function addBarrier(px,pz,ry=0){
  const p=(px!==undefined)?new THREE.Vector3(px,0,pz):openSpot(2);
  const g=new THREE.Group(); g.position.set(p.x,0,p.z); g.rotation.y=ry; scene.add(g);
  const fL=new THREE.Mesh(new THREE.BoxGeometry(.4,2.6,.4),woodM); fL.position.set(-1.4,1.3,0); g.add(fL);
  const fR=fL.clone(); fR.position.x=1.4; g.add(fR);
  const boards=[];
  for(let i=0;i<4;i++){ const pl=new THREE.Mesh(new THREE.BoxGeometry(2.8,.3,.12),woodM); pl.position.set(0,.6+i*.55,0); pl.visible=i<2; g.add(pl); boards.push(pl); }
  barriers.push({ pos:p.clone(), boards, health:2, maxHealth:4 });
}
[[-20,50.5,0],[20,50.5,0],[-20,-50.5,0],[20,-50.5,0],[-50.5,-12,Math.PI/2],[-50.5,12,Math.PI/2],[50.5,-12,-Math.PI/2],[50.5,12,-Math.PI/2]].forEach(([x,z,ry])=>addBarrier(x,z,ry));
// ============ PLAYER STATE ============
const weaponSpecs = {
  hawkmoon:{ label:'HAWKMOON', mag:8, reserve:80, damage:48, delay:.26, reload:1.0, spread:.01, pellets:1, auto:false },
  shotgun:{ label:'TRENCH GUN', mag:6, reserve:48, damage:24, delay:.85, reload:1.6, spread:.06, pellets:7, auto:false },
  smg:{ label:'GREASE GUN', mag:32, reserve:192, damage:22, delay:.1, reload:1.7, spread:.028, pellets:1, auto:true },
  acr:{ label:'ACR RIFLE', mag:30, reserve:180, damage:32, delay:.11, reload:1.6, spread:.02, pellets:1, auto:true },
  izanagis:{ label:'IZANAGI', mag:5, reserve:30, damage:170, delay:.9, reload:1.8, spread:.004, pellets:1, auto:false },
  vex:{ label:'VEX MYTHOCLAST', mag:25, reserve:150, damage:72, delay:.16, reload:1.5, spread:.012, pellets:1, auto:true, wonder:true },
};
const boxPool=['shotgun','smg','acr','izanagis','acr','smg','vex'];
const mountH={ hawkmoon:.24, shotgun:.35, smg:.28, acr:.3, izanagis:.38, vex:.3 };
const player = { health:100, maxHealth:100, points:500, kills:0, round:0, speed:6.2,
  weapon:'hawkmoon', owned:['hawkmoon'], ammo:{hawkmoon:8}, reserve:{hawkmoon:80},
  perks:{}, packed:{}, damageMult:1, reloadMult:1, speedMult:1,
  instaTimer:0, doubleTimer:0, meleeAt:0, fireAt:0, reloading:false,
  ADS:0, camMode:'fps', lastHit:99, breather:0 };
const mixers=[];
const weaponModels={};
for(const key of Object.keys(weaponSpecs)){
  const src=loaded[key]?.scene; if(!src) continue;
  const model=normalized(src.clone(true), mountH[key]||.3);
  model.scale.multiplyScalar(.8); model.position.set(.22,-.28,-.52); applyMount(model, key);
  camera.add(model); weaponModels[key]=model;
  model.visible=(key===player.weapon);
}
scene.add(camera);
const flashlight=new THREE.SpotLight(0xd8e4ff,30,34,Math.PI/7,.6,1.5);
flashlight.position.set(0,0,0); flashlight.target.position.set(0,0,-1);
camera.add(flashlight,flashlight.target);
function equip(name){
  for(const [k,m] of Object.entries(weaponModels)) m.visible=(k===name);
  player.weapon=name; mountAvatarGun();
}
// Operative avatar (visible in over-shoulder mode)
let avatar=null, avatarMixer=null, avatarGun=null;
if(loaded.kasumi?.scene){
  avatar=normalized(cloneSkinned(loaded.kasumi.scene),1.75);
  avatar.position.set(0,0,20); scene.add(avatar);
  avatar.traverse(o=>{ if(/knife|blade/i.test(o.name)) o.visible=false; });
  if(loaded.kasumi.animations?.length){ avatarMixer=new THREE.AnimationMixer(avatar); avatarMixer.clipAction(loaded.kasumi.animations[0]).play(); mixers.push(avatarMixer); }
  avatarGun=new THREE.Group(); avatarGun.position.set(.32,1.32,.25); avatar.add(avatarGun);
  avatar.visible=false;
}
function mountAvatarGun(){
  if(!avatarGun) return;
  while(avatarGun.children.length) avatarGun.remove(avatarGun.children[0]);
  const src=loaded[player.weapon]?.scene; if(!src) return;
  const m=normalized(src.clone(true),.5);
  applyMount(m, player.weapon); m.rotateY(Math.PI); avatarGun.add(m);
}
mountAvatarGun();
// ============ ZOMBIE HORDE (rigged skeletons) ============
const enemies=[], hitProxies=[], tracers=[];
const proxyGeo=new THREE.CapsuleGeometry(.5,1.15,3,6);
const proxyMat=new THREE.MeshBasicMaterial({ visible:false });
const tracerMat=new THREE.LineBasicMaterial({ color:0xffe9a8, transparent:true, opacity:.9 });
// ============ HORDE (real GLBs: skeletons, hound, rex, dragon) ============
const enemyTemplates={
  warrior: loaded.skeletonWarrior?.scene?normalized(cloneSkinned(loaded.skeletonWarrior.scene),2.05):null,
  rogue: loaded.skeletonRogue?.scene?normalized(cloneSkinned(loaded.skeletonRogue.scene),1.95):null,
  minion: loaded.skeletonMinion?.scene?normalized(cloneSkinned(loaded.skeletonMinion.scene),1.5):null,
  mage: loaded.skeletonMage?.scene?normalized(cloneSkinned(loaded.skeletonMage.scene),2.1):null,
  fox: loaded.fox?.scene?normalized(cloneSkinned(loaded.fox.scene),1.15):null,
  trex: loaded.trex?.scene?normalized(cloneSkinned(loaded.trex.scene),3.4):null,
  dragon: loaded.dragon?.scene?normalized(cloneSkinned(loaded.dragon.scene),2.8):null,
};
const rigClips=[...(loaded.rigGeneral?.animations||[]),...(loaded.rigMovement?.animations||[])];
const findClip=(list,...names)=>list.find(c=>names.includes(c.name));
const CLIPS={
  warrior:{ walk:['Running_A','Running_B'], hit:['Hit_A','Hit_B'], death:['Death_A','Death_B'], attack:['Throw','Use_Item'], rig:true },
  rogue:{ walk:['Running_B','Walking_B'], hit:['Hit_B','Hit_A'], death:['Death_B','Death_A'], attack:['Throw','Use_Item'], rig:true },
  minion:{ walk:['Running_A','Running_B'], hit:['Hit_A','Hit_B'], death:['Death_A','Death_B'], attack:['Throw','Use_Item'], rig:true },
  mage:{ walk:['Walking_B','Walking_A'], hit:['Hit_B','Hit_A'], death:['Death_B','Death_A'], attack:['Throw','Use_Item'], rig:true },
  fox:{ walk:['Run','Walk'], hit:[], death:['Death'], attack:['Bite'] },
  trex:{ walk:['Walk'], hit:['Hit'], death:['Death'], attack:['Attack'], roar:['Roar'] },
  dragon:{ walk:['Fly_Flap','Walk'], hit:[], death:[], attack:[] },
};
const HEIGHTS={ warrior:2.05, rogue:1.95, minion:1.5, mage:2.1, fox:1.15, trex:3.4, dragon:2.8 };
const zRoster=[
  { type:'warrior', hp:150, speed:2.3, damage:15, cooldown:1.0, pts:100 },
  { type:'rogue', hp:110, speed:3.0, damage:15, cooldown:.85, pts:100 },
  { type:'minion', hp:70, speed:3.9, damage:12, cooldown:.75, pts:100 },
  { type:'mage', hp:100, speed:1.9, damage:16, cooldown:1.0, pts:120 },
  { type:'fox', hp:90, speed:4.6, damage:10, cooldown:.7, pts:100 },
  { type:'dragon', hp:220, speed:3.4, damage:18, cooldown:.9, pts:150 },
  { type:'trex', hp:900, speed:2.0, damage:32, cooldown:1.2, pts:300 },
];
const MAX_ALIVE=10;
function pickType(){
  const r=R(), round=player.round;
  if(round>=7&&r<.1) return 'trex';
  if(round>=6&&r<.26) return 'dragon';
  if(round>=3&&r<.5) return 'fox';
  const pool=round<2?['warrior','minion']:round<4?['warrior','rogue','minion']:['warrior','rogue','minion','mage'];
  return pool[(R()*pool.length)|0];
}
function addZombie(boss=false){
  const type=boss?'trex':pickType();
  const prof=boss?{ type:'trex', hp:1400+player.round*40, speed:2.1, damage:34, cooldown:1.0, pts:800 }
    :zRoster.find(z=>z.type===type);
  // spawn at a window: tear straight through the boards
  const w=barriers[(R()*barriers.length)|0];
  let px=w?w.pos.x+random(-2,2):random(-40,40), pz=w?w.pos.z+random(-2,2):random(-40,40);
  if(w&&w.health>0){ w.health=Math.max(0,w.health-1); if(w.boards[w.health]) w.boards[w.health].visible=false; }
  if(Math.abs(px)>=GX-1||Math.abs(pz)>=GZ-1||obstacles.some(b=>px>b.min.x-1&&px<b.max.x+1&&pz>b.min.z-1&&pz<b.max.z+1)){
    const f=openSpot(1.4); px=f.x; pz=f.z;
  }
  let root=null;
  if(enemyTemplates[type]) root=cloneSkinned(enemyTemplates[type]);
  if(!root){ root=new THREE.Group();
    const b=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.95,4,8),new THREE.MeshStandardMaterial({ color:0x65775a }));
    b.position.y=.9; root.add(b); }
  const sc=(boss?1.7:1)*random(.95,1.06); root.scale.multiplyScalar(sc);
  root.position.set(px,0,pz);
  root.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
  scene.add(root);
  const mixer=new THREE.AnimationMixer(root), actions={};
  const cfg=CLIPS[type]||CLIPS.warrior;
  const modelClips=(type==='warrior'||type==='rogue'||type==='minion'||type==='mage')
    ?[...(loaded[{warrior:'skeletonWarrior',rogue:'skeletonRogue',minion:'skeletonMinion',mage:'skeletonMage'}[type]]?.animations||[])]
    :[...(loaded[type]?.animations||[])];
  const pool=cfg.rig?[...modelClips,...rigClips]:modelClips;
  for(const [k,names] of Object.entries({ walk:cfg.walk, hit:cfg.hit, death:cfg.death, attack:cfg.attack })){
    const c=findClip(pool,...names); if(c) actions[k]=mixer.clipAction(c);
  }
  if(cfg.roar){ const c=findClip(modelClips,...cfg.roar); if(c){ actions.roar=mixer.clipAction(c); if(boss){ actions.roar.reset().play(); } } }
  mixers.push(mixer);
  const e={ root, mixer, actions, anim:'', profile:prof, type,
    hp:prof.hp*(boss?1:1+(player.round-1)*.13), speed:prof.speed+Math.min(player.round*.05,.6),
    attack:random(.2,1), boss, dying:false, dyingTime:0, phase:R()*6 };
  const proxy=new THREE.Mesh(proxyGeo,proxyMat);
  proxy.position.y=type==='trex'?2:1.1; proxy.scale.setScalar(type==='trex'?1.7:type==='dragon'?1.2:1);
  proxy.userData.enemy=e; root.add(proxy); e.proxy=proxy; hitProxies.push(proxy);
  enemies.push(e); setAnim(e,'walk');
}

function removeZombie(e){ const i=hitProxies.indexOf(e.proxy); if(i>=0)hitProxies.splice(i,1);
  scene.remove(e.root); if(e.mixer){ e.mixer.stopAllAction(); const m=mixers.indexOf(e.mixer); if(m>=0)mixers.splice(m,1); } }
// ============ AUDIO ============
const sound={};
for(const [n,f] of Object.entries({ fire:'deagle_fire', reload:'deagle_reload', dry:'deagle_dry', hit:'hitmarker', boom:'hawkmoon_paracausal_boom', clear:'01_chest_open_1' })){
  sound[n]=new Audio(`/assets/audio/${f}.ogg`); sound[n].volume=n==='fire'?.3:.5;
}
function play(n){ const a=sound[n]; if(!a) return; try{ a.currentTime=0; a.play().catch(()=>{}); }catch{} }
// ============ HUD (SVG icons) ============
const ICO=p=>`<img class="ico" src="/assets/icons/${p}.svg" alt="">`;
const PERK_ICON={ jug:'icon-shield', cola:'icon-speed', tap:'icon-ammo', stam:'icon-medkit' };
const PERK_NAME={ jug:'JUGGER-NOG', cola:'SPEED COLA', tap:'DOUBLE TAP', stam:'STAMINA UP' };
const raycaster=new THREE.Raycaster();
let mode='menu', yaw=0, pitch=0, velocityY=0, canJump=true;
let roundRemaining=0, spawnTimer=0, damageCd=0, toastT=0, centerT=0;
let shake=0, kick=0, zoneCur='THE PLAZA', zoneCd=8;
const keys=new Set();
function award(n){ player.points+=n*(player.doubleTimer>0?2:1); }
function hud(){
  $('round-number').textContent=String(player.round).padStart(2,'0');
  $('threat-count').textContent=String(enemies.filter(e=>!e.dying).length+roundRemaining);
  $('kill-count').textContent=player.kills;
  $('best-score').textContent=Math.max(Number(localStorage.getItem('dgw-best')||0),player.points);
  $('health-number').textContent=Math.ceil(player.health); $('health-max').textContent=player.maxHealth;
  $('health-fill').style.width=`${100*Math.min(1,player.health/player.maxHealth)}%`;
  const s=weaponSpecs[player.weapon];
  $('weapon-name').textContent=(player.packed[player.weapon]?'PACKED ':'')+s.label;
  $('ammo-current').textContent=player.ammo[player.weapon]??0;
  $('ammo-reserve').textContent=player.reserve[player.weapon]??0;
  $('points').textContent=player.points.toLocaleString();
  const pk=$('perks'); if(pk) pk.innerHTML=Object.keys(player.perks).map(k=>`${ICO(PERK_ICON[k])}${PERK_NAME[k]}`).join(' &nbsp; ');
  const tm=$('timers'); if(tm){ const t=[]; if(player.instaTimer>0)t.push(`INSTA ${Math.ceil(player.instaTimer)}S`); if(player.doubleTimer>0)t.push(`2X ${Math.ceil(player.doubleTimer)}S`); tm.textContent=t.join(' · '); }
  const cm=$('cammode'); if(cm) cm.textContent=player.camMode==='ots'?'OVER-SHOULDER [V]':'FIRST PERSON [V]';
}
function showToast(t){ $('toast').textContent=t; $('toast').classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>$('toast').classList.remove('show'),1600); }
function centerToast(t,sub=''){ $('center-toast').innerHTML=`${t}${sub?`<span>${sub}</span>`:''}`; $('center-toast').classList.add('show'); clearTimeout(centerT); centerT=setTimeout(()=>$('center-toast').classList.remove('show'),2200); }
function reload(){
  if(mode!=='playing'||player.reloading) return;
  const w=player.weapon,s=weaponSpecs[w];
  if((player.ammo[w]??0)>=s.mag||(player.reserve[w]??0)<=0){ play('dry'); return; }
  player.reloading=true; play('reload');
  setTimeout(()=>{ if(mode==='gameover')return; const n=Math.min(s.mag-(player.ammo[w]??0),player.reserve[w]??0);
    player.ammo[w]=(player.ammo[w]??0)+n; player.reserve[w]-=n; player.reloading=false; hud(); }, s.reload*1000*player.reloadMult);
}
function aimDir(){ const d=new THREE.Vector3(); camera.getWorldDirection(d); return d; }
function muzzlePos(){
  const m=new THREE.Vector3();
  if(player.camMode==='ots'&&avatarGun){ avatarGun.getWorldPosition(m); m.y+=.1; }
  else camera.localToWorld(m.set(.24,-.2,-.7));
  return m;
}
function shoot(held){
  if(mode!=='playing'||(document.pointerLockElement!==document.body&&!held)||performance.now()<player.fireAt||player.reloading) return;
  const w=player.weapon,s=weaponSpecs[w];
  if(!s.auto&&held) return;
  player.fireAt=performance.now()+s.delay*1000;
  if((player.ammo[w]??0)<=0){ play('dry'); reload(); return; }
  player.ammo[w]--; hud(); play(s.wonder?'boom':'fire');
  flashLight.position.copy(muzzle); flashLight.intensity=s.wonder?40:22;
  kick=Math.min(.09,kick+(s.pellets>1?.035:.012)); shake=Math.min(.5,shake+(s.pellets>1?.1:.02));
  ejectCasing();
  const origin=camera.getWorldPosition(new THREE.Vector3());
  const dir=aimDir(), muzzle=muzzlePos();
  const spread=s.spread*(1-player.ADS*.55);
  const packed=player.packed[w]?2:1;
  let hitAny=false,killed=false;
  for(let i=0;i<s.pellets;i++){
    const d=dir.clone().add(new THREE.Vector3((R()-.5)*spread,(R()-.5)*spread,0)).normalize();
    raycaster.set(origin,d); raycaster.far=70;
    const hit=raycaster.intersectObjects(hitProxies.filter(x=>!x.userData.enemy.dying),false)[0];
    let target=hit?hit.object.userData.enemy:null, point=origin.clone().addScaledVector(d,44);
    if(hit) point.copy(hit.point);
    if(!target){ let best=2.2;
      for(const e of enemies){ if(e.dying)continue;
        const c=e.root.position.clone(); c.y+=1.2; const to=c.sub(origin); const along=to.dot(d);
        if(along<0||along>55)continue; const off=to.addScaledVector(d,-along).length();
        if(off<best){ best=off; target=e; point.copy(e.root.position.clone().add(new THREE.Vector3(0,1.2,0))); } } }
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle,point]),tracerMat);
    scene.add(line); tracers.push({ o:line, life:.07 });
    if(target){ hitAny=true; spawnBlood(point,10);
      const head=Math.abs(point.y-(target.root.position.y+1.9*target.root.scale.x))<.32;
      let dmg=s.damage*packed*player.damageMult*(head?2:1);
      if(player.instaTimer>0) dmg=1e6;
      target.hp-=dmg; award(10);
      if(target.hp<=0&&!target.dying){ killZombie(target); killed=true; addSplat(target.root.position); } else { play('hit'); setAnim(target,'hit'); } } }
  if(hitAny){ $('crosshair').classList.add(killed?'kill':'hit'); $('hit-label').textContent=killed?'DOWN':'+10'; $('hit-label').classList.add('show');
    setTimeout(()=>{ $('crosshair').classList.remove('hit','kill'); $('hit-label').classList.remove('show'); },130); }
}
function killZombie(e){
  if(e.dying) return; e.dying=true; e.dyingTime=1.1; setAnim(e,'death');
  player.kills++; award(e.boss?800:(e.profile.pts??100));
  play(e.boss?'boom':'hit'); hud(); maybeDrop(e.root.position);
}
function melee(){
  if(mode!=='playing'||performance.now()<player.meleeAt) return; player.meleeAt=performance.now()+650;
  const dir=aimDir();
  let best=null,bd=3;
  for(const e of enemies){ if(e.dying)continue;
    const to=e.root.position.clone(); to.y+=1; to.sub(camera.position);
    const d=to.length(); if(d<bd&&dir.dot(to.normalize())>.25){ bd=d; best=e; } }
  if(best){ best.hp-=130*player.damageMult; award(10); play('hit');
    if(best.hp<=0) killZombie(best); else setAnim(best,'hit'); hud(); }
}
// ============ POWERUPS ============
const powerups=[];
const puStyle={ maxammo:['#ffc85f','MAX AMMO'], insta:['#ff4a4a','INSTA-KILL'], double:['#6fff9d','DOUBLE PTS'] };
function maybeDrop(pos){
  if(R()>.07||powerups.length>=3) return;
  const kinds=['maxammo','insta','double'], kind=kinds[(R()*3)|0];
  const g=new THREE.Group();
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.4), new THREE.MeshBasicMaterial({ color:new THREE.Color(puStyle[kind][0]) }));
  gem.position.y=.9; g.add(gem);
  g.position.set(pos.x,0,pos.z); scene.add(g);
  powerups.push({ kind, g, life:30, ph:R()*6 });
}
function collectPU(p){
  if(p.kind==='maxammo'){ for(const k of player.owned){ player.ammo[k]=weaponSpecs[k].mag; player.reserve[k]=weaponSpecs[k].reserve; } showToast(`${ICO('icon-ammo')} MAX AMMO`); }
  if(p.kind==='insta'){ player.instaTimer=30; showToast('INSTA-KILL 30S'); }
  if(p.kind==='double'){ player.doubleTimer=30; showToast('DOUBLE POINTS 30S'); }
  play('clear'); scene.remove(p.g); powerups.splice(powerups.indexOf(p),1); hud();
}
// ============ PURCHASES ============
function buyVault(d){
  if(d.opened) return true;
  if(player.points<d.cost){ showToast(`${ICO('icon-key')} ${d.cost} PTS TO BREACH`); return true; }
  player.points-=d.cost; d.opened=true; d.group.visible=false;
  for(const b of d.blockers){ const i=obstacles.indexOf(b); if(i>=0) obstacles.splice(i,1); }
  play('clear'); centerToast(`${d.name} VAULT BREACHED`,'CLAIM THE CACHE'); hud(); return true;
}
function claimCache(d){
  if(d.cacheClaimed){ showToast('VAULT EMPTIED'); return true; }
  player.points+=750;
  for(const k of player.owned){ player.ammo[k]=weaponSpecs[k].mag; player.reserve[k]+=Math.ceil(weaponSpecs[k].reserve*.5); }
  const pool=boxPool.filter(w=>!player.owned.includes(w));
  const w=pool.length?pool[(R()*pool.length)|0]:'vex';
  if(!player.owned.includes(w)) player.owned.push(w);
  player.ammo[w]=weaponSpecs[w].mag; player.reserve[w]=(player.reserve[w]??0)+weaponSpecs[w].reserve;
  equip(w); play('boom'); centerToast('VAULT CACHE CLAIMED',`+750 PTS · ${weaponSpecs[w].label}`); hud(); return true;
}
function buyWallbuy(w){
  if(player.owned.includes(w.weapon)){ showToast('ALREADY CARRYING'); return true; }
  if(player.points<w.cost){ showToast(`${ICO('icon-pistol')} ${w.cost} PTS`); return true; }
  player.points-=w.cost; player.owned.push(w.weapon);
  player.ammo[w.weapon]=weaponSpecs[w.weapon].mag; player.reserve[w.weapon]=weaponSpecs[w.weapon].reserve;
  equip(w.weapon); play('clear'); showToast(`${weaponSpecs[w.weapon].label} ACQUIRED`); hud(); return true;
}
function buyPerk(p){
  if(player.perks[p.key]){ showToast('PERK ACTIVE'); return true; }
  if(Object.keys(player.perks).length>=4){ showToast('4 PERK LIMIT'); return true; }
  if(player.points<p.cost){ showToast(`${p.cost} PTS · ${p.name}`); return true; }
  player.points-=p.cost; player.perks[p.key]=true;
  if(p.key==='jug'){ player.maxHealth+=100; player.health=player.maxHealth; }
  if(p.key==='cola'){ player.reloadMult=.6; player.speedMult*=1.06; }
  if(p.key==='tap') player.damageMult*=1.3;
  if(p.key==='stam') player.speedMult*=1.12;
  play('clear'); showToast(`${ICO(PERK_ICON[p.key])} ${p.name} ACTIVE`); hud(); return true;
}
function usePap(){
  const w=player.weapon;
  if(player.packed[w]){ showToast('ALREADY PACKED'); return true; }
  if(player.points<pap.cost){ showToast(`${pap.cost} PTS · PACK-A-PUNCH`); return true; }
  player.points-=pap.cost; player.packed[w]=true;
  player.ammo[w]=Math.ceil(weaponSpecs[w].mag*1.5); player.reserve[w]=weaponSpecs[w].reserve*2;
  play('boom'); centerToast('PACK-A-PUNCHED',weaponSpecs[w].label); hud(); return true;
}
function rollChest(){
  if(chest.rolling) return true;
  if(player.points<chest.cost){ showToast(`${ICO('icon-chest')} ${chest.cost} PTS`); return true; }
  player.points-=chest.cost; chest.rolling=true; play('clear');
  setTimeout(()=>{ const w=boxPool[(R()*boxPool.length)|0];
    if(!player.owned.includes(w)) player.owned.push(w);
    player.ammo[w]=weaponSpecs[w].mag; player.reserve[w]=(player.reserve[w]??0)+weaponSpecs[w].reserve;
    equip(w); chest.rolling=false; centerToast(weaponSpecs[w].label,'FRESH FROM THE BOX'); hud(); },2000);
  hud(); return true;
}
function rebuildBarrier(b){
  if(b.health>=b.maxHealth){ showToast('BARRIER HOLDING'); return true; }
  b.health++; b.boards[b.health-1].visible=true; award(10); play('clear'); hud(); return true;
}
function interact(){
  if(mode!=='playing') return;
  let bd=3.6, fn=null;
  const consider=(pos,dist,f)=>{ if(dist<bd){ bd=dist; fn=f; } };
  for(const d of doors){ if(!d.opened) consider(d.group.position,d.group.position.distanceTo(camera.position),()=>buyVault(d));
    else consider(d.cachePos,d.cachePos.distanceTo(camera.position),()=>{ claimCache(d); d.cacheClaimed=true; }); }
  for(const w of wallbuys) consider(w.pos,w.pos.distanceTo(camera.position),()=>buyWallbuy(w));
  for(const p of perkMachines) consider(p.pos,p.pos.distanceTo(camera.position),()=>buyPerk(p));
  for(const b of barriers) if(b.health<b.maxHealth) consider(b.pos,b.pos.distanceTo(camera.position),()=>rebuildBarrier(b));
  consider(chest.pos,chest.pos.distanceTo(camera.position),rollChest);
  consider(pap.pos,pap.pos.distanceTo(camera.position),usePap);
  if(fn) fn(); else melee();
}
function prompt(){
  const el=$('interaction-hint'); if(mode!=='playing'){ el.classList.remove('show'); return; }
  let txt=null,bd=3.8;
  const consider=(pos,t)=>{ if(t==null)return; const d=pos.distanceTo(camera.position); if(d<bd){ bd=d; txt=t; } };
  for(const d of doors){ if(!d.opened) consider(d.group.position,`${ICO('icon-key')} <b>E / B</b> BREACH ${d.name} VAULT · ${d.cost}`);
    else if(!d.cacheClaimed) consider(d.cachePos,`${ICO('icon-chest')} <b>E / B</b> CLAIM VAULT CACHE`); }
  for(const w of wallbuys) if(!player.owned.includes(w.weapon)) consider(w.pos,`${ICO('icon-pistol')} <b>E / B</b> ${w.weapon.toUpperCase()} · ${w.cost}`);
  for(const p of perkMachines) if(!player.perks[p.key]) consider(p.pos,`${ICO(PERK_ICON[p.key])} <b>E / B</b> ${p.name} · ${p.cost}`);
  for(const b of barriers) if(b.health<b.maxHealth) consider(b.pos,`${ICO('icon-shield')} <b>E / B</b> REBUILD · +10`);
  consider(chest.pos,`${ICO('icon-chest')} <b>E / B</b> MYSTERY BOX · ${chest.cost}`);
  consider(pap.pos,player.packed[player.weapon]?null:`${ICO('icon-star')} <b>E / B</b> PACK-A-PUNCH · ${pap.cost}`);
  const zb=enemies.find(e=>!e.dying&&e.root.position.distanceTo(camera.position)<3);
  if(!txt&&zb) txt=`<b>LMB / RT</b> FIRE &nbsp; <b>E / B</b> KNIFE`;
  if(txt){ el.innerHTML=txt; el.classList.add('show'); } else el.classList.remove('show');
}
function takeDamage(a){
  if(damageCd>0||mode!=='playing') return; damageCd=.7; player.lastHit=0; shake=Math.min(.8,shake+.35);
  player.health=Math.max(0,player.health-a);
  $('vignette').classList.add('damaged'); setTimeout(()=>$('vignette').classList.remove('damaged'),150); hud();
  if(player.health<=0) gameOver();
}
// ============ JUICE: flash, blood, casings, splats ============
const flashLight=new THREE.PointLight(0xffd9a0,0,11,2); scene.add(flashLight);
function radialTex(inner,outer){
  const c=document.createElement('canvas'); c.width=c.height=32;
  const g=c.getContext('2d'); const gr=g.createRadialGradient(16,16,2,16,16,16);
  gr.addColorStop(0,inner); gr.addColorStop(1,outer); g.fillStyle=gr; g.fillRect(0,0,32,32);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const bloodM=new THREE.SpriteMaterial({ map:radialTex('rgba(200,20,20,1)','rgba(120,0,0,0)'), transparent:true, depthWrite:false });
const bloods=[];
function spawnBlood(p,n=6){
  for(let i=0;i<n;i++){
    const sp=new THREE.Sprite(bloodM.clone()); sp.position.copy(p);
    sp.scale.setScalar(random(.25,.5));
    sp.userData.v=new THREE.Vector3(random(-2,2),random(1,3.5),random(-2,2));
    sp.userData.life=random(.3,.55); scene.add(sp); bloods.push(sp);
  }
  if(bloods.length>60){ const o=bloods.shift(); scene.remove(o); o.material.dispose(); }
}
const splatGeo=new THREE.CircleGeometry(.5,10);
const splatM=new THREE.MeshBasicMaterial({ color:0x5a0d0d, transparent:true, opacity:.85, depthWrite:false });
const splats=[];
function addSplat(p){
  const m=new THREE.Mesh(splatGeo,splatM);
  m.rotation.x=-Math.PI/2; m.rotation.z=random(0,6);
  m.position.set(p.x+random(-.3,.3),.025,p.z+random(-.3,.3));
  m.scale.setScalar(random(.6,1.6)); scene.add(m); splats.push(m);
  if(splats.length>40){ const o=splats.shift(); scene.remove(o); }
}
const casingGeo=new THREE.BoxGeometry(.05,.05,.12);
const casingM=new THREE.MeshBasicMaterial({ color:0xd8b23c });
const casings=[];
function ejectCasing(){
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const m=new THREE.Mesh(casingGeo,casingM);
  m.position.copy(camera.position).addScaledVector(right,.35); m.position.y-=.25;
  casings.push({ m, v:new THREE.Vector3(right.x*random(1,2),random(1.5,2.5),right.z*random(1,2)), life:1 });
  scene.add(m);
  if(casings.length>12){ const o=casings.shift(); scene.remove(o.m); }
}
{
  const c=document.createElement('canvas'); c.width=512; c.height=256;
  const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,'#02030a'); gr.addColorStop(.55,'#0a1020'); gr.addColorStop(.75,'#1a2233'); gr.addColorStop(1,'#05070c');
  g.fillStyle=gr; g.fillRect(0,0,512,256);
  for(let i=0;i<220;i++){ g.fillStyle=`rgba(255,255,255,${random(.2,.9)})`; g.fillRect((R()*512)|0,(R()*150)|0,1,1); }
  g.fillStyle='#e8ecf5'; g.beginPath(); g.arc(400,52,22,0,7); g.fill();
  g.fillStyle='rgba(200,210,235,.25)'; g.beginPath(); g.arc(400,52,30,0,7); g.fill();
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const sky=new THREE.Mesh(new THREE.SphereGeometry(330,20,12), new THREE.MeshBasicMaterial({ map:t, side:THREE.BackSide, fog:false, depthWrite:false }));
  scene.add(sky);
}
// ============ ROUND FLOW ============
function setOverlay(id,on){ $(id).classList.toggle('active',on); }
function requestLock(){ try{ const r=document.body.requestPointerLock?.(); if(r&&r.catch) r.catch(()=>{}); }catch{} }
function beginRound(){
  if(mode==='gameover') resetGame();
  mode='playing';
  for(const id of ['shop-screen','intro-screen','title-screen','pause-screen']) setOverlay(id,false);
  $('hud').style.display='block';
  player.round++;
  roundRemaining=5+player.round*3; spawnTimer=.5;
  centerToast(`ROUND ${String(player.round).padStart(2,'0')}`, player.round===1?'THEY KNOW YOU ARE HERE':player.round%5===0?'SOMETHING BIG STIRS':'HOLD THE LINE');
  requestLock(); hud();
}
function finishRound(){
  mode='breather'; player.breather=7; play('clear');
  const bonus=100+player.round*15; player.points+=bonus;
  centerToast('ROUND CLEAR',`+${bonus} BONUS · NEXT WAVE INCOMING`); hud();
}
function gameOver(){
  mode='gameover'; document.exitPointerLock?.(); $('hud').style.display='none';
  $('final-round').textContent=player.round; $('final-kills').textContent=player.kills;
  $('final-points').textContent=player.points.toLocaleString();
  const best=Math.max(Number(localStorage.getItem('dgw-best')||0),player.points);
  localStorage.setItem('dgw-best',best); setOverlay('gameover-screen',true);
}
function resetGame(){
  for(const e of [...enemies]) removeZombie(e);
  for(const p of [...powerups]) scene.remove(p.g); powerups.length=0;
  for(const d of doors){ d.opened=false; d.cacheClaimed=false; d.group.visible=true;
    for(const b of d.blockers) if(!obstacles.includes(b)) obstacles.push(b); }
  for(const b of barriers){ b.health=2; b.boards.forEach((p,i)=>p.visible=i<2); }
  Object.assign(player,{ health:100,maxHealth:100,points:500,kills:0,round:0,weapon:'hawkmoon',owned:['hawkmoon'],
    ammo:{hawkmoon:8},reserve:{hawkmoon:80},perks:{},packed:{},damageMult:1,reloadMult:1,speedMult:1,
    instaTimer:0,doubleTimer:0,reloading:false,ADS:0,lastHit:99 });
  equip('hawkmoon');
  camera.position.set(PLAYER_SPAWN.x,1.68,PLAYER_SPAWN.z);
  yaw=R()*Math.PI*2; pitch=0; camera.rotation.set(0,yaw,0);
  setOverlay('gameover-screen',false); setOverlay('title-screen',false); hud();
}
function toggleCam(){
  player.camMode=player.camMode==='fps'?'ots':'fps';
  for(const [k,m] of Object.entries(weaponModels)) m.visible=(k===player.weapon&&player.camMode==='fps');
  if(avatar) avatar.visible=(player.camMode==='ots');
  if(player.camMode==='fps'){ camera.rotation.order='YXZ'; camera.rotation.set(pitch,yaw,0); }
  showToast(player.camMode==='ots'?'OVER-SHOULDER CAM':'FIRST PERSON'); hud();
}
// ============ CONTROLLER (full map) ============
let adsHeld=false, padFire=false, padPrev={};
let mouseADS=false, mouseHeld=false;
function pollPad(dt){
  const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);
  padFire=false;
  if(!pad){ adsHeld=mouseADS; return null; }
  const dz=v=>Math.abs(v)<.16?0:Math.sign(v)*(Math.abs(v)-.16)/.84;
  const val=i=>pad.buttons[i]?.value??0, pr=i=>val(i)>.45;
  const edge=i=>pr(i)&&!padPrev[i];
  const startEdge=edge(9), backEdge=edge(8);
  if(startEdge){ if(mode==='playing') pauseGame(); else if(mode==='paused'){ mode='playing'; setOverlay('pause-screen',false); requestLock(); } }
  else if(mode==='playing'){
    if(backEdge) toggleCam();
    let lx=dz(pad.axes[2]||0), ly=dz(pad.axes[3]||0);
    lx=Math.sign(lx)*lx*lx; ly=Math.sign(ly)*ly*ly;
    const ads=val(6)>.35;
    let rate=2.6, vrate=2.1;
    if(ads||adsHeld){
      rate=1.5; vrate=1.3;
      _fray.set(camera.position.x,camera.position.y,camera.position.z);
      _fdir.set(-Math.sin(yaw),0,-Math.cos(yaw));
      raycaster.set(_fray,_fdir); raycaster.far=40;
      if(raycaster.intersectObjects(hitProxies,false)[0]){ rate*=.4; vrate*=.4; }
    }
    yaw-=lx*rate*dt; pitch=THREE.MathUtils.clamp(pitch-ly*vrate*dt,-1.3,1.3);
    if(edge(2)) reload();
    if(edge(1)||edge(14)) interact();
    if(edge(5)) melee();
    if(edge(3)||edge(12)||edge(13)){ const i=player.owned.indexOf(player.weapon); equip(player.owned[(i+1)%player.owned.length]); hud(); }
    adsHeld=ads||mouseADS;
    padFire=firing(val(7));
    if(padFire) shoot(true);
  }
  padPrev={}; for(let i=0;i<pad.buttons.length;i++) padPrev[i]=pr(i);
  if(mode!=='playing') return null;
  return { mx:dz(pad.axes[0]||0), my:dz(pad.axes[1]||0), sprint:pr(4), jump:pr(0) };
}
function firing(v){ return v>.35; }

// ============ UPDATE ============
const clock=new THREE.Clock();
function moveCollide(pos,delta,r){
  const ok=(axis,v)=>{ const x=axis==='x'?v:pos.x, z=axis==='z'?v:pos.z;
    if(Math.abs(x)>GX-1||Math.abs(z)>GZ-1) return false;
    return !obstacles.some(b=>x>b.min.x-r&&x<b.max.x+r&&z>b.min.z-r&&z<b.max.z+r); };
  const nx=pos.x+delta.x; if(ok('x',nx)) pos.x=nx;
  const nz=pos.z+delta.z; if(ok('z',nz)) pos.z=nz;
}
function zombieMove(e,step){
  const nx=e.root.position.x+step.x, nz=e.root.position.z+step.z;
  const blk=(x,z)=>Math.abs(x)>GX-1||Math.abs(z)>GZ-1||obstacles.some(b=>!b.isDoor&&x>b.min.x-.55&&x<b.max.x+.55&&z>b.min.z-.55&&z<b.max.z+.55);
  if(!blk(nx,e.root.position.z)) e.root.position.x=nx;
  if(!blk(e.root.position.x,nz)) e.root.position.z=nz;
}
const _v1=new THREE.Vector3(), _v2=new THREE.Vector3(), _eye=new THREE.Vector3();
const _fray=new THREE.Vector3(), _fdir=new THREE.Vector3();
function updateCamera(dt){
  flashLight.intensity*=Math.exp(-14*dt);
  kick*=Math.exp(-9*dt); shake*=Math.exp(-6*dt);
  const adsT=adsHeld?1:0;
  player.ADS+=(adsT-player.ADS)*Math.min(1,dt*10);
  const wantFov=player.camMode==='fps'?75-18*player.ADS:62-9*player.ADS;
  if(Math.abs(camera.fov-wantFov)>.1){ camera.fov=wantFov; camera.updateProjectionMatrix(); }
  if(player.camMode==='fps'){
    if(avatar) avatar.visible=false;
    const wm=weaponModels[player.weapon];
    if(wm){ wm.position.x=.24-.2*player.ADS; wm.position.y=-.28+.05*player.ADS+Math.sin(clock.elapsedTime*9)*.006; wm.position.z=-.52+.1*player.ADS+kick*2.2; }
    camera.position.x+=(R()-.5)*shake*.3; camera.position.y+=(R()-.5)*shake*.3; camera.rotation.z+=(R()-.5)*shake*.02;
  } else {
    _eye.copy(camera.position);
    player._eye=player._eye||new THREE.Vector3(); player._eye.copy(_eye);
    _v1.set(-Math.sin(yaw),0,-Math.cos(yaw));
    _v2.set(Math.cos(yaw),0,-Math.sin(yaw));
    const dist=3.6-1.2*player.ADS;
    const px=_eye.x-_v1.x*dist+_v2.x*.95, pz=_eye.z-_v1.z*dist+_v2.z*.95, py=_eye.y+.45;
    const inside=(x,y,z)=>obstacles.some(b=>x>b.min.x-.4&&x<b.max.x+.4&&y>b.min.y&&y<b.max.y&&z>b.min.z-.4&&z<b.max.z+.4);
    let t=1;
    for(let k=10;k>=0;k--){ const q=k/10;
      const x=_eye.x+(_v1.x*0+ (px-_eye.x))*q, y=_eye.y+(py-_eye.y)*q, z=_eye.z+(pz-_eye.z)*q;
      if(!inside(x,y,z)){ t=q; break; } t=0; }
    camera.position.set(_eye.x+(px-_eye.x)*t,_eye.y+(py-_eye.y)*t,_eye.z+(pz-_eye.z)*t);
    _v1.multiplyScalar(14); camera.lookAt(_eye.x+_v1.x,_eye.y+Math.tan(pitch)*14+.3,_eye.z+_v1.z);
    if(avatar){ avatar.visible=true; avatar.position.set(_eye.x,0,_eye.z); avatar.rotation.y=yaw+Math.PI;
      avatar.position.y=Math.abs(Math.sin(clock.elapsedTime*7))*.03; }
    camera.position.x+=(R()-.5)*shake*.3; camera.position.y+=(R()-.5)*shake*.3; camera.rotation.z+=(R()-.5)*shake*.02;
  }
}
function update(dt,t){
  damageCd=Math.max(0,damageCd-dt);
  player.instaTimer=Math.max(0,player.instaTimer-dt);
  player.doubleTimer=Math.max(0,player.doubleTimer-dt);
  const pad=pollPad(dt);
  if(mode==='breather'){ player.breather-=dt; if(player.breather<=0) beginRound(); }
  if(mode==='playing'){
    const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const mv=new THREE.Vector3();
    if(keys.has('KeyW'))mv.add(fwd); if(keys.has('KeyS'))mv.sub(fwd);
    if(keys.has('KeyD'))mv.add(right); if(keys.has('KeyA'))mv.sub(right);
    if(pad){ mv.addScaledVector(right,pad.mx).addScaledVector(fwd,-pad.my); }
    const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight')||pad?.sprint;
    if(mv.lengthSq()>0){ mv.normalize().multiplyScalar(player.speed*player.speedMult*(sprint?1.4:1)*dt); moveCollide(camera.position,mv,.5); }
    for(const b of obstacles){ const p=camera.position;
      if(p.x>b.min.x-.4&&p.x<b.max.x+.4&&p.z>b.min.z-.4&&p.z<b.max.z+.4&&p.y<b.max.y){
        const dxl=p.x-(b.min.x-.4),dxr=(b.max.x+.4)-p.x,dzl=p.z-(b.min.z-.4),dzr=(b.max.z+.4)-p.z;
        const m=Math.min(dxl,dxr,dzl,dzr);
        if(m===dxl)p.x=b.min.x-.4;else if(m===dxr)p.x=b.max.x+.4;else if(m===dzl)p.z=b.min.z-.4;else p.z=b.max.z+.4; } }
    if((keys.has('Space')||pad?.jump)&&canJump){ velocityY=5.2; canJump=false; }
    velocityY-=14*dt; camera.position.y+=velocityY*dt;
    if(camera.position.y<1.68){ camera.position.y=1.68; velocityY=0; canJump=true; }
    player.lastHit+=dt;
    if(player.lastHit>5&&player.health<player.maxHealth) player.health=Math.min(player.maxHealth,player.health+22*dt);
    const alive=enemies.filter(e=>!e.dying).length;
    if(roundRemaining>0&&alive<MAX_ALIVE){ spawnTimer-=dt;
      if(spawnTimer<=0){ addZombie(player.round%5===0&&roundRemaining===1); roundRemaining--; spawnTimer=Math.max(.35,.95-player.round*.03); hud(); } }
    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      if(e.dying){ e.dyingTime-=dt; e.root.rotation.x=Math.min(Math.PI/2,e.root.rotation.x+dt*4); e.root.position.y-=dt*.5;
        if(e.dyingTime<=0){ removeZombie(e); enemies.splice(i,1); } continue; }
      const dx=camera.position.x-e.root.position.x, dz=camera.position.z-e.root.position.z;
      const d=Math.hypot(dx,dz);
      e.root.rotation.y=Math.atan2(dx,dz);
      const bar=barriers.find(b=>b.health>0&&b.pos.distanceTo(e.root.position)<2.2);
      if(bar){ e.attack-=dt;
        if(e.attack<=0){ e.attack=1.2; bar.health=Math.max(0,bar.health-1);
          if(bar.boards[bar.health]) bar.boards[bar.health].visible=false; } continue; }
      if(d>1.7){ const s=e.speed*(d<7?1.15:1); setAnim(e,'walk');
        if(e.type==='dragon') e.root.position.y=.35+Math.sin(e.phase+=dt*4)*.3;
        zombieMove(e,new THREE.Vector3(dx/d*s*dt,0,dz/d*s*dt));
        for(const o of enemies){ if(o===e||o.dying)continue;
          const ox=e.root.position.x-o.root.position.x,oz=e.root.position.z-o.root.position.z;
          const od=Math.hypot(ox,oz);
          if(od>0.01&&od<1.1){ e.root.position.x+=ox/od*(1.1-od)*.5*dt*8; e.root.position.z+=oz/od*(1.1-od)*.5*dt*8; } } }
      else { e.attack-=dt;
        if(e.attack<=0){ e.attack=e.profile.cooldown; setAnim(e,'attack'); takeDamage(e.profile.damage); } }
    }
    if(roundRemaining===0&&enemies.length===0) finishRound();
  }
  for(let i=bloods.length-1;i>=0;i--){ const b=bloods[i]; b.userData.life-=dt;
    if(b.userData.life<=0){ scene.remove(b); b.material.dispose(); bloods.splice(i,1); continue; }
    b.userData.v.y-=9*dt; b.position.addScaledVector(b.userData.v,dt); b.material.opacity=b.userData.life*2; }
  for(let i=casings.length-1;i>=0;i--){ const c=casings[i]; c.life-=dt;
    if(c.life<=0){ scene.remove(c.m); casings.splice(i,1); continue; }
    c.v.y-=9*dt; c.m.position.addScaledVector(c.v,dt); c.m.rotation.x+=dt*9; if(c.m.position.y<.05){ c.m.position.y=.05; c.v.set(0,0,0); } }
  if(chest.lid){ if(chest.rolling){ chest.lid.position.y=1+Math.abs(Math.sin(t*9))*.6; chest.lid.rotation.y+=dt*7; }
    else { chest.lid.position.y+=(1-chest.lid.position.y)*Math.min(1,dt*5); } }
  const zn=camera.position.z>20?'THE PLAZA':camera.position.x<-14?'THE CHAPEL':camera.position.x>14?'THE FOUNDRY':camera.position.z<-20?'THE COURT':'MID GROUND';
  zoneCd-=dt; if(zn!==zoneCur&&zoneCd<=0){ zoneCur=zn; zoneCd=9; if(mode==='playing'&&player.round>0) centerToast(zn,''); }
  for(const p of [...powerups]){
    p.life-=dt; p.ph+=dt*3; p.g.position.y=Math.sin(p.ph)*.1; p.g.rotation.y+=dt;
    if(p.g.position.distanceTo(camera.position)<1.9) collectPU(p);
    else if(p.life<=0){ scene.remove(p.g); powerups.splice(powerups.indexOf(p),1); }
  }
  for(const arr of [wallbuys,perkMachines]) for(const w of arr) if(w.spinner){ w.spinner.rotation.y+=dt*.8; }
  updateCamera(dt);
  prompt();
  for(let i=tracers.length-1;i>=0;i--){ tracers[i].life-=dt;
    if(tracers[i].life<=0){ scene.remove(tracers[i].o); tracers[i].o.geometry.dispose(); tracers.splice(i,1); } }
  for(const m of mixers) m.update(dt);
  hud();
}
function pauseGame(){ if(mode!=='playing')return; mode='paused'; setOverlay('pause-screen',true); document.exitPointerLock?.(); }
// ============ LOOP ============
function animate(){
  requestAnimationFrame(animate);
  const rawDt=clock.getDelta(), dt=Math.min(rawDt,.045), t=clock.elapsedTime;
  emaDt=emaDt*.95+Math.min(rawDt,.1)*.05; qualityTimer++;
  if(qualityTimer>=110){ qualityTimer=0;
    if(emaDt>.027&&qualityScale>.7){ qualityScale=Math.max(.7,qualityScale-.15); renderer.setPixelRatio(Math.min(devicePixelRatio,1)*qualityScale); }
    else if(emaDt<.015&&qualityScale<1){ qualityScale=Math.min(1,qualityScale+.15); renderer.setPixelRatio(Math.min(devicePixelRatio,1)*qualityScale); } }
  update(dt,t);
  renderer.render(scene,camera);
  if(player.camMode==='ots'&&player._eye) camera.position.copy(player._eye);
}
animate();
// ============ INPUT ============
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
document.addEventListener('pointerlockchange',()=>{ if(document.pointerLockElement!==document.body&&mode==='playing') pauseGame(); });
document.addEventListener('mousemove',e=>{ if(document.pointerLockElement!==document.body||mode!=='playing')return;
  yaw-=e.movementX*.0022*(1-player.ADS*.4); pitch-=e.movementY*.0022*(1-player.ADS*.4);
  pitch=THREE.MathUtils.clamp(pitch,-1.3,1.3);
  if(player.camMode==='fps'){ camera.rotation.order='YXZ'; camera.rotation.set(pitch,yaw,0); } });
document.addEventListener('keydown',e=>{ keys.add(e.code); if(e.code==='Space')e.preventDefault(); if(e.repeat)return;
  if(e.code==='KeyR')reload(); if(e.code==='KeyE')interact(); if(e.code==='KeyV')toggleCam();
  if(e.code==='Escape'&&mode==='playing')pauseGame();
  if(e.code==='Digit1'||e.code==='Digit2'){ const i=e.code==='Digit1'?0:1; if(player.owned[i]){ equip(player.owned[i]); hud(); } }
  if(['BracketLeft','BracketRight','Semicolon','Quote'].includes(e.code)){
    const k=player.weapon, c=mountCal(k)||{x:0,y:0}, s=(e.code==='BracketLeft'||e.code==='Semicolon')?-1:1;
    if(e.code==='BracketLeft'||e.code==='BracketRight') c.y+=s*.12; else c.x+=s*.12;
    try{ localStorage.setItem('dgw-mount-'+k, JSON.stringify(c)); }catch{}
    const wm=weaponModels[k]; if(wm) applyMount(wm,k);
    showToast(`${weaponSpecs[k].label} SIGHTED IN`); } });
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('mousedown',e=>{
  if(mode==='playing'&&document.pointerLockElement!==document.body){ requestLock(); return; }
  if(e.button===0){ mouseHeld=true; shoot(false); }
  if(e.button===2) mouseADS=true; });
document.addEventListener('mouseup',e=>{ if(e.button===0)mouseHeld=false; if(e.button===2)mouseADS=false; });
document.addEventListener('contextmenu',e=>e.preventDefault());
setInterval(()=>{ if(mouseHeld&&mode==='playing') shoot(true); },40);
$('intro-continue').addEventListener('click',()=>{ setOverlay('intro-screen',false); setOverlay('title-screen',true); });
$('play-button').addEventListener('click',()=>{ resetGame(); setOverlay('intro-screen',false); setOverlay('title-screen',false); beginRound(); });
$('continue-button')?.addEventListener('click',beginRound);
$('resume-button')?.addEventListener('click',()=>{ mode='playing'; setOverlay('pause-screen',false); requestLock(); });
$('restart-button')?.addEventListener('click',()=>{ resetGame(); beginRound(); });
$('retry-button')?.addEventListener('click',()=>{ resetGame(); beginRound(); });
setLoad(1,'OUTPOST 7 READY'); console.log('OUTPOST 7 build 9'); setOverlay('loading',false); setOverlay('title-screen',false); setOverlay('intro-screen',true); hud();
