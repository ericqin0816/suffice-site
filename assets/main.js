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
  new IntersectionObserver(([e]) => { state.on = e.isIntersecting; }, { threshold: 0.1 }).observe(el);
  state.wait = async (ms) => { await sleep(ms); while (!state.on || document.hidden) await sleep(200); };
  return state;
};

const ICONS = {
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
    if (icon) icon.innerHTML = ICONS[os];
    if (label && !a.hasAttribute('data-short')) label.textContent = `Download for ${OS_NAMES[os]}`;
    const url = CONFIG.downloads[PRIMARY_FILE[os]];
    if (isReal(url)) a.href = url;
  });
  $$(`.platform[data-os="${os}"]`).forEach((el) => {
    el.classList.add('current');
    el.parentElement.prepend(el);
  });
  $$('[data-file]').forEach((a) => { const u = CONFIG.downloads[a.dataset.file]; if (isReal(u)) a.href = u; });
  $$('[data-link]').forEach((a) => { const u = CONFIG.links[a.dataset.link]; if (u) a.href = u; });
  $$('[data-email]').forEach((a) => { a.href = `mailto:${CONFIG.email}`; });
  $$('[data-version]').forEach((el) => { el.textContent = CONFIG.version; });
  $$('[data-release-date]').forEach((el) => { el.textContent = CONFIG.releaseDate; });
  $$('[data-cmd]').forEach((el) => { el.textContent = CONFIG.install[el.dataset.cmd]; });
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

function setupNav() {
  const nav = $('#nav');
  const onScroll = () => nav?.classList.toggle('scrolled', scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
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

// ASCII mosaic in the style of the in-app background: a coastline, a cliff and a grassy slope.
function setupMosaic() {
  const canvas = $('#mosaic');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const CW = 7, CH = 11;
  const RAMP = '.,:;-=+*xX#';
  const hash = (x, y) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
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

  const colorAt = (u, v) => {
    const n = fbm(u * 5, v * 5), n2 = fbm(u * 22 + 3, v * 22 + 7), fine = fbm(u * 60, v * 60);
    const d = v - (0.82 - 1.3 * u + (n - 0.5) * 0.28);
    let c, flower = null;
    if (d < -0.045) {
      c = mix([70, 204, 190], [18, 74, 118], -d / 0.6);
      const swell = 0.5 + 0.5 * Math.sin(v * 70 + u * 18 + n * 9);
      c = mix(c, [205, 244, 236], (swell - 0.8) * 2.2 + (n2 - 0.75) * 1.4);
    } else if (d < 0.07) {
      c = mix([60, 56, 50], [170, 160, 136], n2 * 0.8 + fine * 0.5);
    } else {
      const sun = Math.max(0, 1 - Math.hypot(u - 0.9, v) * 1.3);
      const blade = 0.5 + 0.5 * Math.sin(u * 90 - v * 55 + n * 12);
      c = mix([40, 80, 30], [156, 190, 62], n * 0.8 + sun * 0.45 + (blade - 0.5) * 0.35);
      c = mix(c, [224, 214, 100], sun * 0.5);
      if (v > 0.45 && hash(u * 9973 | 0, v * 7919 | 0) > 0.982) flower = u < 0.45 ? [196, 170, 240] : [250, 232, 110];
    }
    const shade = 0.72 + fine * 0.5;
    return { c: c.map((x) => x * shade), flower };
  };

  let cols = 0, rows = 0, cells = [];
  const drawCell = (i) => {
    const cell = cells[i];
    const x = (i % cols) * CW, y = Math.floor(i / cols) * CH;
    const [r, g, b] = cell.c;
    ctx.fillStyle = `rgb(${r * 0.55 | 0},${g * 0.55 | 0},${b * 0.55 | 0})`;
    ctx.fillRect(x, y, CW, CH);
    const [fr, fg, fb] = cell.flower || cell.c.map((v) => Math.min(255, v * 1.25 + 12));
    ctx.fillStyle = `rgb(${fr | 0},${fg | 0},${fb | 0})`;
    ctx.fillText(cell.ch, x + CW / 2, y + CH / 2 + 0.5);
  };
  const build = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '500 10px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    cols = Math.ceil(w / CW);
    rows = Math.ceil(h / CH);
    cells = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const { c, flower } = colorAt(x / cols, y / rows);
        const lum = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255;
        const k = flower ? RAMP.length - 1 : Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length * 1.1 + hash(x, y + 99) * 3));
        cells.push({ c, flower, k, ch: RAMP[k] });
      }
    }
    cells.forEach((_, i) => drawCell(i));
  };

  document.fonts?.ready.then(build);
  build();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 150); });
  if (reduceMotion) return;

  const vis = watch(canvas);
  (async () => {
    for (;;) {
      await vis.wait(90);
      const n = Math.max(1, Math.floor(cells.length * 0.015));
      for (let j = 0; j < n; j++) {
        const i = Math.floor(Math.random() * cells.length);
        const cell = cells[i];
        const k = Math.max(0, Math.min(RAMP.length - 1, cell.k + Math.round(Math.random() * 4 - 2)));
        cell.ch = RAMP[k];
        drawCell(i);
      }
    }
  })();
}

function setupComposer() {
  const prompt = $('#prompt');
  if (!prompt || reduceMotion) return;
  const send = $('#send');
  const spin = $('#threadSpin');
  const PLACEHOLDER = prompt.textContent;
  const PROMPTS = [
    'Fix the flaky session refresh test and make sure it stays fixed',
    'Add rate limiting to the login route, 5 attempts per minute',
    'Find out why checkout got slow this week and fix it',
    'Move the billing hooks into their own module, keep the API the same',
  ];
  const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  let s = 0;
  setInterval(() => { if (spin) spin.textContent = SPIN[s++ % SPIN.length]; }, 90);

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
  const models = $$('.model', shot);
  const total = $('#routeCost');
  const COSTS = [0.004, 0.061, 0.018, 0.002];
  const finish = () => {
    models.forEach((m) => { m.textContent = m.dataset.model; m.classList.add('set'); });
    total.textContent = `$${COSTS.reduce((a, b) => a + b).toFixed(3)}`;
  };
  if (reduceMotion) { finish(); return; }
  const vis = watch(shot);
  (async () => {
    for (;;) {
      models.forEach((m) => { m.textContent = 'routing…'; m.classList.remove('set'); });
      let sum = 0;
      total.textContent = '$0.000';
      await vis.wait(900);
      for (let i = 0; i < models.length; i++) {
        models[i].textContent = models[i].dataset.model;
        models[i].classList.add('set');
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

function setupAscii() {
  $$('[data-ascii]').forEach((pre) => {
    const UNIT = '·   .   :   +   ';
    const render = (o) => {
      const len = Math.ceil(pre.clientWidth / 7) + UNIT.length;
      const line = UNIT.repeat(Math.ceil(len / UNIT.length) + 2);
      pre.textContent = Array.from({ length: 10 }, (_, r) => {
        const off = (o + r * 6) % UNIT.length;
        return line.slice(off, off + len);
      }).join('\n');
    };
    let o = 0;
    render(o);
    addEventListener('resize', () => render(o));
    if (!reduceMotion) setInterval(() => render(++o), 450);
  });
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
setupNav();
setupReveal();
setupMosaic();
setupComposer();
setupRouting();
setupMessages();
setupAscii();
setupCopy();
setupWaitlist();
