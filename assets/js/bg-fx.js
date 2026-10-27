/* Interactive backgrounds for akshatsingh119.github.io/portfolio. Vanilla JS + canvas, no dependencies.
   Runs on the warm themes (<html data-warm>) and on ?bg=e: a living gradient (slow morphing glow blobs, drift toward the cursor,
   a ripple on click/tap, mood shifts per section). Colours come from the CSS variables --g1..--g5.
   Pauses when the tab is hidden; prefers-reduced-motion gets one static frame. */
(() => {
  const R = document.documentElement, V = R.getAttribute('data-bg');
  const host = document.querySelector('.bg');
  const W_ = R.getAttribute('data-warm');
  if ((V !== 'e' && !W_) || !host) return;
  R.classList.add('has-fx');
  const cv = document.createElement('canvas'); cv.className = 'bgfx'; cv.setAttribute('aria-hidden', 'true'); host.prepend(cv);
  const g = cv.getContext('2d');
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const hex = h => { h = h.trim().replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const cs = getComputedStyle(R), INK = hex(cs.getPropertyValue('--ink')), PAPER = hex(cs.getPropertyValue('--paper'));
  const DARK = (PAPER[0] + PAPER[1] + PAPER[2]) / 765 < .45;
  const INDIGO = [91, 76, 240], TEAL = [20, 184, 166], PEACH = [255, 150, 105], YEL = [255, 205, 70], BLUE = [43, 69, 245];
  const GA = parseFloat(cs.getPropertyValue('--ga')) || .55; // glow strength per theme
  const G = [1, 2, 3, 4, 5].map(i => cs.getPropertyValue('--g' + i)).filter(v => v.trim()).map(hex); // warm palette, if the theme defines one
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
  let W = 0, H = 0, D = 1, t = 0, sy = scrollY, raf = 0, hover = matchMedia('(hover: hover)').matches;
  const P = { x: 0, y: 0, tx: 0, ty: 0, last: -1e9, init: false }, rip = [];
  // effects are weakest behind the text column, strongest at the edges
  const mask = x => { const d = Math.abs(x - W / 2) / Math.max(1, Math.min(W / 2, 520)); return d < .5 ? .4 : Math.min(1, .4 + (d - .5) * 1.5); };
  const stats = { n: 0, sum: 0, buf: [] };
  window.__bgfx = { variant: V || W_, stats, p95: () => { const b = [...stats.buf].sort((a, b) => a - b); return b[Math.floor(b.length * .95)] || 0; }, avg: () => stats.n ? stats.sum / stats.n : 0 };

  function resize() {
    W = innerWidth; H = innerHeight; D = .2;
    cv.width = Math.ceil(W * D); cv.height = Math.ceil(H * D); g.setTransform(D, 0, 0, D, 0, 0);
    if (!P.init) { P.x = P.tx = W * .75; P.y = P.ty = H * .3; P.init = true; }
    setup && setup();
  }
  const setPtr = (x, y) => { P.tx = x; P.ty = y; P.last = performance.now(); };
  addEventListener('pointermove', e => setPtr(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => { const q = e.touches[0]; q && setPtr(q.clientX, q.clientY); }, { passive: true });
  addEventListener('pointerdown', e => { setPtr(e.clientX, e.clientY); rip.push({ x: e.clientX, y: e.clientY, t: performance.now() }); kick && kick(e.clientX, e.clientY); }, { passive: true });
  addEventListener('scroll', () => { sy = scrollY; }, { passive: true });
  let tilt = null; // device tilt only where no permission prompt is needed
  if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function')
    addEventListener('deviceorientation', e => { if (e.gamma != null) tilt = [e.gamma / 45, (e.beta - 45) / 45]; }, { passive: true });

  function steer(now) { // autonomous path when there's no cursor (touch, idle)
    if (now - P.last > 2600) {
      let x = W * (.5 + .36 * Math.sin(now * .00021)), y = H * (.45 + .3 * Math.sin(now * .00029 + 1.3));
      if (tilt) { x += tilt[0] * W * .2; y += tilt[1] * H * .15; }
      P.tx = x; P.ty = y;
      if (!hover && now - (steer.r || 0) > 5200) { steer.r = now; rip.push({ x, y, t: now, soft: 1 }); }
    }
    const k = now - P.last > 2600 ? .02 : .16; P.x += (P.tx - P.x) * k; P.y += (P.ty - P.y) * k;
    while (rip.length && now - rip[0].t > 1600) rip.shift();
  }

  let setup, draw, kick;
  /* ---------- E: living gradient ---------- */
  {
    const rot = (a, k) => a.map((_, i) => a[(i + k) % a.length]); // each section gets a different arrangement of the same palette
    const MOODS = G.length === 5 ? [G, rot(G, 2), rot(G, 4), rot(G, 1)] : [[INDIGO, TEAL, BLUE, PEACH, YEL], [TEAL, INDIGO, PEACH, BLUE, YEL], [PEACH, YEL, INDIGO, TEAL, BLUE], [INDIGO, PEACH, TEAL, YEL, BLUE]];
    const B = [[.92, .08, .5], [.05, .5, .42], [.85, .95, .46], [.12, .02, .3], [.55, .75, .26]].map(([ax, ay, r], i) => ({ ax, ay, r, ph: i * 1.7, x: ax, y: ay, cx: 0, cy: 0 }));
    let secs = [];
    setup = () => { secs = [...document.querySelectorAll('main > *, .cs > section, .cs > div')].filter(e => e.offsetHeight > 120); };
    const mood = () => { // which section is in the middle of the viewport -> blend between moods
      let i = 0, f = 0; const mid = sy + H * .5;
      for (let k = 0; k < secs.length; k++) { const top = secs[k].offsetTop, h = secs[k].offsetHeight; if (mid >= top) { i = k; f = Math.min(1, (mid - top) / h); } }
      const a = MOODS[i % 4], b = MOODS[(i + 1) % 4], e = f < .7 ? 0 : (f - .7) / .3;
      return a.map((c, n) => mix(c, b[n], e));
    };
    let pal = null;
    draw = now => {
      const target = mood(); pal = pal ? pal.map((c, n) => mix(c, target[n], .04)) : target;
      g.clearRect(0, 0, W, H); const M = Math.max(W, H);
      B.forEach((b, n) => {
        const tt = now * .00012;
        let x = W * (b.ax + .1 * Math.sin(tt * (1 + n * .23) + b.ph)), y = H * (b.ay + .12 * Math.cos(tt * (.8 + n * .31) + b.ph * 1.3));
        const k = .12 + n * .03; b.cx += ((P.x - x) * k - b.cx) * .04; b.cy += ((P.y - y) * k - b.cy) * .04; x += b.cx; y += b.cy;
        const r = M * b.r * (1 + .12 * Math.sin(tt * 2.3 + n)), sx = 1 + .25 * Math.sin(tt * 1.7 + n * 2), a = (G.length === 5 ? GA : (DARK ? .42 : .5)) * (n > 2 ? .85 : 1);
        g.save(); g.globalCompositeOperation = DARK && G.length === 5 ? 'lighter' : 'source-over'; g.translate(x, y); g.rotate(tt * .6 + n); g.scale(sx, 2 - sx);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, rgba(pal[n], a)); gr.addColorStop(.55, rgba(pal[n], a * .45)); gr.addColorStop(1, rgba(pal[n], 0));
        g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); g.restore();
      });
      for (const r of rip) { const a = (now - r.t) / 1000, rad = 40 + a * 700, al = .18 * (1 - a / 1.6) * (r.soft ? .4 : 1);
        const RC = G.length === 5 ? G[4] : YEL; const gr = g.createRadialGradient(r.x, r.y, rad * .6, r.x, r.y, rad); gr.addColorStop(0, rgba(RC, 0)); gr.addColorStop(.8, rgba(RC, al)); gr.addColorStop(1, rgba(RC, 0)); g.fillStyle = gr; g.fillRect(r.x - rad, r.y - rad, rad * 2, rad * 2); }
    };
  }

  function frame(now) {
    raf = 0; if (document.hidden) return;
    const s = performance.now(); steer(now); draw(now);
    const dt = performance.now() - s; stats.n++; stats.sum += dt; stats.buf.push(dt); if (stats.buf.length > 600) stats.buf.shift();
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (RM.matches) { steer(performance.now()); P.x = P.tx; P.y = P.ty; draw(performance.now()); return; } if (!raf && !document.hidden) raf = requestAnimationFrame(frame); };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  RM.addEventListener && RM.addEventListener('change', () => { stop(); start(); });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (RM.matches) start(); }, 120); });
  resize(); start();
  window.__bgfx.stop = stop; window.__bgfx.start = start;
})();
