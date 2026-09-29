import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
const $ = (id) => document.getElementById(id);
addEventListener('error',event=>{console.error('Game runtime error:',event.error||event.message);const status=$('load-status');if(status){status.textContent=`GAME ERROR · ${event.message||'CHECK CONSOLE'}`;$('loading').classList.add('active');}});
addEventListener('unhandledrejection',event=>{console.error('Game promise rejected:',event.reason);const status=$('load-status');if(status&&$('loading').classList.contains('active'))status.textContent=`LOAD ERROR · ${event.reason?.message||event.reason||'RELOAD THE PAGE'}`;});
const loader = new GLTFLoader();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c13);
scene.fog = new THREE.FogExp2(0x0b1017, 0.0072);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 180);
camera.position.set(0, 1.68, -18);
const renderer = new THREE.WebGLRenderer({ canvas: $('game-canvas'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const previewRenderer = new THREE.WebGLRenderer({ canvas: $('preview'), alpha: true, antialias: true });
previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
previewRenderer.toneMappingExposure = 1.25;
const previewScene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
previewCamera.position.set(0, 1.65, 5.5);
previewCamera.lookAt(0, 1.3, 0);
previewScene.add(new THREE.HemisphereLight(0xc8e5c8, 0x1d241e, 2.1));
const previewKey = new THREE.DirectionalLight(0xffdbad, 3.2);
previewKey.position.set(-3, 5, 4); previewScene.add(previewKey);

const mats = {
  ground: new THREE.MeshStandardMaterial({ color: 0x35393b, roughness: 1 }),
  path: new THREE.MeshStandardMaterial({ color: 0x24292e, roughness: 1 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x17212c, roughness: 1 }),
  blood: new THREE.MeshBasicMaterial({ color: 0x9f1a1a }),
  bullet: new THREE.MeshBasicMaterial({ color: 0xffe7a2 }),
};
scene.add(new THREE.HemisphereLight(0xa7bfed, 0x24212b, 1.55));
scene.add(new THREE.AmbientLight(0x9ba8c5, 0.72));
const moon = new THREE.DirectionalLight(0xa8c2f4, 2.05);
moon.position.set(-25, 42, 18); scene.add(moon);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(176, 176), mats.ground);
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.035; floor.receiveShadow = true; scene.add(floor);
const borders = [], obstacles = [], barricades = [], supplyCaches = [], drops = [], streetLights=[];

const loaded = {};
const mixers = [];
const assets = [
  ['kasumi', '/assets/characters/kasumi.glb'], ['reaper', '/assets/enemies/reaper.glb'],
  ['skeletonWarrior', '/assets/enemies/skeleton_Warrior.glb'], ['skeletonRogue', '/assets/enemies/skeleton_Rogue.glb'],
  ['skeletonMinion', '/assets/enemies/skeleton_Minion.glb'], ['skeletonMage', '/assets/enemies/skeleton_Mage.glb'],
  ['rigGeneral', '/assets/enemies/rig_general.glb'], ['rigMovement', '/assets/enemies/rig_movement.glb'],
  ['pistol', '/assets/weapons/sidearm.glb'], ['shotgun', '/assets/weapons/sakura_shotgun.glb'], ['smg', '/assets/weapons/hanami_smg.glb']
];
function setLoad(n, text) { $('load-fill').style.width = `${Math.round(n * 100)}%`; $('load-status').textContent = text; }
function loadGLTF(url) { return new Promise((resolve, reject) => loader.load(url, (g) => resolve(g), undefined, reject)); }
function normalized(root, height) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = height / Math.max(size.y, 0.001);
  root.scale.multiplyScalar(scale); root.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(root), center=scaledBox.getCenter(new THREE.Vector3());
  // Keep the source model inside a stable ground-centered pivot. Callers can now
  // set world position without discarding the mesh's original ground offset.
  const anchor = new THREE.Group(); anchor.add(root);
  root.position.x-=center.x; root.position.y-=scaledBox.min.y; root.position.z-=center.z;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.side = THREE.DoubleSide; } } });
  return anchor;
}
// Loading GLBs one at a time avoids a large parse/decode spike on integrated GPUs.
for(let i=0;i<assets.length;i++){
  const [key,url]=assets[i];setLoad(i/assets.length,`LOADING FIELD GEAR · ${i+1}/${assets.length}`);
  try{loaded[key]=await loadGLTF(url);}
  catch(err){console.warn(`Optional asset unavailable: ${url}`,err);}
  setLoad((i+1)/assets.length,`LOADING FIELD GEAR · ${i+1}/${assets.length}`);
}

const kasumi = loaded.kasumi?.scene ? normalized(cloneSkinned(loaded.kasumi.scene), 2.5) : null;
if (kasumi) {
  kasumi.position.set(0,0,0); previewScene.add(kasumi);
  kasumi.traverse(o=>{if(/knife|blade/i.test(o.name))o.visible=false;});
  if (loaded.kasumi.animations?.length) { const mixer=new THREE.AnimationMixer(kasumi);mixer.clipAction(loaded.kasumi.animations[0]).play();mixers.push(mixer); }
  // This character asset is rigged but ships in a T-pose with no clips. Lower
  // the shoulders for a relaxed ready stance in the menu preview.
  for(const [name,angle] of [['J_Bip_L_Shoulder',-.82],['J_Bip_L_UpperArm',-.35],['J_Bip_R_Shoulder',.82],['J_Bip_R_UpperArm',.35]]){
    const bone=kasumi.getObjectByName(name);if(bone)bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),angle));
  }
}
function fitPreview() { const r = $('preview').getBoundingClientRect(); if (r.width && r.height) { previewRenderer.setSize(r.width,r.height,false); previewCamera.aspect=r.width/r.height; previewCamera.updateProjectionMatrix(); } }
fitPreview();

function cloneAsset(key, height, position, rotation = 0) {
  const source = loaded[key]?.scene;
  if (!source) return null;
  const model = normalized(source.clone(true), height);
  model.position.set(position[0], position[1] ?? 0, position[2]); model.rotation.y = rotation;
  scene.add(model); return model;
}
const random = (a,b) => a + Math.random() * (b-a);
const boxMesh=(w,h,d,material,x,y,z,receive=true)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=receive;scene.add(m);return m;};
const roadMat=new THREE.MeshStandardMaterial({color:0x242a32,roughness:.94}), curbMat=new THREE.MeshStandardMaterial({color:0x77746a,roughness:1}),
  stripeMat=new THREE.MeshBasicMaterial({color:0xbec4ad}), brickMats=[0x344653,0x554842,0x3c444d,0x4a4c43,0x484050].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.92})),
  glassMats=[0x60c8d4,0xffc46f,0x8bd6ac].map(c=>new THREE.MeshBasicMaterial({color:c})), signMats=[0x30c5dc,0xff4f75,0xffc857].map(c=>new THREE.MeshBasicMaterial({color:c})),
  woodMat=new THREE.MeshStandardMaterial({color:0x765338,roughness:.9}), crateMat=new THREE.MeshStandardMaterial({color:0x405d42,emissive:0x163c20,emissiveIntensity:.55});
