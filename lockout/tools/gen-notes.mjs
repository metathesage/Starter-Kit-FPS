// node tools/gen-notes.mjs : regenerates docs/PATCH_NOTES.md from js/patchnotes.js
import { PATCHES } from '../js/patchnotes.js';
import { writeFileSync } from 'node:fs';
let o = '# NEW LIGHT patch notes\n\nGenerated from `js/patchnotes.js` (edit that file, then run `node tools/gen-notes.mjs`). Newest first.\n\n';
for (const p of PATCHES) {
  o += `## ${p.v} · ${p.name} · ${p.date}\n\n_${p.blurb}_\n\n`;
  for (const [k, items] of p.sections) { o += `**${k}**\n\n` + items.map((t) => `- ${t}`).join('\n') + '\n\n'; }
}
writeFileSync(new URL('../docs/PATCH_NOTES.md', import.meta.url), o); console.log('wrote docs/PATCH_NOTES.md', PATCHES.length, 'releases');
