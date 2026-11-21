// Edit this block to point the site at real release files and pages.
const CONFIG = {
  version: '0.1.0',
  releaseDate: 'November 2026',
  email: 'hello@suffice.work',
  waitlistEndpoint: '', // POST { email } here. Leave empty to fall back to a mailto link.
  downloads: {
    'win-x64': '#',
    'win-arm': '#',
    'mac-arm': '#',
    'mac-intel': '#',
    'linux-appimage': '#',
    'linux-deb': '#',
  },
  install: { npm: 'npm install -g suffice' },
  links: { docs: '#', security: '#', privacy: '#', terms: '#', eula: '#', checksums: '#' },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isReal = (url) => url && url !== '#';

const onVisible = (el, fn, threshold = 0.2) => {
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { fn(el); io.disconnect(); } }, { threshold });
  io.observe(el);
};
// Tracks whether an element is on screen so looping animations can pause.
const watch = (el) => {
  const state = { on: false };
  new IntersectionObserver(([e]) => { state.on = e.isIntersecting; }, { threshold: 0.05 }).observe(el);
  state.wait = async (ms) => { await sleep(ms); while (!state.on || document.hidden) await sleep(200); };
  return state;
};

/* ---------- Pixel math ---------- */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const hash = (x, y) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const noise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.2;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const PALETTE = [
  '#0c151a', '#16303a', '#2f5559', '#0f2f47', '#164f73', '#1f7f9a', '#3cc0b0', '#cfeee6',
  '#2a2724', '#5a5347', '#8c8270', '#1e3616', '#3f6a24', '#6f9a30', '#a9c94a', '#e6dc7a',
  '#a48ee0', '#f0dc5a', '#dce6dc', '#f2c76e', '#c98a52', '#7a4e45', '#3a2c33',
].map(hex);
const nearest = (c) => {
  let best = PALETTE[0], bd = Infinity;
  for (const p of PALETTE) {
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
};

/* ---------- Scenes ---------- */
const grass = (u, v, n, fine, sunX) => {
  const sun = Math.max(0, 1 - Math.hypot(u - sunX, v) * 1.25);
  const blade = 0.5 + 0.5 * Math.sin(u * 90 - v * 55 + n * 12);
  let c = mix([30, 56, 22], [160, 194, 70], n * 0.85 + sun * 0.4 + (blade - 0.5) * 0.4);
  c = mix(c, [228, 216, 110], sun * 0.45);
  return c.map((x) => x * (0.78 + fine * 0.4));
};
const flower = (u, v) => (v > 0.4 && hash(u * 9973, v * 7919) > 0.986 ? (u < 0.45 ? [164, 142, 224] : [240, 220, 90]) : null);

const SCENES = {
  // Looking down at a coastline, like the in-app background.
  coast(u, v) {
    const n = fbm(u * 5, v * 5), n2 = fbm(u * 22 + 3, v * 22 + 7), fine = fbm(u * 60, v * 60);
    const d = v - (0.78 - 1.25 * u + (n - 0.5) * 0.28);
    if (d < -0.045) return { sea: true, c: mix([70, 204, 190], [16, 60, 96], -d / 0.6).map((x) => x * (0.8 + fine * 0.4)) };
    if (d < 0.07) return { c: mix([42, 39, 36], [150, 140, 116], n2 * 0.8 + fine * 0.5) };
    const f = flower(u, v);
    return f ? { c: f, fixed: true } : { c: grass(u, v, n, fine, 0.95) };
  },
  // A hill over the sea at dusk.
  hill(u, v) {
    const n = fbm(u * 4 + 9, v * 4), fine = fbm(u * 60 + 5, v * 60);
    const horizon = 0.42;
    const top = 0.6 + 0.13 * Math.sin(u * 3.2 + 1.2) + (n - 0.5) * 0.08;
    if (v < horizon) {
      if (v < 0.3 && hash(u * 4999, v * 3001) > 0.994) return { c: [220, 230, 220], fixed: true };
      let c = mix([12, 20, 26], [56, 96, 96], Math.pow(v / horizon, 1.6));
      const glow = Math.max(0, 1 - Math.hypot((u - 0.7) * 1.4, (v - 0.36) * 2.6) * 2.2);
      c = mix(c, [122, 78, 69], glow * 1.6);
      c = mix(c, [201, 138, 82], (glow - 0.3) * 2);
      return { c: mix(c, [244, 206, 120], (glow - 0.55) * 2.6) };
    }
    if (v < top) return { sea: true, c: mix([46, 140, 140], [16, 54, 80], (v - horizon) / 0.3).map((x) => x * (0.85 + fine * 0.3)) };
    const f = flower(u, v);
    return f ? { c: f, fixed: true } : { c: grass(u, v, n, fine, 0.7).map((x) => x * 0.9) };
  },
};

function setupScene(canvas) {
  const ctx = canvas.getContext('2d');
  const colorAt = SCENES[canvas.dataset.scene] || SCENES.coast;
  const PX = 4;
  let w = 0, h = 0, cells = [], frame = null, img = null, level = reduceMotion ? 1 : 16;

  const build = () => {
    w = Math.max(1, Math.ceil(canvas.clientWidth / PX));
    h = Math.max(1, Math.ceil(canvas.clientHeight / PX));
    canvas.width = w;
    canvas.height = h;
    img = ctx.createImageData(w, h);
    frame = new Uint8ClampedArray(w * h * 3);
    cells = [];
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        const cell = colorAt(x / w, y / h);
        cells.push(cell);
        const p = cell.fixed ? cell.c : nearest(cell.c.map((v) => v + (bayer(x, y) - 0.5) * 56));
        frame.set(p, i * 3);
      }
    }
  };
  const shimmer = (t) => {
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        const cell = cells[i];
        if (!cell.sea) continue;
        const s = Math.sin(x * 0.35 + y * 0.9 - t * 1.6) * 0.5 + Math.sin(x * 0.12 - y * 0.4 + t * 0.9) * 0.5;
        frame.set(nearest(cell.c.map((v) => v + s * 26 + (bayer(x, y) - 0.5) * 56)), i * 3);
      }
    }
  };
  const paint = () => {
    const d = img.data, b = level;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(h - 1, y - (y % b) + (b >> 1));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(w - 1, x - (x % b) + (b >> 1));
        const s = (sy * w + sx) * 3, o = (y * w + x) * 4;
        d[o] = frame[s]; d[o + 1] = frame[s + 1]; d[o + 2] = frame[s + 2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  build();
  paint();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); paint(); }, 150); });
  if (reduceMotion) return;

  const vis = watch(canvas);
  onVisible(canvas, async () => {
    for (const b of [16, 8, 4, 2, 1]) { level = b; paint(); await sleep(130); }
    const t0 = performance.now();
    for (;;) { await vis.wait(100); shimmer((performance.now() - t0) / 1000); paint(); }
  }, 0.25);
}