// A broad multi-district street grid with side streets and a visible skyline.
for(const lane of [-54,-18,18,54]){
  const alongZ=boxMesh(12,.025,164,roadMat,lane,.005,0,false),alongX=boxMesh(164,.026,12,roadMat,0,.006,lane,false);
  for(let t=-72;t<=72;t+=12){boxMesh(.16,.012,4,stripeMat,lane,.025,t,false);boxMesh(4,.012,.16,stripeMat,t,.025,lane,false);}
  for(const side of [-1,1]){
    boxMesh(2.2,.18,164,curbMat,lane+side*7.1,.08,0);boxMesh(164,.18,2.2,curbMat,0,.08,lane+side*7.1);
  }
}
const windowInstances=[[],[],[]];
for(const cx of [-36,0,36])for(const cz of [-36,0,36])for(const ox of [-7.2,7.2])for(const oz of [-7.2,7.2]){
  const x=cx+ox,z=cz+oz,w=random(9.4,11.2),d=random(9.4,11.4),h=random(10,22),mat=brickMats[Math.floor(random(0,brickMats.length))];
  const building=boxMesh(w,h,d,mat,x,h/2,z);obstacles.push(new THREE.Box3().setFromObject(building));
  const facing=(Math.abs(z)>Math.abs(x))?'z':'x';
  for(let floorIdx=1;floorIdx<Math.floor(h/3.3);floorIdx++)for(let k=-1;k<=1;k++){
    const wy=floorIdx*3.05+1.4;if(wy>h-1.3)continue;
    for(const side of [-1,1])for(const axis of ['x','z']){
      const winX=axis==='z'?x+k*2.6:x+side*(w/2+.045),winZ=axis==='z'?z+side*(d/2+.045):z+k*2.5;
      const matIndex=Math.floor(random(0,glassMats.length));
      windowInstances[matIndex].push({x:winX,y:wy,z:winZ,rotation:axis==='x'?Math.PI/2:0});
    }
  }
  const sign=boxMesh(2.8,.55,.13,signMats[Math.floor(random(0,signMats.length))],x,h*.58,z-d/2-.12);
  if(facing==='x'){sign.position.set(x-w/2-.12,h*.58,z);sign.rotation.y=Math.PI/2;}
  const roof=boxMesh(w+.35,.25,d+.35,new THREE.MeshStandardMaterial({color:0x202831}),x,h+.12,z);
  // Rooftop clutter makes silhouettes readable above the street.
  if(Math.random()<.7)boxMesh(1.5,random(1,2.5),1.5,curbMat,x+random(-2,2),h+1,z+random(-2,2));
  // Boards at storefront windows can be rebuilt for salvage and will absorb hits.
  if(Math.random()<.43){const boards=[];for(let i=0;i<3;i++){const plank=boxMesh(1.25,.14,.1,woodMat,x+(i-1)*.48,.9+i*.22,z-d/2-.17);plank.visible=i<2;boards.push(plank);}
    if(facing==='x')for(const plank of boards){plank.position.set(x-w/2-.17,.9+boards.indexOf(plank)*.22,z+(boards.indexOf(plank)-1)*.48);plank.rotation.y=Math.PI/2;}
    barricades.push({position:new THREE.Vector3(facing==='z'?x:x-w/2-.65,1,facing==='z'?z-d/2-.65:z),boards,health:2,maxHealth:3,attack:0});
  }
}
// One draw call per window color keeps the downtown skyline cheap to render.
const windowGeometry=new THREE.BoxGeometry(1.25,1.25,.07), windowDummy=new THREE.Object3D();
for(let materialIndex=0;materialIndex<windowInstances.length;materialIndex++){
  const windows=windowInstances[materialIndex];if(!windows.length)continue;
  const batch=new THREE.InstancedMesh(windowGeometry,glassMats[materialIndex],windows.length);
  windows.forEach((w,i)=>{windowDummy.position.set(w.x,w.y,w.z);windowDummy.rotation.set(0,w.rotation,0);windowDummy.updateMatrix();batch.setMatrixAt(i,windowDummy.matrix);});
  scene.add(batch);
}
// Street furniture, traffic lights, parked wrecks and pools of warm light give the blocks scale.
for(const x of [-54,-18,18,54])for(const z of [-54,-18,18,54]){
  for(const side of [-1,1]){
    const px=x+side*9.8,pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.17,6,7),new THREE.MeshStandardMaterial({color:0x394550,metalness:.35,roughness:.65}));pole.position.set(px,3,z+9);scene.add(pole);
    const arm=boxMesh(1.2,.16,.16,curbMat,px+side*.5,5.9,z+9);
    if((x===-54||x===18)&&(z===-54||z===18)){const lamp=new THREE.PointLight(side>0?0x69c9ff:0xffb457,3.1,17,1.75);lamp.position.set(px+side*.55,5.55,z+9);scene.add(lamp);streetLights.push(lamp);}
  }
}
for(const [x,z,rot] of [[-26,-25,0],[27,-28,Math.PI/2],[-27,26,-Math.PI/2],[26,28,Math.PI]]){
  const car=boxMesh(6,1.4,2.5,new THREE.MeshStandardMaterial({color:0x303e4b,metalness:.25,roughness:.45}),x,.8,z);car.rotation.y=rot;obstacles.push(new THREE.Box3().setFromObject(car));
  boxMesh(2.8,.65,2.2,new THREE.MeshStandardMaterial({color:0x18252e,metalness:.18,roughness:.28}),x,1.7,z-.1).rotation.y=rot;
}
// Exploration rewards: one-time stashes in side streets and behind the blocks.
for(const [x,z] of [[-45,-42],[43,-41],[-45,43],[43,44],[0,-67],[67,0],[-67,0]]){
  const cache=boxMesh(1.1,.85,.9,crateMat,x,.55,z);cache.rotation.y=random(0,Math.PI*2);
  const beacon=new THREE.PointLight(0x86ff83,1.9,8,2);beacon.position.set(x,1.2,z);scene.add(beacon);
  supplyCaches.push({position:new THREE.Vector3(x,.7,z),mesh:cache,beacon,opened:false});
}
for(const x of [-33,0,33])for(const z of [-33,0,33]){const sign=boxMesh(2.2,1.2,.12,signMats[(Math.abs(x+z)/33)%3|0],x,3,z);sign.userData.cityMarker=true;}
const edgeWall=new THREE.Mesh(new THREE.BoxGeometry(148,14,1),mats.wall);edgeWall.position.set(0,7,-74);scene.add(edgeWall);borders.push(new THREE.Box3().setFromObject(edgeWall));
const southWall=edgeWall.clone();southWall.position.z=74;scene.add(southWall);borders.push(new THREE.Box3().setFromObject(southWall));
const eastWall=new THREE.Mesh(new THREE.BoxGeometry(1,14,148),mats.wall);eastWall.position.set(74,7,0);scene.add(eastWall);borders.push(new THREE.Box3().setFromObject(eastWall));
const westWall=eastWall.clone();westWall.position.x=-74;scene.add(westWall);borders.push(new THREE.Box3().setFromObject(westWall));

