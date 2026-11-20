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
  links: { docs: '#', github: '#', security: '#', privacy: '#', terms: '#', eula: '#', checksums: '#' },
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

/* ---------- Pixel helpers ---------- */
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

const fitCanvas = (canvas, px) => {
  const w = Math.max(1, Math.ceil(canvas.clientWidth / px));
  const h = Math.max(1, Math.ceil(canvas.clientHeight / px));
  canvas.width = w;
  canvas.height = h;
  return [w, h];
};

const loop = (canvas, fps, draw) => {
  draw(0);
  if (reduceMotion) return;
  const vis = watch(canvas);
  const t0 = performance.now();
  (async () => { for (;;) { await vis.wait(1000 / fps); draw((performance.now() - t0) / 1000); } })();
};

/* ---------- Dithered landscape, after the in-app background ---------- */
function setupPixels() {
  const canvas = $('#pixels');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const PALETTE = ['#0f2f47', '#164f73', '#1f7f9a', '#3cc0b0', '#cfeee6', '#2a2724', '#5a5347', '#8c8270', '#24401a', '#3f6a24', '#6f9a30', '#a9c94a', '#e6dc7a', '#9b84d8', '#f0dc5a'].map(hex);
  const nearest = (c) => {
    let best = PALETTE[0], bd = Infinity;
    for (const p of PALETTE) {
      const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  const colorAt = (u, v) => {
    const n = fbm(u * 5, v * 5), n2 = fbm(u * 22 + 3, v * 22 + 7), fine = fbm(u * 60, v * 60);
    const d = v - (0.78 - 1.25 * u + (n - 0.5) * 0.28);
    if (d < -0.045) return { sea: true, c: mix([70, 204, 190], [16, 60, 96], -d / 0.6).map((x) => x * (0.8 + fine * 0.4)) };
    if (d < 0.07) return { c: mix([42, 39, 36], [150, 140, 116], n2 * 0.8 + fine * 0.5) };
    if (v > 0.4 && hash(u * 9973, v * 7919) > 0.986) return { c: u < 0.45 ? [155, 132, 216] : [240, 220, 90], fixed: true };
    const sun = Math.max(0, 1 - Math.hypot(u - 0.95, v) * 1.25);
    const blade = 0.5 + 0.5 * Math.sin(u * 90 - v * 55 + n * 12);
    let c = mix([34, 62, 24], [160, 194, 70], n * 0.85 + sun * 0.4 + (blade - 0.5) * 0.4);
    c = mix(c, [228, 216, 110], sun * 0.45);
    return { c: c.map((x) => x * (0.78 + fine * 0.4)) };
  };

  let w = 0, h = 0, base = [], img = null;
  const build = () => {
    [w, h] = fitCanvas(canvas, 4);
    img = ctx.createImageData(w, h);
    base = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) base.push(colorAt(x / w, y / h));
  };
  const draw = (t) => {
    if (!img) return;
    const data = img.data;
    for (let y = 0, i = 0; y < h; y++) {
      for (let x = 0; x < w; x++, i++) {
        const b = base[i];
        let c = b.c;
        if (b.sea) {
          const s = Math.sin(x * 0.35 + y * 0.9 - t * 1.6) * 0.5 + Math.sin(x * 0.12 - y * 0.4 + t * 0.9) * 0.5;
          c = c.map((v) => v + s * 26);
        }
        const p = b.fixed ? c : nearest(c.map((v) => v + (bayer(x, y) - 0.5) * 56));
        data[i * 4] = p[0]; data[i * 4 + 1] = p[1]; data[i * 4 + 2] = p[2]; data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  build();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); draw(0); }, 150); });
  loop(canvas, 10, draw);
}

/* ---------- Striped pixel band ---------- */
function setupStripes() {
  const canvas = $('#stripes');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const lo = [44, 54, 18], hi = hex('#c8f05a');
  let w = 0, h = 0;
  const build = () => { [w, h] = fitCanvas(canvas, 3); };
  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const wave = 0.5 + 0.5 * Math.sin(x * 0.045 - t * 1.4);
      const amp = 0.25 + 0.75 * wave * (0.55 + 0.45 * noise(x * 0.06, t * 0.4));
      for (let y = 0; y < h; y++) {
        const dy = Math.abs(y / h - 0.5) * 2;
        const k = amp - dy;
        if (k <= 0 || bayer(x >> 1, y) > k * 2.2) continue;
        const c = mix(lo, hi, Math.min(1, k * 1.6) * (0.4 + wave * 0.6));
        ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };
  build();
  addEventListener('resize', build);
  loop(canvas, 12, draw);
}

