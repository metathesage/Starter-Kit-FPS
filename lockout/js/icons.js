// One icon language: 24px grid, 1.6 stroke, round caps. decorate() prefixes labelled controls with a matching glyph;
// a MutationObserver keeps freshly built screens decorated without touching each builder.
const P = {
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', sliders: 'M4 6h9M17 6h3M4 12h4M12 12h8M4 18h11M19 18h1M14 4v4M8 10v4M16 16v4',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z', chevrons: 'M6 9l6-5 6 5M6 14l6-5 6 5M6 19l6-5 6 5',
  pad: 'M7 8h10a4 4 0 0 1 4 4v2a3 3 0 0 1-5 2l-1-1H9l-1 1a3 3 0 0 1-5-2v-2a4 4 0 0 1 4-4zM8 10v4M6 12h4M16 11.5v.01M18 13.5v.01',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  disk: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 1v4M12 19v4M1 12h4M19 12h4',
  play: 'M7 4l13 8-13 8z', refresh: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5', door: 'M5 3h9v18H5zM14 6l5 2v8l-5 2M10.5 12v.01',
  back: 'M19 12H5M11 6l-6 6 6 6', copy: 'M8 8h11v12H8zM5 16V4h11', share: 'M12 15V3M7 8l5-5 5 5M5 13v8h14v-8',
  server: 'M4 5h16v6H4zM4 13h16v6H4zM8 8v.01M8 16v.01', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-5 4-8 8-8s8 3 8 8', ring: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 2v1.5M12 20.5V22',
  brush: 'M20 4 10 14M10 14c-3 0-5 2-5 6 4 0 6-2 6-5z', hex: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 9l3 1.7v3.6L12 16l-3-1.7v-3.6z',
  text: 'M5 5h14M12 5v14M8 19h8', gun: 'M2 12h5l2-3h8l1 2h4v3h-7l-1 5H9l-1-5H2z', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14', flag: 'M5 21V4M5 4h11l-2 4 2 4H5', tag: 'M4 4h8l8 8-8 8-8-8zM8 8v.01',
  gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-6', trophy: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  volume: 'M4 9v6h4l5 4V5L8 9zM17 9c1.5 1.5 1.5 4.5 0 6', sparkle: 'M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z',
  lotus: 'M12 20c-4-2-7-5-7-9 3 0 5 1 7 3 2-2 4-3 7-3 0 4-3 7-7 9zM12 14c-2-3-2-6 0-10 2 4 2 7 0 10z', lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2', arrows: 'M4 12h16M14 6l6 6-6 6M10 6l-6 6 6 6',
  skull: 'M12 3a7 7 0 0 0-7 7c0 3 1 4 3 5v4h8v-4c2-1 3-2 3-5a7 7 0 0 0-7-7zM9 11v.01M15 11v.01M12 14v2',
};
// first matching rule wins; text is compared upper-case
const RULES = [
  [/SANCTUM|GARDEN|HUB/, 'lotus'], [/ONLINE|HOST|LOBBY/, 'globe'], [/QUICK PLAY|START|DROP IN|REMATCH|PLAY\b/, 'bolt'], [/CUSTOM|LOADOUT/, 'sliders'], [/ONLINE|HOST|LOBBY/, 'globe'],
  [/ARMORY|ARMOR/, 'shield'], [/SERVICE|RECORD|RANK/, 'chevrons'], [/CONTROLS/, 'pad'], [/SETTINGS|OPTIONS/, 'gear'], [/SAVE|BACKUP|EXPORT|IMPORT/, 'disk'],
  [/MISSION/, 'target'], [/RESUME|CONTINUE/, 'play'], [/RESTART|RETRY|ROLL/, 'refresh'], [/QUIT|LEAVE|EXIT|MAIN MENU/, 'door'], [/^BACK|RETURN/, 'back'],
  [/COPY/, 'copy'], [/SHARE/, 'share'], [/JOIN|CODE/, 'link'],
  [/OPERATORS?$|^OPERATORS/, 'user'], [/HALOS?/, 'ring'], [/SKINS?/, 'brush'], [/EMBLEMS?/, 'hex'], [/TITLES?/, 'text'], [/WEAPONS?/, 'gun'], [/POWER/, 'bolt'], [/^MAPS?$|^MAP$/, 'map'], [/MODES?$/, 'grid'],
  [/GAME MODE/, 'target'], [/VARIANT/, 'layers'], [/^MAP/, 'map'], [/TEAM|SIDE/, 'flag'], [/CALLSIGN|NAME/, 'tag'], [/DIFFICULTY/, 'gauge'], [/SCORE|HOLD TIME|CAPTURES/, 'trophy'],
  [/SENSITIV|INVERT|LOOK/, 'arrows'], [/QUALITY|BLOOM|GRADE|SHADOW|FOV|RETICLE/, 'eye'], [/VOLUME|MUSIC|SOUND|ANNOUNC|MUTE/, 'volume'], [/BRIGHT/, 'sun'],
];
const svg = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[k]}"/></svg>`;
export const icon = svg;
const pick = (t) => { t = t.trim().toUpperCase(); for (const [re, k] of RULES) if (re.test(t)) return k; return 'sparkle'; };

export function decorate(root = document) {
  const add = (el, text) => { if (el.dataset.ico || !text) return; el.dataset.ico = '1'; const n = el.querySelector(':scope > .n'); const html = svg(pick(text)); if (n) n.insertAdjacentHTML('afterend', html); else el.insertAdjacentHTML('afterbegin', html); };
  root.querySelectorAll('.menu-item').forEach((el) => add(el, [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('') || el.textContent.replace(/^\d+/, '')));
  root.querySelectorAll('.btn').forEach((el) => add(el, (el.querySelector('span') || el).textContent));
  root.querySelectorAll('.at').forEach((el) => add(el, el.textContent));
  root.querySelectorAll('.opt .lbl').forEach((el) => add(el, el.textContent));
  root.querySelectorAll('.chip').forEach((el) => { if (!el.dataset.ico) el.dataset.ico = '1'; });
}

export function watchIcons() {
  let q = 0; const run = () => { q = 0; decorate(document); };
  new MutationObserver(() => { if (!q) q = requestAnimationFrame(run); }).observe(document.body, { childList: true, subtree: true });
  decorate(document);
}