const enemyTemplates = {
  warrior: loaded.skeletonWarrior?.scene ? normalized(cloneSkinned(loaded.skeletonWarrior.scene), 2.15) : null,
  rogue: loaded.skeletonRogue?.scene ? normalized(cloneSkinned(loaded.skeletonRogue.scene), 2.05) : null,
  minion: loaded.skeletonMinion?.scene ? normalized(cloneSkinned(loaded.skeletonMinion.scene), 1.55) : null,
  mage: loaded.skeletonMage?.scene ? normalized(cloneSkinned(loaded.skeletonMage.scene), 2.2) : null,
  reaper: loaded.reaper?.scene ? normalized(cloneSkinned(loaded.reaper.scene), 2.25) : null,
};
const enemyClips = [...(loaded.rigGeneral?.animations||[]),...(loaded.rigMovement?.animations||[]),...(loaded.reaper?.animations||[])];
const enemyClip = (...names) => enemyClips.find(c=>names.includes(c.name));
const MAX_ALIVE_ENEMIES=12;
const enemyRoster=[
  {type:'minion',hp:62,speed:3.9,damage:12,cooldown:.72,walk:['Running_A','Running_B'],hit:['Hit_A','Hit_B'],death:['Death_A','Death_B']},
  {type:'rogue',hp:100,speed:3.05,damage:15,cooldown:.82,walk:['Running_B','Walking_B'],hit:['Hit_B','Hit_A'],death:['Death_B','Death_A']},
  {type:'warrior',hp:142,speed:2.25,damage:20,cooldown:1.0,walk:['Walking_A','Walking_B'],hit:['Hit_A','Hit_B'],death:['Death_A','Death_B']},
  {type:'mage',hp:92,speed:1.95,damage:16,cooldown:1.0,walk:['Walking_B','Walking_A'],hit:['Hit_B','Hit_A'],death:['Death_B','Death_A'],ranged:true},
];
const weaponSpecs = {
  pistol: { label:'SERVICE PISTOL', mag:12, reserve:96, damage:34, delay:.27, reload:1.25, spread:.009, pellets:1 },
  shotgun: { label:'SAKURA SHOTGUN', mag:6, reserve:42, damage:22, delay:.78, reload:1.5, spread:.055, pellets:7 },
  smg: { label:'HANAMI SMG', mag:30, reserve:180, damage:13, delay:.095, reload:1.5, spread:.026, pellets:1 },
};
const weaponModels = {};
for (const key of ['pistol','shotgun','smg']) {
  const src=loaded[key]?.scene;
  if (!src) continue;
  const model=normalized(src.clone(true), key==='shotgun'?.35:.28);
  // The models are held close to the camera; asset-authored orientation is preserved.
  // These source meshes lie along local +X. Rotate +X into camera-forward -Z so
  // every muzzle points downrange instead of back toward the operative.
  model.scale.multiplyScalar(.55); model.position.set(.2,-.29,-.52); model.rotation.set(0,Math.PI/2,0);
  camera.add(model); weaponModels[key]=model;
}
const flashlight=new THREE.SpotLight(0xcbdcff,32,32,Math.PI/7,.62,1.6);
flashlight.position.set(0,0,0);flashlight.target.position.set(0,0,-1);camera.add(flashlight,flashlight.target);
scene.add(camera);

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const player = { health:100, maxHealth:100, points:500, kills:0, round:0, speed:6.1, damageBonus:0, weapon:'pistol', ammo:{pistol:12,shotgun:0,smg:0}, reserve:{pistol:96,shotgun:0,smg:0} };
const enemies=[]; const tracers=[]; const particles=[];
let mode='menu', yaw=Math.PI/2, pitch=0, canJump=true, velocityY=0, fireAt=0, meleeAt=0, reloading=false, roundRemaining=0, spawnTimer=0, waveSpawned=0,toastTimer=0, centerTimer=0;
let damageCooldown=0;
camera.rotation.set(0,yaw,0);
const keys=new Set();
let gamepadFire=false, previousPadButtons=[],gamepadInitialized=false;
function pollGamepad(dt) {
  const pad=Array.from(navigator.getGamepads?.()||[]).find(Boolean);
  gamepadFire=false;
  if(!pad)return {moveX:0,moveY:0,sprint:false,jump:false};
  const button=(i)=>pad.buttons[i]?.value??0;
  const pressed=(i)=>button(i)>.55;
  const firstPoll=!gamepadInitialized;gamepadInitialized=true;
  const edge=(i)=>!firstPoll&&pressed(i)&&!previousPadButtons[i];
  previousPadButtons=pad.buttons.map(b=>b.value>.55);
  const dz=.16, dead=(v)=>Math.abs(v)<dz?0:Math.sign(v)*(Math.abs(v)-dz)/(1-dz);
  const lx=dead(pad.axes[0]||0),ly=dead(pad.axes[1]||0),rx=dead(pad.axes[2]||0),ry=dead(pad.axes[3]||0);
  if(mode==='menu'&&edge(9)){setOverlay('intro-screen',false);setOverlay('title-screen',false);beginRound();}
  else if(mode==='playing'&&edge(9))pauseGame();
  else if(mode==='paused'&&edge(9))resumeGame();
  else if(mode==='shop'&&(edge(0)||edge(9)))beginRound();
  if(mode==='playing') {
    yaw-=rx*2.5*dt;pitch=THREE.MathUtils.clamp(pitch-ry*2.0*dt,-1.28,1.28);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
    if(edge(2))reload();if(edge(1))interactOrMelee();
    if(edge(3)){const choices=['pistol','shotgun','smg'];equip(choices[(choices.indexOf(player.weapon)+1)%choices.length].replace(/^(shotgun|smg)$/,(w)=>player.ammo[w]>0?w:player.weapon));}
    if(edge(14)&&player.ammo.pistol>0)equip('pistol');if(edge(15)&&player.ammo.shotgun>0)equip('shotgun');if(edge(12)&&player.ammo.smg>0)equip('smg');
    gamepadFire=button(7)>.35||button(5)>.55;
    if(gamepadFire)shoot();
  }
  return {moveX:lx,moveY:ly,sprint:pressed(4),jump:pressed(0)};
}
const sound={};
for (const [name,file] of Object.entries({fire:'deagle_fire',reload:'deagle_reload',dry:'deagle_dry',hit:'hitmarker',boom:'hawkmoon_paracausal_boom',clear:'01_chest_open_1'})) {
  sound[name]=new Audio(`/assets/audio/${file}.ogg`); sound[name].volume=name==='fire'?.34:.55;
}
function play(name) { const a=sound[name]; if (!a) return; try { a.currentTime=0; a.play().catch(()=>{}); } catch {} }
let musicOn=false,musicContext=null,musicMaster=null,musicTimer=0;
function startSpookyMusic(){
  if(!musicOn)return;
  try{
    musicContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(musicContext.state==='suspended')musicContext.resume();
    if(musicMaster)return;
    const ctx=musicContext,master=ctx.createGain();master.gain.value=.58;master.connect(ctx.destination);musicMaster=master;
    const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=260;low.Q.value=.7;low.connect(master);
    for(const [freq,detune] of [[43.65,-5],[55,4]]){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='triangle';osc.frequency.value=freq;osc.detune.value=detune;gain.gain.value=.055;osc.connect(gain);gain.connect(low);osc.start();}
    const noise=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.22;
    const wind=ctx.createBufferSource(),windFilter=ctx.createBiquadFilter(),windGain=ctx.createGain();wind.buffer=noise;wind.loop=true;windFilter.type='lowpass';windFilter.frequency.value=440;windGain.gain.value=.22;wind.connect(windFilter);windFilter.connect(windGain);windGain.connect(master);wind.start();
    const notes=[110,130.81,146.83,164.81,196,220];let n=0;
    musicTimer=setInterval(()=>{if(!musicOn||ctx.state!=='running')return;const osc=ctx.createOscillator(),env=ctx.createGain(),filter=ctx.createBiquadFilter(),now=ctx.currentTime;osc.type='sine';osc.frequency.value=notes[(n++*3+Math.floor(Math.random()*3))%notes.length];filter.type='lowpass';filter.frequency.value=750;env.gain.setValueAtTime(.0001,now);env.gain.exponentialRampToValueAtTime(.024,now+.45);env.gain.exponentialRampToValueAtTime(.0001,now+3.5);osc.connect(filter);filter.connect(env);env.connect(master);osc.start(now);osc.stop(now+3.6);},3200);
  }catch(error){console.warn('Ambient audio could not start',error);}
}
function setMusic(enabled){musicOn=enabled;if(enabled)startSpookyMusic();else if(musicContext?.state==='running')musicContext.suspend();$('music-toggle').textContent=enabled?'♫  MUSIC ON':'♫  MUSIC OFF';}
const remotePlayers=new Map();
let lobbyId=new URLSearchParams(location.search).get('lobby')?.toUpperCase()||'',lobbyPlayerId=sessionStorage.getItem('dgw-player-id');
if(!lobbyPlayerId){lobbyPlayerId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;sessionStorage.setItem('dgw-player-id',lobbyPlayerId);}
const lobbyName=`Responder ${lobbyPlayerId.slice(0,3).toUpperCase()}`;
function showLobby(message,code=lobbyId){const box=$('lobby-state');box.hidden=false;$('lobby-message').textContent=message;$('lobby-code').textContent=code?`// ${code}`:'';$('play-button').textContent=code?'▶  DEPLOY WITH SQUAD':'▶  START SOLO';}
async function lobbyPost(action,extra={}){const response=await fetch('/api/lobby',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,lobby:lobbyId,playerId:lobbyPlayerId,name:lobbyName,x:camera.position.x,z:camera.position.z,yaw,round:player.round,...extra})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Lobby request failed');return data;}
async function createLobby(){try{startSpookyMusic();const data=await lobbyPost('create');lobbyId=data.lobby;const url=new URL(location.href);url.searchParams.set('lobby',lobbyId);history.replaceState(null,'',url);showLobby(`SQUAD LINK READY · ${data.count}/${data.maxPlayers}`,lobbyId);await syncLobby();}catch(error){showLobby(`LOBBY ERROR · ${error.message}`,'');}}
async function joinLobby(id){lobbyId=id;try{const data=await lobbyPost('join');showLobby(`JOINED SQUAD · ${data.count+1}/${data.maxPlayers}`,lobbyId);await syncLobby();}catch(error){lobbyId='';history.replaceState(null,'',location.pathname);showLobby(`COULD NOT JOIN · ${error.message}`,'');}}
async function syncLobby(){if(!lobbyId)return;try{const data=await lobbyPost('sync');showLobby(`SQUAD LINK READY · ${data.count}/${data.maxPlayers}`,lobbyId);const current=new Set();for(const peer of data.players){current.add(peer.id);let avatar=remotePlayers.get(peer.id);if(!avatar){const group=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(.58,.035,6,24),new THREE.MeshBasicMaterial({color:0xc6ff62}));ring.rotation.x=Math.PI/2;ring.position.y=.08;group.add(ring);if(loaded.kasumi?.scene){const model=normalized(cloneSkinned(loaded.kasumi.scene),1.8);model.traverse(o=>{if(/knife|blade/i.test(o.name))o.visible=false;});group.add(model);}scene.add(group);avatar={group,target:new THREE.Vector3()};remotePlayers.set(peer.id,avatar);}avatar.target.set(peer.x,0,peer.z);avatar.group.rotation.y=peer.yaw;}
  for(const [id,avatar] of remotePlayers)if(!current.has(id)){scene.remove(avatar.group);remotePlayers.delete(id);}
  $('squad-hud').textContent=`SQUAD ${data.count+1}/4`;
}catch(error){$('squad-hud').textContent='SQUAD RECONNECTING';console.debug('Lobby sync:',error.message);}}
async function copyLobbyLink(){if(!lobbyId)return;try{const info=await(await fetch('/api/lan-address')).json(),url=new URL(location.href);if(['localhost','127.0.0.1'].includes(url.hostname)){url.hostname=info.address;url.port=info.port;}url.searchParams.set('lobby',lobbyId);await navigator.clipboard.writeText(url.href);$('lobby-message').textContent='INVITE COPIED · SEND TO YOUR SQUAD';}catch{$('lobby-message').textContent=`SHARE THIS ADDRESS WITH CODE ${lobbyId}`;}}
setInterval(()=>{if(lobbyId)syncLobby();},900);
function setOverlay(id, active) { $(id).classList.toggle('active',active); }
function requestGamePointerLock(){try{const result=document.body.requestPointerLock?.();if(result&&typeof result.catch==='function')result.catch(()=>{});}catch{}}
function showToast(text) { $('toast').textContent=text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1500); }
function centerToast(title, sub='') { $('center-toast').innerHTML=`${title}${sub?`<span>${sub}</span>`:''}`; $('center-toast').classList.add('show'); clearTimeout(centerTimer); centerTimer=setTimeout(()=>$('center-toast').classList.remove('show'),1800); }
function hud() {
  $('round-number').textContent=String(player.round).padStart(2,'0'); $('threat-count').textContent=String(enemies.length+roundRemaining);
  $('kill-count').textContent=player.kills; $('best-score').textContent=localStorage.getItem('dgw-best')||0;
  $('health-number').textContent=Math.ceil(player.health); $('health-max').textContent=player.maxHealth; $('health-fill').style.width=`${100*player.health/player.maxHealth}%`;
  const spec=weaponSpecs[player.weapon]; $('weapon-name').textContent=spec.label;
  $('ammo-current').textContent=player.ammo[player.weapon]; $('ammo-reserve').textContent=player.reserve[player.weapon]; $('points').textContent=player.points.toLocaleString();
}
function beginRound() {
  if (mode==='gameover') resetGame();
  mode='playing'; setOverlay('shop-screen',false); setOverlay('intro-screen',false); setOverlay('title-screen',false); setOverlay('pause-screen',false); $('hud').style.display='block';
  player.round++; roundRemaining=8+player.round*2; spawnTimer=.2;waveSpawned=0;centerToast(`ROUND ${String(player.round).padStart(2,'0')}`, player.round%5===0?'THE REAPER IS HUNGRY':'THE DEAD ARE RISING');
  requestGamePointerLock(); hud();
}
function startGame() { if (mode==='menu') { mode='playing'; beginRound(); } else if (mode==='shop') beginRound(); }
function pauseGame() { if (mode!=='playing') return; mode='paused'; setOverlay('pause-screen',true); document.exitPointerLock?.(); }
function resumeGame() { if (mode!=='paused') return; mode='playing'; setOverlay('pause-screen',false); requestGamePointerLock(); }
function gameOver() {
  mode='gameover'; document.exitPointerLock?.(); $('hud').style.display='none';
  $('final-round').textContent=player.round; $('final-kills').textContent=player.kills; $('final-points').textContent=player.points.toLocaleString();
  const best=Math.max(Number(localStorage.getItem('dgw-best')||0),player.points); localStorage.setItem('dgw-best',best); setOverlay('gameover-screen',true);
}
function resetGame() {
  for (const e of enemies) removeEnemy(e); enemies.length=0;
  for(const d of drops)scene.remove(d.group);drops.length=0;
  for(const avatar of remotePlayers.values())scene.remove(avatar.group);remotePlayers.clear();
  for(const c of supplyCaches){c.opened=false;c.mesh.visible=true;c.beacon.visible=true;}
  for(const b of barricades){b.health=2;for(let i=0;i<b.boards.length;i++)b.boards[i].visible=i<2;}
  player.health=100;player.maxHealth=100;player.points=500;player.kills=0;player.round=0;player.damageBonus=0;damageCooldown=0;
  player.weapon='pistol';player.ammo={pistol:12,shotgun:0,smg:0};player.reserve={pistol:96,shotgun:0,smg:0};
  camera.position.set(0,1.68,-18);yaw=Math.PI/2;pitch=0;camera.rotation.set(0,yaw,0);setOverlay('gameover-screen',false);setOverlay('title-screen',false);hud();
}
function addEnemy(boss=false,first=false) {
  let position=null;
  if(first){const x=camera.position.x-Math.sin(yaw)*18,z=camera.position.z-Math.cos(yaw)*18;if(Math.abs(x)<69&&Math.abs(z)<69&&!obstacles.some(b=>x>b.min.x-.8&&x<b.max.x+.8&&z>b.min.z-.8&&z<b.max.z+.8))position=[x,z];}
  for(let attempt=0;attempt<24&&!position;attempt++){
    const angle=Math.random()*Math.PI*2,radius=random(15,25),x=camera.position.x+Math.cos(angle)*radius,z=camera.position.z+Math.sin(angle)*radius;
    const roadX=Math.abs(x-Math.round(x/18)*18)<7.3,roadZ=Math.abs(z-Math.round(z/18)*18)<7.3;
    if((roadX||roadZ)&&Math.abs(x)<69&&Math.abs(z)<69&&!obstacles.some(b=>x>b.min.x-.8&&x<b.max.x+.8&&z>b.min.z-.8&&z<b.max.z+.8))position=[x,z];
  }
  if(!position)position=[random(-68,68),random(-68,68)];
  const profile=boss?{type:'reaper',hp:620+player.round*28,speed:2.35,damage:27,cooldown:.9,walk:loaded.reaper?.animations?.length?[loaded.reaper.animations[0].name]:[],hit:[],death:[]}:first?enemyRoster[2]:enemyRoster[Math.floor(Math.random()*Math.min(enemyRoster.length,player.round<2?2:player.round<4?3:4))];
  let root;
  if (enemyTemplates[profile.type]) root=cloneSkinned(enemyTemplates[profile.type]);
  else { root=new THREE.Group(); const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.95,4,8),new THREE.MeshStandardMaterial({color:boss?0x62404e:0x65775a,roughness:.9}));body.position.y=.9;root.add(body); }
  const scale=boss?1.38:random(.95,1.06);root.scale.multiplyScalar(scale);
  root.position.set(position[0],0,position[1]);root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});scene.add(root);
  const mixer=enemyClips.length?new THREE.AnimationMixer(root):null,actions={};
  if(mixer){for(const [key,names] of Object.entries({walk:profile.walk,hit:profile.hit,death:profile.death,attack:['Throw','Use_Item','Interact']})){const clip=enemyClip(...names);if(clip)actions[key]=mixer.clipAction(clip);}mixers.push(mixer);}
  const enemy={root,mixer,actions,animName:'',profile,hp:boss?profile.hp:profile.hp+player.round*6,maxHp:profile.hp,speed:boss?profile.speed:profile.speed+Math.min(player.round*.045,.65),attack:random(.2,1),boss,phase:random(0,6),dying:false,dyingTime:0,hitTime:0};
  enemies.push(enemy);setEnemyAnimation(enemy,'walk');
}
function setEnemyAnimation(enemy,name){const next=enemy.actions?.[name];if(!next||enemy.animName===name)return;const current=enemy.actions[enemy.animName];next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();if(current)current.crossFadeTo(next,.16,true);enemy.animName=name;}
function killEnemy(enemy){if(!enemy||enemy.dying)return;enemy.dying=true;enemy.dyingTime=1.15;enemy.root.traverse(o=>{if(o.isMesh)o.visible=true;});setEnemyAnimation(enemy,'death');dropFor(enemy);player.kills++;player.points+=enemy.boss?800:100;play(enemy.boss?'boom':'hit');}
function removeEnemy(enemy) { scene.remove(enemy.root);if(enemy.mixer){enemy.mixer.stopAllAction();mixers.splice(mixers.indexOf(enemy.mixer),1);} }
function finishRound() {
  mode='shop'; play('clear'); $('shop-kicker').textContent=`ROUND ${String(player.round).padStart(2,'0')} CLEAR // BREATHER`;
  $('shop-title').textContent='PATCH UP & LOAD OUT'; $('shop-points').textContent=player.points.toLocaleString();
  const cards=[
    ['✚','FIELD DRESSING','Restore 45 health.','350','heal'],
    ['▣','AMMO CRATE','Refill your equipped weapon.','250','ammo'],
    ['✦','HOT LOADS','Permanent +8 damage.','650','damage'],
    ['✿','SAKURA SHOTGUN','Heavy close-range burst.','900','shotgun'],
    ['❀','HANAMI SMG','Fast automatic fire.','1,100','smg'],
  ];
  $('shop-grid').innerHTML=cards.map(([sym,name,desc,cost,key])=>`<button class="shop-card" data-buy="${key}"><span class="symbol">${sym}</span><strong>${name}</strong><span>${desc}</span><em>${cost} PTS</em></button>`).join('');
  $('shop-grid').querySelectorAll('[data-buy]').forEach(btn=>btn.addEventListener('click',()=>buy(btn.dataset.buy)));
  setOverlay('shop-screen',true);document.exitPointerLock?.();hud();
}
function buy(key) {
  const prices={heal:350,ammo:250,damage:650,shotgun:900,smg:1100};
  if (player.points<prices[key]) { showToast('NOT ENOUGH SALVAGE'); return; }
  if (key==='heal'&&player.health>=player.maxHealth) { showToast('VITALS ALREADY FULL'); return; }
  player.points-=prices[key];
  if(key==='heal') player.health=Math.min(player.maxHealth,player.health+45);
  if(key==='ammo') { const w=player.weapon;player.ammo[w]=weaponSpecs[w].mag;player.reserve[w]+=Math.ceil(weaponSpecs[w].reserve*.6); }
  if(key==='damage') player.damageBonus+=8;
  if(key==='shotgun'||key==='smg') { player.weapon=key;player.ammo[key]=weaponSpecs[key].mag;player.reserve[key]=weaponSpecs[key].reserve;equip(key); }
  $('shop-points').textContent=player.points.toLocaleString();hud();showToast('SUPPLY SECURED');
}
function equip(name) { for (const [key,m] of Object.entries(weaponModels)) m.visible=key===name; player.weapon=name; }
function reload() {
  if(mode!=='playing'||reloading)return; const w=player.weapon,s=weaponSpecs[w];
  if(player.ammo[w]>=s.mag||player.reserve[w]<=0){play('dry');return;}
  reloading=true;play('reload');setTimeout(()=>{if(mode==='gameover')return;const n=Math.min(s.mag-player.ammo[w],player.reserve[w]);player.ammo[w]+=n;player.reserve[w]-=n;reloading=false;hud();},s.reload*1000);
}
function shoot() {
  if(mode!=='playing'||(document.pointerLockElement!==document.body&&!gamepadFire)||performance.now()<fireAt||reloading)return;
  const w=player.weapon,s=weaponSpecs[w];fireAt=performance.now()+s.delay*1000;
  if(player.ammo[w]<=0){play('dry');reload();return;}
  player.ammo[w]--;hud();play('fire');
  const origin=camera.getWorldPosition(new THREE.Vector3());
  const direction=camera.getWorldDirection(new THREE.Vector3());
  const muzzle=new THREE.Vector3(); camera.localToWorld(muzzle.set(.28,-.22,-.68));
  let hitAny=false, killed=false;
  for(let pellet=0;pellet<s.pellets;pellet++) {
    const dir=direction.clone().add(new THREE.Vector3((Math.random()-.5)*s.spread,(Math.random()-.5)*s.spread,0)).normalize();
    raycaster.set(origin,dir);raycaster.far=55;
    const hit=raycaster.intersectObjects(enemies.filter(e=>!e.dying).flatMap(e=>e.root.children),true)[0];
    let target=null, point=origin.clone().addScaledVector(dir,38);
    if(hit){target=enemies.find(e=>{let n=hit.object;while(n&&n!==e.root)n=n.parent;return n===e.root;});point.copy(hit.point);}
    if(!target) {
      // Friendly forgiving center aim: catches a model even if its imported hitboxes are sparse.
      let best=2.1;
      for(const e of enemies){if(e.dying)continue;const c=e.root.position.clone().add(new THREE.Vector3(0,e.boss?1.8:1.15,0));const to=c.clone().sub(origin);const along=to.dot(dir);if(along<0||along>45)continue;const off=to.addScaledVector(dir,-along).length();if(off<best){best=off;target=e;point.copy(c);}}
    }
    const lineGeo=new THREE.BufferGeometry().setFromPoints([muzzle,point]);const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0xffd78a,transparent:true,opacity:.9}));scene.add(line);tracers.push({object:line,life:.075});
    if(target){
      hitAny=true;const head=Math.abs(point.y-(target.root.position.y+(target.boss?2.9:1.78)))<.32;
      const dmg=s.damage+player.damageBonus;target.hp-=dmg*(head?2:1);target.root.traverse(o=>{if(o.isMesh&&o.material?.color){o.material.color.set(0xbce8a6);setTimeout(()=>{if(o.material?.color)o.material.color.set(0xffffff);},65);}});
      if(target.hp<=0){killEnemy(target);killed=true;}
      else {target.hitTime=.22;setEnemyAnimation(target,'hit');}
    }
  }
  if(hitAny){$('crosshair').classList.add(killed?'kill':'hit');$('hit-label').textContent=killed?'PURGED':'HIT';$('hit-label').classList.add('show');setTimeout(()=>{$('crosshair').classList.remove('hit','kill');$('hit-label').classList.remove('show');},130);}
}
function melee() {
  if(mode!=='playing'||performance.now()<meleeAt)return;meleeAt=performance.now()+650;
  const dir=camera.getWorldDirection(new THREE.Vector3());let nearest=null,dist=2.8;
  for(const e of enemies){if(e.dying)continue;const to=e.root.position.clone().add(new THREE.Vector3(0,1,0)).sub(camera.position);const d=to.length();if(d<dist&&dir.dot(to.normalize())>.25){dist=d;nearest=e;}}
  if(nearest){nearest.hp-=65+player.damageBonus;player.points+=10;play('hit');if(nearest.hp<=0)killEnemy(nearest);else{nearest.hitTime=.25;setEnemyAnimation(nearest,'hit');}centerToast('MELEE');hud();}
}
function dropFor(enemy) {
  if(drops.length>=18){const oldest=drops.shift();scene.remove(oldest.group);oldest.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
  const roll=Math.random(),kind=roll<.58?'scrap':roll<.84?'ammo':roll<.94?'medkit':'charge';
  const color={scrap:0xffc85f,ammo:0x70d8ff,medkit:0x67ff91,charge:0xe47dff}[kind];
  const g=new THREE.Group();const gem=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.45,metalness:.15,roughness:.25}));gem.position.y=.65;g.add(gem);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.48,.035,6,18),new THREE.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;ring.position.y=.12;g.add(ring);
  const lamp=new THREE.PointLight(color,1.4,5,2);lamp.position.y=.8;g.add(lamp);g.position.set(enemy.root.position.x,0,enemy.root.position.z);scene.add(g);
  drops.push({kind,group:g,life:45,phase:random(0,6)});
}
function collect(drop) {
  if(drop.kind==='scrap'){player.points+=125;showToast('+125 SALVAGE');}
  if(drop.kind==='ammo'){for(const w of Object.keys(weaponSpecs))player.reserve[w]+=Math.ceil(weaponSpecs[w].mag*1.2);showToast('AMMO CACHE');}
  if(drop.kind==='medkit'){player.health=Math.min(player.maxHealth,player.health+30);showToast('+30 VITALS');}
  if(drop.kind==='charge'){player.points+=75;player.damageBonus+=2;showToast('HOT CHARGE · +2 DAMAGE');}
  scene.remove(drop.group);drop.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});drops.splice(drops.indexOf(drop),1);hud();
}
function nearbyInteraction() {
  let best=null,distance=Infinity;
  for(const c of supplyCaches)if(!c.opened){const d=c.position.distanceTo(camera.position);if(d<distance){distance=d;best={kind:'cache',value:c};}}
  for(const b of barricades){const d=b.position.distanceTo(camera.position);if(d<distance){distance=d;best={kind:'barricade',value:b};}}
  if(best&&distance<3.1){
    if(best.kind==='cache'){const c=best.value;c.opened=true;c.mesh.visible=false;c.beacon.visible=false;player.points+=225;player.health=Math.min(player.maxHealth,player.health+20);player.reserve[player.weapon]+=weaponSpecs[player.weapon].mag*2;play('clear');showToast('SCAVENGE CACHE · +225 SALVAGE');hud();return true;}
    const b=best.value;if(b.health>=b.maxHealth){showToast('BARRICADE SECURE');return true;}
    const cost=45;if(player.points<cost){showToast('45 SALVAGE TO REBUILD');return true;}
    player.points-=cost;b.health++;b.boards[b.health-1].visible=true;play('clear');showToast(`BARRICADE REBUILT · ${b.health}/${b.maxHealth}`);hud();return true;
  }
  return false;
}
function interactOrMelee(){if(mode!=='playing')return;if(!nearbyInteraction())melee();}
function interactionPrompt(){
  const el=$('interaction-hint');if(mode!=='playing'){el.classList.remove('show');return;}
  let best=null,distance=Infinity;
  for(const c of supplyCaches)if(!c.opened){const d=c.position.distanceTo(camera.position);if(d<distance){distance=d;best={text:'<b>E / B</b> · OPEN SCAVENGE CACHE',d};}}
  for(const b of barricades){const d=b.position.distanceTo(camera.position);if(d<distance){distance=d;best={text:b.health<b.maxHealth?'<b>E / B</b> · REBUILD BOARD · 45 SALVAGE':'WINDOW BOARDED · KEEP IT THAT WAY',d};}}
  const drop=drops.find(d=>d.group.position.distanceTo(camera.position)<2.1);
  if(drop){best={text:'WALK OVER · COLLECT FIELD DROP',d:0};}
  if(best&&best.d<3.5){el.innerHTML=best.text;el.classList.add('show');}else el.classList.remove('show');
}
function takeDamage(amount) {
  if(damageCooldown>0)return;damageCooldown=.68;
  player.health=Math.max(0,player.health-amount);$('vignette').classList.add('damaged');setTimeout(()=>$('vignette').classList.remove('damaged'),150);hud();
  if(player.health<=0)gameOver();
}
function moveWithCollision(position,delta,radius){
  const tryAxis=(axis,value)=>{const x=axis==='x'?value:position.x,z=axis==='z'?value:position.z;if(Math.abs(x)>70||Math.abs(z)>70)return false;
    return !obstacles.some(b=>x>b.min.x-radius&&x<b.max.x+radius&&z>b.min.z-radius&&z<b.max.z+radius);};
  const nx=position.x+delta.x;if(tryAxis('x',nx))position.x=nx;
  const nz=position.z+delta.z;if(tryAxis('z',nz))position.z=nz;
}
function update(dt,time) {
  for(const avatar of remotePlayers.values())avatar.group.position.lerp(avatar.target,Math.min(1,dt*9));
  const pad=pollGamepad(dt);
  damageCooldown=Math.max(0,damageCooldown-dt);
  if(mode==='playing') {
    const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    const move=new THREE.Vector3(); if(keys.has('KeyW'))move.add(forward);if(keys.has('KeyS'))move.sub(forward);if(keys.has('KeyD'))move.add(right);if(keys.has('KeyA'))move.sub(right);
    move.addScaledVector(right,pad.moveX).addScaledVector(forward,-pad.moveY);
    if(move.lengthSq()>0){move.normalize().multiplyScalar(player.speed*((keys.has('ShiftLeft')||pad.sprint)?1.45:1)*dt);moveWithCollision(camera.position,move,.48);}
    if((keys.has('Space')||pad.jump)&&canJump){velocityY=5.3;canJump=false;} velocityY-=14*dt;camera.position.y+=velocityY*dt;
    if(camera.position.y<1.68){camera.position.y=1.68;velocityY=0;canJump=true;}
    camera.position.x=THREE.MathUtils.clamp(camera.position.x,-70,70);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-70,70);
    if(roundRemaining>0&&enemies.filter(e=>!e.dying).length<MAX_ALIVE_ENEMIES){spawnTimer-=dt;if(spawnTimer<=0){addEnemy(player.round%5===0&&roundRemaining===1,waveSpawned===0);waveSpawned++;roundRemaining--;spawnTimer=Math.max(.42,1.0-player.round*.025);hud();}}
    for(let index=enemies.length-1;index>=0;index--) {
      const e=enemies[index];
      if(e.dying){e.dyingTime-=dt;if(e.dyingTime<=0){removeEnemy(e);enemies.splice(index,1);}continue;}
      const dx=camera.position.x-e.root.position.x,dz=camera.position.z-e.root.position.z,d=Math.hypot(dx,dz);
      e.phase+=dt*5;e.root.rotation.y=Math.atan2(dx,dz);e.hitTime=Math.max(0,e.hitTime-dt);if(e.hitTime===0&&e.animName==='hit')setEnemyAnimation(e,'walk');
      const cover=barricades.find(b=>b.health>0&&b.position.distanceTo(e.root.position)<1.8);
      if(cover){e.attack-=dt;if(e.attack<=0){e.attack=1.1;cover.health=Math.max(0,cover.health-1);if(cover.boards[cover.health])cover.boards[cover.health].visible=false;}}
      else if(e.profile.ranged&&d<15&&d>4){e.attack-=dt;if(e.attack<=0){e.attack=e.profile.cooldown;takeDamage(e.profile.damage);const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([e.root.position.clone().add(new THREE.Vector3(0,1.4,0)),camera.position.clone()]),new THREE.LineBasicMaterial({color:0xff375f,transparent:true,opacity:.9}));scene.add(beam);tracers.push({object:beam,life:.14});}}
      else if(d>1.55){const speed=e.speed*(d<6?1.18:1),step=new THREE.Vector3(dx/d*speed*dt,0,dz/d*speed*dt);moveWithCollision(e.root.position,step,.55);}
      else{e.attack-=dt;if(e.attack<=0){e.attack=e.profile.cooldown;takeDamage(e.profile.damage);}}
      e.root.position.y=Math.max(0,Math.sin(e.phase)*.025);
    }
    if(roundRemaining===0&&enemies.length===0)finishRound();
    if(weaponModels[player.weapon]){weaponModels[player.weapon].position.y=-.27+Math.sin(time*11)*.007;weaponModels[player.weapon].rotation.x=Math.sin(time*11)*.015;}
  }
  for(const d of [...drops]){d.life-=dt;d.phase+=dt*2.5;d.group.position.y=Math.sin(d.phase)*.08;d.group.rotation.y+=dt*.7;const dist=d.group.position.distanceTo(camera.position);if(dist<1.65){collect(d);}else if(d.life<=0){scene.remove(d.group);drops.splice(drops.indexOf(d),1);}}
  interactionPrompt();
  for(let i=tracers.length-1;i>=0;i--){tracers[i].life-=dt;if(tracers[i].life<=0){scene.remove(tracers[i].object);tracers[i].object.geometry.dispose();tracers[i].object.material.dispose();tracers.splice(i,1);}}
  for(const light of streetLights)light.intensity=2.8+Math.sin(time*2+light.position.x)*.38;
}
function animate() {
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.045),t=clock.elapsedTime;update(dt,t);for(const mixer of mixers)mixer.update(dt);
  renderer.render(scene,camera);
  if(kasumi && $('title-screen').classList.contains('active')) { kasumi.rotation.y=Math.sin(t*.35)*.18;previewRenderer.render(previewScene,previewCamera); }
}
animate();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);fitPreview();});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==document.body&&mode==='playing')pauseGame();});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement!==document.body||mode!=='playing')return;yaw-=e.movementX*.0022;pitch-=e.movementY*.002;pitch=THREE.MathUtils.clamp(pitch,-1.28,1.28);camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);});
document.addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='Space')e.preventDefault();if(e.repeat)return;if(e.code==='KeyR')reload();if(e.code==='KeyE')interactOrMelee();if(e.code==='Escape'&&mode==='playing')pauseGame();if(e.code==='Digit1')equip('pistol');if(e.code==='Digit2'&&player.ammo.shotgun>0)equip('shotgun');if(e.code==='Digit3'&&player.ammo.smg>0)equip('smg');});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('mousedown',e=>{if(e.button!==0)return;if(mode==='playing'&&document.pointerLockElement!==document.body){requestGamePointerLock();return;}shoot();});
$('intro-continue').addEventListener('click',()=>{setOverlay('intro-screen',false);setOverlay('title-screen',true);setMusic(true);});
$('host-lobby-button').addEventListener('click',createLobby);
$('copy-lobby-link').addEventListener('click',copyLobbyLink);
$('music-toggle').addEventListener('click',()=>setMusic(!musicOn));
$('play-button').addEventListener('click',()=>{startSpookyMusic();setOverlay('intro-screen',false);setOverlay('title-screen',false);beginRound();});
$('continue-button').addEventListener('click',beginRound);$('resume-button').addEventListener('click',resumeGame);
$('restart-button').addEventListener('click',()=>{resetGame();beginRound();});$('retry-button').addEventListener('click',()=>{resetGame();beginRound();});
setLoad(1,'CITY GRID READY');$('loading').classList.remove('active');setOverlay('title-screen',false);setOverlay('intro-screen',true);hud();if(lobbyId)joinLobby(lobbyId);