/* ---------- Pixel wordmark ---------- */
function setupWordmark() {
  const canvas = $('#wordmark');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const RAMP = ['#1f7f9a', '#3cc0b0', '#3f6a24', '#6f9a30', '#a9c94a', '#c8f05a'].map(hex);
  let mask = [], w = 0, h = 0;
  const build = () => {
    const font = '16px Silkscreen, monospace';
    ctx.font = font;
    w = Math.ceil(ctx.measureText('[suffice]').width) + 2;
    h = 18;
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.fillText('[suffice]', 1, 1);
    const a = ctx.getImageData(0, 0, w, h).data;
    mask = [];
    for (let i = 0; i < w * h; i++) if (a[i * 4 + 3] > 110) mask.push(i);
    draw(0);
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const i of mask) {
      const x = i % w, y = (i / w) | 0;
      const k = (x / w) * (RAMP.length - 1) + (bayer(x, y) - 0.5) * 1.2 + Math.sin(x * 0.2 - t * 2) * 0.35;
      const c = RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.round(k)))];
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(x, y, 1, 1);
    }
  };
  (document.fonts?.load('16px Silkscreen') || Promise.resolve()).then(build, build);
  if (reduceMotion) return;
  const vis = watch(canvas);
  const t0 = performance.now();
  (async () => { for (;;) { await vis.wait(160); if (mask.length) draw((performance.now() - t0) / 1000); } })();
}

