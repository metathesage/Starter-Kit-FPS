#!/usr/bin/env node
// Boot guard: stuck-loading-screen regression test.
// 1. main.js parses (node --check). 2. No top-level `let/const` is first read
//    before its declaration line (TDZ kills the module before boot finishes).
// 3. Every $('id') used exists in index.html.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const js = readFileSync(join(root, 'src/main.js'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
let fail = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'} ${msg}`); if (!c) fail++; };
try {
  execFileSync(process.execPath, ['--check', join(root, 'src/main.js')], { stdio: 'pipe' });
  ok(true, 'main.js parses');
} catch { ok(false, 'main.js parses'); }
// TDZ screen with call order: a top-level `let/const` read is fatal only if it can
// execute before the declaration line runs — directly at top level, or inside a
// function invoked (transitively) by a top-level call above that line.
function stripStrings(src){
  return src.replace(/'(?:[^'\\\n]|\\.)*'/g, "''").replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
const code = stripStrings(js);
const rawLines = js.split('\n');
const codeLines = code.split('\n');
// depth of each line (brace depth at line start)
const depths = [];
let depth = 0;
for (const ln of codeLines){
  depths.push(depth);
  for (const ch of ln){
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
  }
}
const decl = new Map();
codeLines.forEach((ln, i) => {
  if (depths[i] !== 0) return;
  const m = ln.match(/^(?:let|const|var)\s+([A-Za-z_$][\w$]*)/);
  if (m && !decl.has(m[1])) decl.set(m[1], i);
});
// top-level function bodies (name -> {start,end} line range, end exclusive)
const fns = new Map();
for (let i = 0; i < codeLines.length; i++){
  if (depths[i] !== 0) continue;
  const m = codeLines[i].match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (!m) continue;
  let d = 0, j = i;
  for (; j < codeLines.length; j++){
    for (const ch of codeLines[j]){ if (ch === '{') d++; else if (ch === '}') d--; }
    if (d === 0 && j > i) break;
  }
  fns.set(m[1], { start: i, end: j + 1 });
}
const KEYWORDS = new Set(['if','for','while','switch','catch','return','typeof','await','new','function','else','do','in','of','instanceof','void','delete','yield','class','extends','import','export','super','this']);
// ranges that do NOT run at load: top-level function bodies + deferred callbacks
function bodyEnd(from){
  let d = 0, started = false;
  for (let j = from; j < codeLines.length; j++){
    for (const ch of codeLines[j]){ if (ch === '{') { d++; started = true; } else if (ch === '}') d--; }
    if (started && d === 0) return j + 1;
  }
  return codeLines.length;
}
const deferred = [];
for (const [name, r] of fns) deferred.push([r.start, r.end]);
for (let i = 0; i < codeLines.length; i++){
  if (depths[i] !== 0) continue;
  if (/(addEventListener|setTimeout|setInterval)\s*\(.*=>/.test(codeLines[i])) deferred.push([i, bodyEnd(i)]);
}
const inDeferred = (i) => deferred.some(([a, b]) => i >= a && i < b);
function callsIn(a, b, execOnly){
  const out = new Set();
  for (let i = a; i < b && i < codeLines.length; i++){
    if (execOnly && inDeferred(i)) continue;
    if (execOnly && /(addEventListener|setTimeout|setInterval|requestAnimationFrame)\s*\(/.test(codeLines[i])) continue;
    if (execOnly && depths[i] === 0 && /^(?:let|const|var|import|function)\b/.test(codeLines[i].trim())) continue;
    for (const m of codeLines[i].matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)){
      if (!KEYWORDS.has(m[1]) && fns.has(m[1])) out.add(m[1]);
    }
  }
  return out;
}
const skip = new Set(['THREE', 'GLTFLoader', 'cloneSkinned']);
const tdz = [];
for (const [name, dline] of decl){
  if (skip.has(name)) continue;
  const use = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`);
  let bad = null;
  for (let i = 0; i < dline && bad === null; i++){
    if (depths[i] !== 0) continue;
    const ln = codeLines[i].trim();
    if (!ln || ln.startsWith('//') || ln.startsWith('import ')) continue;
    if (/^(?:let|const|var)\s+[A-Za-z_$]/.test(ln) && ln.includes(name) && !ln.startsWith(`let ${name}`) && !ln.startsWith(`const ${name}`) && !ln.startsWith(`var ${name}`)){
      if (use.test(ln)) bad = `top-level read line ${i + 1}`;
      continue;
    }
    if (/^(?:let|const|var)\s/.test(ln)) continue;
    if (use.test(ln)) bad = `top-level read line ${i + 1}`;
  }
  // transitive top-level calls before the declaration line
  if (bad === null){
    const invoked = new Set();
    const queue = [...callsIn(0, dline, true)];
    while (queue.length){
      const f = queue.pop();
      if (invoked.has(f)) continue;
      invoked.add(f);
      const r = fns.get(f);
      if (r) for (const c of callsIn(r.start + 1, r.end, false)) queue.push(c);
    }
    for (const f of invoked){
      const r = fns.get(f);
      for (let i = r.start + 1; i < r.end; i++){
        if (use.test(codeLines[i])){ bad = `via ${f}() called before line ${dline + 1} (read line ${i + 1})`; break; }
      }
      if (bad) break;
    }
  }
  if (bad) tdz.push(`${name}: ${bad}, declared line ${dline + 1}`);
}
ok(tdz.length === 0, `no TDZ executions before declaration${tdz.length ? ' — ' + tdz.join('; ') : ''}`);
const used = [...new Set([...js.matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]))];
const have = new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
const missing = used.filter(u => !have.has(u));
ok(missing.length === 0, `all ${used.length} DOM ids exist${missing.length ? ' — missing: ' + missing.join(',') : ''}`);
process.exit(fail ? 1 : 0);