/* ---------- Grass dissolving into the footer ---------- */
function setupDissolve() {
  const canvas = $('#dissolve');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const RAMP = ['#1b2a12', '#24401a', '#3f6a24', '#6f9a30', '#a9c94a'].map(hex);
  let w = 0, h = 0;
  const build = () => { [w, h] = fitCanvas(canvas, 4); };
  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      for (let x = 0; x < w; x++) {
        const n = noise(x * 0.06 + t * 0.15, y * 0.12);
        const k = v * v * 1.15 + (n - 0.5) * 0.35;
        if (bayer(x, y) > k) continue;
        const c = RAMP[Math.min(RAMP.length - 1, Math.floor((k + hash(x, y) * 0.25) * RAMP.length * 0.85))];
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };
  build();
  addEventListener('resize', build);
  loop(canvas, 6, draw);
}

/* ---------- 8×8 pixel icons ---------- */
const ICON_BITMAPS = {
  chat: ['........', '.######.', '.#....#.', '.#....#.', '.######.', '.##.....', '.#......', '........'],
  fork: ['.#...#..', '.#...#..', '.#...#..', '.#..#...', '.###....', '.#......', '.#......', '.#......'],
  file: ['.####...', '.#..##..', '.#...##.', '.#....#.', '.#.##.#.', '.#....#.', '.######.', '........'],
  check: ['........', '......#.', '.....##.', '#...##..', '##.##...', '.###....', '..#.....', '........'],
  bars: ['........', '......#.', '......#.', '...#..#.', '...#..#.', '#..#..#.', '#..#..#.', '........'],
  msgs: ['#####...', '#...#...', '#####...', '#.......', '...#####', '...#...#', '...#####', '.......#'],
  term: ['########', '#......#', '#.#....#', '#..#...#', '#.#.##.#', '#......#', '########', '........'],
};
function setupIcons() {
  $$('canvas[data-icon]').forEach((c) => {
    const rows = ICON_BITMAPS[c.dataset.icon];
    if (!rows) return;
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#dcdcdc';
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y, 1, 1); }));
  });
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

function countUp(el) {
  const end = parseFloat(el.dataset.count);
  const dec = Number(el.dataset.decimals || 0);
  const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduceMotion) { el.textContent = fmt(end); return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 1400);
    el.textContent = fmt(end * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setupReveal() {
  $$('[data-reveal]').forEach((el) => onVisible(el, (n) => n.classList.add('in'), 0.15));
  $$('[data-count]').forEach((el) => onVisible(el, countUp, 0.6));
}

/* ---------- App mock ---------- */
function setupComposer() {
  const prompt = $('#prompt');
  const spark = $('#spark');
  if (spark) {
    const bars = Array.from({ length: 28 }, () => { const i = document.createElement('i'); spark.appendChild(i); return i; });
    let o = 0;
    const tick = () => {
      bars.forEach((b, i) => {
        const v = 0.25 + 0.75 * noise((i + o) * 0.35, 1.7);
        b.style.height = `${Math.round(v * 4) * 25}%`;
        b.classList.toggle('on', i > bars.length - 6);
      });
      o++;
    };
    tick();
    if (!reduceMotion) setInterval(tick, 700);
  }
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
      await vis.wait(1600);
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
  const rows = $$('.route', shot).map((r) => {
    const blocks = $('.blocks', r);
    const cells = Array.from({ length: 10 }, () => { const i = document.createElement('i'); blocks.appendChild(i); return i; });
    return { model: $('.model', r), cells };
  });
  const total = $('#routeCost');
  const COSTS = [0.004, 0.061, 0.018, 0.002];
  const set = (row, on) => {
    row.model.textContent = on ? row.model.dataset.model : 'routing…';
    row.model.classList.toggle('set', on);
    const effort = on ? Number(row.model.dataset.effort) : 0;
    row.cells.forEach((c, i) => c.classList.toggle('on', i < effort));
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
      b.textContent = 'Press Ctrl+C';
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
setupReveal();
setupIcons();
setupPixels();
setupStripes();
setupDissolve();
setupComposer();
setupRouting();
setupMessages();
setupCopy();
setupWaitlist();