/* ---------- 8×8 icons and sprites ---------- */
const BITMAPS = {
  chat: ['........', '.######.', '.#....#.', '.#....#.', '.######.', '.##.....', '.#......', '........'],
  fork: ['.#...#..', '.#...#..', '.#...#..', '.#..#...', '.###....', '.#......', '.#......', '.#......'],
  file: ['.####...', '.#..##..', '.#...##.', '.#....#.', '.#.##.#.', '.#....#.', '.######.', '........'],
  check: ['........', '......#.', '.....##.', '#...##..', '##.##...', '.###....', '..#.....', '........'],
  key: ['........', '.##.....', '#..#....', '#..#####', '.##..#.#', '........', '........', '........'],
  laptop: ['........', '.######.', '.#....#.', '.#....#.', '.######.', '########', '........', '........'],
  receipt: ['.######.', '.#....#.', '.#.##.#.', '.#....#.', '.#.##.#.', '.#....#.', '.#.#.##.', '..#.#...'],
  lock: ['..####..', '.#....#.', '.#....#.', '########', '###..###', '###..###', '########', '........'],
  unlock: ['..####..', '.#....#.', '.#......', '########', '###..###', '###..###', '########', '........'],
  gear: ['...##...', '.#.##.#.', '..####..', '###..###', '###..###', '..####..', '.#.##.#.', '...##...'],
  search: ['..###...', '.#...#..', '.#...#..', '.#...#..', '..###...', '.....#..', '......#.', '.......#'],
  panel: ['########', '#..#...#', '#..#...#', '#..#...#', '#..#...#', '#..#...#', '########', '........'],
  term: ['########', '#......#', '#.#....#', '#..#...#', '#.#.##.#', '#......#', '########', '........'],
};
const SPRITE = ['..#..#..', '...##...', '..####..', '.#.##.#.', '########', '#.####.#', '#.#..#.#', '...##...'];
const paintBitmap = (canvas, rows, color) => {
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y, 1, 1); }));
};
function setupIcons() {
  $$('canvas[data-icon]').forEach((c) => { const b = BITMAPS[c.dataset.icon]; if (b) paintBitmap(c, b, getComputedStyle(c).color); });
  $$('canvas[data-sprite]').forEach((c) => paintBitmap(c, SPRITE, c.dataset.sprite));
}

/* ---------- Content, OS detection ---------- */
const OS_ICONS = {
  win: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5.6l7.4-1v7H3zM11.4 4.4L21 3v8.6h-9.6zM3 12.4h7.4v7l-7.4-1zM11.4 12.4H21V21l-9.6-1.4z"/></svg>',
  mac: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.9zM14.1 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>',
  linux: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9l3 3-3 3M12.5 15H17"/></svg>',
};
const OS_NAMES = { win: 'Windows', mac: 'macOS', linux: 'Linux' };
const PRIMARY_FILE = { win: 'win-x64', mac: 'mac-arm', linux: 'linux-appimage' };

function detectOS() {
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod/.test(ua)) return 'mobile';
  const p = (navigator.userAgentData?.platform || navigator.platform || ua).toLowerCase();
  if (p.includes('win')) return 'win';
  if (p.includes('mac')) return 'mac';
  if (p.includes('linux') || p.includes('x11')) return 'linux';
  return 'other';
}

function setupContent() {
  const os = detectOS();
  $$('[data-download]').forEach((a) => {
    if (!OS_NAMES[os]) return;
    const label = $('[data-download-label]', a);
    const icon = $('[data-os-icon]', a);
    if (icon) icon.innerHTML = OS_ICONS[os];
    if (label) label.textContent = `Download for ${OS_NAMES[os]}`;
    const url = CONFIG.downloads[PRIMARY_FILE[os]];
    if (isReal(url)) a.href = url;
  });
  $$(`.platform[data-os="${os}"]`).forEach((el) => { el.classList.add('current'); el.parentElement.prepend(el); });
  $$('[data-file]').forEach((a) => { const u = CONFIG.downloads[a.dataset.file]; if (isReal(u)) a.href = u; });
  $$('[data-link]').forEach((a) => { const u = CONFIG.links[a.dataset.link]; if (u) a.href = u; });
  $$('[data-email]').forEach((a) => { a.href = `mailto:${CONFIG.email}`; });
  $$('[data-version]').forEach((el) => { el.textContent = CONFIG.version; });
  $$('[data-release-date]').forEach((el) => { el.textContent = CONFIG.releaseDate; });
  $$('[data-cmd]').forEach((el) => { el.textContent = CONFIG.install[el.dataset.cmd]; });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

function setupProgress() {
  const bar = $('#progress');
  if (!bar) return;
  const segs = Array.from({ length: 64 }, () => bar.appendChild(document.createElement('i')));
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const lit = Math.round((max > 0 ? scrollY / max : 0) * segs.length);
    segs.forEach((s, i) => s.classList.toggle('on', i < lit));
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();
}

function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = Number(el.dataset.decimals || 0);
  const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduceMotion) { el.textContent = fmt(end); return; }
  const STEPS = 18;
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = fmt(end * (1 - Math.pow(1 - i / STEPS, 2)));
    if (i >= STEPS) clearInterval(timer);
  }, 55);
}

function setupReveal() {
  $$('[data-reveal]').forEach((el) => onVisible(el, (n) => n.classList.add('in'), 0.15));
  $$('[data-count]').forEach((el) => onVisible(el, countUp, 0.6));
}

/* ---------- The "enough" meter ---------- */
function setupMeter() {
  const meter = $('#meter');
  if (!meter) return;
  const rows = $$('.segs', meter).map((s) => ({
    target: Number(s.dataset.fill),
    cells: Array.from({ length: 50 }, () => s.appendChild(document.createElement('i'))),
  }));
  const flag = $('.flag', meter);
  const fill = (n) => rows.forEach((r) => r.cells.forEach((c, i) => c.classList.toggle('on', i < Math.min(n, r.target))));
  if (reduceMotion) { fill(50); flag.classList.add('show'); return; }
  onVisible(meter, async () => {
    for (let n = 1; n <= 50; n++) {
      fill(n);
      if (n === rows[1].target) flag.classList.add('show');
      await sleep(n <= rows[1].target ? 34 : 26);
    }
  }, 0.4);
}

/* ---------- Checklist ---------- */
function setupQuests() {
  const box = $('#quests');
  if (!box) return;
  const tags = $$('.quest .tag', box);
  const set = (tag, state) => {
    tag.className = `tag${state === 'done' ? ' on' : state === 'running' ? ' run' : ''}`;
    tag.textContent = state;
  };
  if (reduceMotion) { tags.forEach((t) => set(t, 'done')); return; }
  const vis = watch(box);
  (async () => {
    for (;;) {
      tags.forEach((t) => set(t, 'queued'));
      await vis.wait(900);
      for (const t of tags) { set(t, 'running'); await vis.wait(1100); set(t, 'done'); await vis.wait(200); }
      await vis.wait(4000);
    }
  })();
}

/* ---------- App mock ---------- */
function setupComposer() {
  const prompt = $('#prompt');
  if (!prompt || reduceMotion) return;
  const send = $('#send');
  const PLACEHOLDER = prompt.textContent;
  const PROMPTS = [
    'Fix the flaky session refresh test and make sure it stays fixed',
    'Add rate limiting to the login route, 5 attempts per minute',
    'Find out why checkout got slow this week and fix it',
    'Move the billing hooks into their own module, keep the API the same',
  ];
  const vis = watch(prompt);
  (async () => {
    for (let p = 0; ; p = (p + 1) % PROMPTS.length) {
      await vis.wait(1800);
      prompt.classList.remove('placeholder');
      prompt.innerHTML = '<span></span><span class="caret"></span>';
      const out = prompt.firstChild;
      send.classList.add('live');
      for (const ch of PROMPTS[p]) { out.textContent += ch; await sleep(28 + Math.random() * 45); }
      await vis.wait(1400);
      send.classList.remove('live');
      prompt.classList.add('placeholder');
      prompt.textContent = PLACEHOLDER;
    }
  })();
}

function setupRouting() {
  const shot = $('#routeShot');
  if (!shot) return;
  const NAMES = { s: 'small', m: 'mid', l: 'large' };
  const COSTS = [0.004, 0.061, 0.018, 0.002];
  const rows = $$('.route', shot).map((r) => {
    const pips = $('.pips', r);
    return { tier: $('.tier', r), effort: Number(pips.dataset.effort), cells: Array.from({ length: 10 }, () => pips.appendChild(document.createElement('i'))) };
  });
  const total = $('#routeCost');
  const set = (row, on) => {
    const t = row.tier.dataset.tier;
    row.tier.textContent = on ? NAMES[t] : '· · ·';
    row.tier.className = `tier px-sm px${on ? ` ${t}` : ''}`;
    row.cells.forEach((c, i) => c.classList.toggle('on', on && i < row.effort));
  };
  if (reduceMotion) {
    rows.forEach((r) => set(r, true));
    total.textContent = `$${COSTS.reduce((a, b) => a + b).toFixed(3)}`;
    return;
  }
  const vis = watch(shot);
  (async () => {
    for (;;) {
      rows.forEach((r) => set(r, false));
      total.textContent = '$0.000';
      let sum = 0;
      await vis.wait(900);
      for (let i = 0; i < rows.length; i++) {
        set(rows[i], true);
        sum += COSTS[i];
        total.textContent = `$${sum.toFixed(3)}`;
        await vis.wait(750);
      }
      await vis.wait(3500);
    }
  })();
}

function setupMessages() {
  const shot = $('#snetShot');
  if (!shot) return;
  const msgs = $$('.msg', shot);
  if (reduceMotion) { msgs.forEach((m) => m.classList.add('show')); return; }
  const vis = watch(shot);
  (async () => {
    for (;;) {
      msgs.forEach((m) => m.classList.remove('show'));
      await vis.wait(800);
      for (const m of msgs) { m.classList.add('show'); await vis.wait(1100); }
      await vis.wait(3500);
    }
  })();
}

function setupCopy() {
  $$('.copy').forEach((b) => b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('code', b.parentElement).textContent);
      b.textContent = 'Copied';
    } catch {
      b.textContent = 'Ctrl+C';
    }
    setTimeout(() => { b.textContent = 'Copy'; }, 1500);
  }));
}

function setupWaitlist() {
  $$('.waitlist').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.nextElementSibling;
    const email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'That email doesn\'t look right.'; return; }
    if (!CONFIG.waitlistEndpoint) {
      location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent('Suffice waitlist')}&body=${encodeURIComponent(`Please add ${email} to the waitlist.`)}`;
      msg.textContent = 'Your email app should open. Hit send and you\'re on the list.';
      return;
    }
    try {
      const res = await fetch(CONFIG.waitlistEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!res.ok) throw new Error(res.statusText);
      form.reset();
      msg.textContent = 'You\'re on the list.';
    } catch {
      msg.textContent = `Something went wrong. Email ${CONFIG.email} instead.`;
    }
  }));
}

setupContent();
setupProgress();
setupReveal();
setupIcons();
$$('canvas[data-scene]').forEach(setupScene);
setupWordmark();
setupMeter();
setupQuests();
setupComposer();
setupRouting();
setupMessages();
setupCopy();
setupWaitlist();
