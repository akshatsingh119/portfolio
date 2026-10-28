/* Fun mode (homepage only), vanilla JS, no libraries.
   1) Ship-or-kill hero game  2) easter egg (Konami code / tap the name 5 times)
   3) micro-interactions: ₹ / ⚡ cursor, tour-finish confetti, card tilt + glare, magnetic buttons
   4) Break the app: real edge-case screens in a phone, with how each was designed for.
   Without JS all of this is simply absent (the game stays hidden, Break the app falls back to a text list). */
(() => {
  const D = document, R = D.documentElement;
  R.classList.add('js');
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const $ = (s, el = D) => el.querySelector(s), $$ = (s, el = D) => [...el.querySelectorAll(s)];
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- confetti (shared) ---------- */
  let confettiBusy = false;
  function confetti(x = innerWidth / 2, y = innerHeight / 3, n = 140) {
    if (RM.matches || confettiBusy) return;
    confettiBusy = true;
    const c = D.createElement('canvas'); c.className = 'fx-confetti'; c.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    D.body.appendChild(c); const g = c.getContext('2d'); g.scale(dpr, dpr);
    const cs = getComputedStyle(R), col = ['--g1', '--g2', '--g3', '--g4', '--g5', '--mark', '--accent'].map(v => cs.getPropertyValue(v).trim()).filter(Boolean);
    const P = Array.from({ length: n }, () => {
      const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.1, v = 6 + Math.random() * 9;
      return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * .35,
        c: col[(Math.random() * col.length) | 0] || '#FFB366', s: Math.random() < .25 ? '₹' : '' };
    });
    const t0 = performance.now();
    (function step(t) {
      const k = (t - t0) / 1900; g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of P) {
        p.vy += .32; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if (p.s) { g.font = '700 15px "Bricolage Grotesque",sans-serif'; g.fillText(p.s, -4, 5); }
        else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
        g.restore();
      }
      if (k < 1) requestAnimationFrame(step); else { c.remove(); confettiBusy = false; }
    })(t0);
  }

  /* ---------- 1. Ship or kill ---------- */
  const IDEAS = [
    { p: 'Refund Clock', t: 'Show a live countdown to the refund date when a UPI payment fails', a: 'ship',
      why: 'RBI already sets the date, T+1 or T+5. Showing it turns “where is my money?” into a date.', href: 'case-studies/upi-refund-status/', cur: 'coin' },
    { p: 'FuelDrop', t: 'Doorstep petrol delivery to your parking spot', a: 'kill',
      why: 'It isn’t permitted in India. That research is why FuelDrop pivoted to EV-only charging.', href: 'https://akshatsingh119.github.io/fueldrop-mvp/', ext: 1, cur: 'bolt' },
    { p: 'Refund Clock Helper', t: 'Let the AI helper promise refund dates it can’t verify', a: 'kill',
      why: 'The model only extracts facts. Code works out the deadline, and a verifier rejects any reply that contradicts it.', href: 'case-studies/ai-refund-helper/demo/', cur: 'coin' },
    { p: 'Reward Receipt', t: 'A cashback receipt that shows exactly why you earned it', a: 'ship',
      why: 'Every “not eligible” complaint I found was discovered after paying. Say it before, prove it after.', href: 'case-studies/rewards-clarity/', cur: 'coin' },
    { p: 'Refund Clock', t: 'Tell people to “just pay again” while a payment is still pending', a: 'kill',
      why: 'Retrying while a payment is pending risks a double debit. “Don’t pay again yet” is the most valuable sentence.', href: 'case-studies/upi-refund-status/', cur: 'coin' },
  ];
  const sok = $('#sok');
  if (sok) {
    let i = 0, score = 0, busy = false;
    const N = IDEAS.length;
    const card = (it, next) => `<div class="sok-card${next ? ' is-next' : ''}" ${next ? 'aria-hidden="true"' : 'tabindex="0"'} data-cur="${it.cur}"
      aria-label="Idea: ${esc(it.t)}. Press the right arrow to ship or the left arrow to kill.">
      <span class="sok-stamp k" aria-hidden="true">KILL</span><span class="sok-stamp s" aria-hidden="true">SHIP</span>
      <small>${esc(it.p)}</small><b>${esc(it.t)}</b><span class="sok-hint" aria-hidden="true">← kill · drag · ship →</span></div>`;
    function start() {
      i = 0; score = 0;
      sok.innerHTML = `<p class="sok-k" id="sok-h">Ship it or kill it? <small aria-live="polite">1 / ${N}</small></p>
        <div class="sok-deck"></div>
        <div class="sok-btns"><button type="button" data-v="kill" class="mag">✕ Kill</button><button type="button" data-v="ship" class="mag">✓ Ship</button></div>
        <p class="sok-why" aria-live="polite">You’re the PM. Drag or swipe the card, use the buttons, or the arrow keys.</p>`;
      deal(); bindMag(sok);
    }
    function deal() {
      const deck = $('.sok-deck', sok);
      deck.innerHTML = (IDEAS[i + 1] ? card(IDEAS[i + 1], 1) : '') + card(IDEAS[i]);
      $('.sok-k small', sok).textContent = `${i + 1} / ${N}`;
      drag($('.sok-card:not(.is-next)', deck));
    }
    function decide(v, focusNext) {
      if (busy) return; busy = true;
      const it = IDEAS[i], c = $('.sok-card:not(.is-next)', sok), agree = v === it.a;
      if (agree) score++;
      const dir = v === 'ship' ? 1 : -1;
      c.style.transition = RM.matches ? 'opacity .2s' : '';
      c.style.transform = RM.matches ? '' : `translateX(${dir * 125}%) rotate(${dir * 16}deg)`;
      c.style.opacity = '0';
      $(`.sok-stamp.${v === 'ship' ? 's' : 'k'}`, c).style.opacity = 1;
      $('.sok-why', sok).innerHTML = `<span class="ag">${agree ? '✓ Same call.' : '✗ Different call.'}</span> <b>Akshat: ${it.a === 'ship' ? 'Ship' : 'Kill'}.</b> ${esc(it.why)} <a href="${it.href}"${it.ext ? ' target="_blank" rel="noopener"' : ''}>${esc(it.p)} →</a>`;
      setTimeout(() => {
        busy = false; i++;
        if (i < N) { deal(); if (focusNext) $('.sok-card:not(.is-next)', sok).focus({ preventScroll: true }); }
        else end();
      }, RM.matches ? 120 : 330);
    }
    function end() {
      const msg = score === N ? 'Same calls all the way. We should talk.' : score >= 3 ? 'Mostly aligned. The disagreements are the interesting part.' : 'Bold calls. Come and argue with me about them.';
      const why = $('.sok-why', sok).innerHTML;
      sok.innerHTML = `<div class="sok-end" role="status"><p class="sok-k" id="sok-h">Ship it or kill it? <small>done</small></p>
        <p class="sok-score">You agree with Akshat ${score}/${N}</p><p>${msg}</p>
        <div class="row"><a class="btn fill mag" href="#tour">See the work behind these calls</a><button type="button" class="sok-again">Play again</button></div></div>
        <p class="sok-why">${why}</p>`;
      $('.sok-again', sok).addEventListener('click', () => { start(); $('.sok-card:not(.is-next)', sok).focus({ preventScroll: true }); });
      bindMag(sok);
      if (score >= 4) { const r = sok.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + 30, 90); }
    }
    function drag(c) {
      let x0 = 0, dx = 0, id = null, moved = false;
      const ss = $('.sok-stamp.s', c), sk = $('.sok-stamp.k', c);
      c.addEventListener('pointerdown', e => { if (busy || e.button > 0) return; id = e.pointerId; x0 = e.clientX; dx = 0; moved = false; c.setPointerCapture(id); c.classList.add('is-drag'); });
      c.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return; dx = e.clientX - x0; if (Math.abs(dx) > 4) moved = true;
        c.style.transform = `translateX(${dx}px) rotate(${dx / 16}deg)`;
        ss.style.opacity = Math.max(0, Math.min(1, dx / 80)); sk.style.opacity = Math.max(0, Math.min(1, -dx / 80));
      });
      const up = e => {
        if (e.pointerId !== id) return; id = null; c.classList.remove('is-drag');
        if (Math.abs(dx) > 70) decide(dx > 0 ? 'ship' : 'kill');
        else { c.style.transform = ''; ss.style.opacity = sk.style.opacity = ''; }
      };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); decide('ship', 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); decide('kill', 1); }
      });
    }
    sok.addEventListener('click', e => { const b = e.target.closest('.sok-btns button'); if (b) decide(b.dataset.v); });
    sok.hidden = false; start();
  }

  /* ---------- 2. Easter egg ---------- */
  let eggEl = null, eggBack = null;
  function openEgg() {
    if (eggEl) return;
    eggBack = D.activeElement;
    eggEl = D.createElement('div'); eggEl.className = 'egg';
    eggEl.innerHTML = `<div class="egg-card" role="dialog" aria-modal="true" aria-labelledby="egg-h">
      <button type="button" class="egg-x" aria-label="Close">×</button>
      <p class="k">Secret level unlocked</p><h2 id="egg-h">Director’s cut: behind the scenes</h2>
      <p class="sub">You found it. Here’s what went into this site, by the numbers.</p>
      <ul class="egg-stats">
        <li><b>17</b>real phone screens in the tour, across 4 projects</li>
        <li><b>6</b>ways to break the app, each a real edge-case screen</li>
        <li><b>50</b>synthetic eval cases for the AI helper: 30, then a fresh 20 held out</li>
        <li><b>5</b>prompt versions, v1 to v5, until code owned the deadline</li>
        <li><b>0%</b>hallucinated rules on the fresh 20. Still open: p95 latency of 28.7 s on the free tier</li>
        <li><b>3</b>colour themes. Try <a href="?theme=cream">cream</a> or <a href="?theme=terra">terra</a></li>
        <li><b>1</b>pivot: petrol and diesel out, EV-only in, after the regulatory research</li>
      </ul>
      <h3>Product hot takes</h3>
      <ul class="egg-takes">
        <li>A spinner is not a status. Tell people where their money is.</li>
        <li>If the model is bad at date maths, don’t let it do date maths.</li>
        <li>The best time to say “not eligible” is before someone pays.</li>
        <li>Read the regulation before you draw the first screen.</li>
        <li>An honest range beats a big “up to”.</li>
      </ul>
      <p class="egg-foot">Press Esc to close · Built with vanilla JS, no libraries.</p></div>`;
    D.body.appendChild(eggEl);
    const x = $('.egg-x', eggEl); x.focus();
    x.addEventListener('click', closeEgg);
    eggEl.addEventListener('click', e => { if (e.target === eggEl) closeEgg(); });
    eggEl.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const f = $$('a,button', eggEl), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && D.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && D.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    D.body.style.overflow = 'hidden';
    setTimeout(() => confetti(innerWidth / 2, innerHeight * .3, 170), 120);
  }
  function closeEgg() {
    if (!eggEl) return; eggEl.remove(); eggEl = null; D.body.style.overflow = '';
    if (eggBack && eggBack.focus) eggBack.focus({ preventScroll: true });
  }
  const KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kp = 0;
  D.addEventListener('keydown', e => {
    if (e.key === 'Escape' && eggEl) { closeEgg(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kp = k === KON[kp] ? kp + 1 : (k === KON[0] ? 1 : 0);
    if (kp === KON.length) { kp = 0; openEgg(); }
  });
  const logo = $('#logo');
  if (logo) {
    let n = 0, t = 0;
    logo.addEventListener('click', () => {
      const now = Date.now(); n = now - t < 900 ? n + 1 : 1; t = now;
      logo.style.transform = RM.matches ? '' : `rotate(${n % 2 ? -3 : 3}deg) scale(${1 + n * .03})`;
      setTimeout(() => { logo.style.transform = ''; }, 160);
      if (n >= 5) { n = 0; openEgg(); }
    });
    logo.style.display = 'inline-block'; logo.style.transition = 'transform .15s';
  }
  try { console.log('%c👋 Psst. Try ↑ ↑ ↓ ↓ ← → ← → B A on this page, or click my name five times.', 'font:600 13px system-ui;color:#F2A65A'); } catch (e) {}

  /* ---------- 3. Micro-interactions ---------- */
  // zones for the custom cursor
  const setCur = (sel, k) => $$(sel).forEach(el => el.dataset.cur = k);
  setCur('#pt-rr,#pt-rc,#pt-ai', 'coin'); setCur('#pt-fd', 'bolt');
  $$('#work .case').forEach(el => { const h = ($('h3', el) || {}).textContent || '';
    if (/Reward Receipt|Refund Clock/.test(h)) el.dataset.cur = 'coin'; else if (/FuelDrop/.test(h)) el.dataset.cur = 'bolt'; });
  const stage = $('#tour .pt-stage'); if (stage) stage.dataset.cur = 'coin';
  // confetti when the tour first reaches the last screen
  let tourDone = false;
  D.addEventListener('pt:screen', e => {
    const { i, n, study } = e.detail; if (stage) stage.dataset.cur = study === 'FuelDrop' ? 'bolt' : 'coin';
    if (i === n - 1 && !tourDone) { tourDone = true; const ph = $('#tour .pt-main'); const r = ph ? ph.getBoundingClientRect() : { left: innerWidth / 2, width: 0, top: innerHeight / 3 };
      confetti(r.left + r.width / 2, r.top + 40, 150); }
  });

  function bindMag(root) {
    if (!FINE.matches || RM.matches) return;
    $$('.mag', root).forEach(b => {
      if (b.dataset.magOn) return; b.dataset.magOn = 1;
      b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.classList.add('is-mag'); const cl = v => Math.max(-9, Math.min(9, v)); b.style.transform = `translate(${cl(dx * .22).toFixed(1)}px,${cl(dy * .3).toFixed(1)}px)`; });
      b.addEventListener('pointerleave', () => { b.classList.remove('is-mag'); b.style.transform = ''; });
    });
  }
  function setupFine() {
    if (!FINE.matches || RM.matches || R.classList.contains('fc-on')) return;
    R.classList.add('fc-on', 'tilt-on');
    $$('.hero .btns .btn, .brk-toggle').forEach(b => b.classList.add('mag')); bindMag(D);
    // cursor
    const cur = D.createElement('div'); cur.className = 'fcur'; cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<span class="r">₹</span><svg viewBox="0 0 24 24"><path fill="currentColor" d="M13.5 2 4 13.5h6.2L9 22l10-12.5h-6.4z"/></svg>';
    D.body.appendChild(cur);
    let mx = -100, my = -100, raf = 0, kind = '';
    const paint = () => { raf = 0; cur.style.transform = `translate3d(${mx}px,${my}px,0)`; };
    D.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      const z = e.target.closest && e.target.closest('[data-cur]'), k = z && !eggEl ? z.dataset.cur : '';
      if (k !== kind) { kind = k; cur.classList.toggle('on', !!k); cur.classList.toggle('bolt', k === 'bolt'); }
      cur.classList.toggle('big', !!(k && e.target.closest('a,button,summary,.sok-card')));
      if (k && !raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    D.addEventListener('pointerout', e => { if (!e.relatedTarget) { kind = ''; cur.classList.remove('on'); } });
    // tilt + glare on project cards
    $$('#work .case').forEach(el => {
      let r = null, f = 0, px = 0, py = 0;
      const apply = () => { f = 0; el.style.transform = `perspective(1400px) rotateX(${(-py * 2.4).toFixed(2)}deg) rotateY(${(px * 3).toFixed(2)}deg)`; };
      el.addEventListener('pointerenter', () => { r = el.getBoundingClientRect(); el.classList.add('is-tilt'); });
      el.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; r = r || el.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5;
        el.style.setProperty('--gx', ((px + .5) * 100).toFixed(1) + '%'); el.style.setProperty('--gy', ((py + .5) * 100).toFixed(1) + '%');
        if (!f) f = requestAnimationFrame(apply); }, { passive: true });
      el.addEventListener('pointerleave', () => { r = null; el.classList.remove('is-tilt'); if (f) cancelAnimationFrame(f), f = 0; el.style.transform = ''; });
    });
    addEventListener('scroll', () => $$('#work .case.is-tilt').forEach(el => el.dispatchEvent(new Event('pointerenter'))), { passive: true });
  }
  setupFine();
  FINE.addEventListener && FINE.addEventListener('change', setupFine);

  /* ---------- 4. Break the app ---------- */
  const brk = $('#brk');
  if (brk) {
    const img = $('.brk-img', brk), phone = $('.brk-phone', brk), note = $('.brk-note', brk), bs = $('.brk-stage', brk);
    const gl = D.createElement('span'); gl.className = 'brk-glitch'; gl.setAttribute('aria-hidden', 'true'); $('.pt-screen', phone).appendChild(gl);
    bs.dataset.cur = 'coin';
    const btns = $$('.brk-btn', brk);
    function show(b, fx = true) {
      btns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      bs.dataset.cur = b.dataset.cur;
      $('.brk-note-k', note).textContent = `${$('small', b).textContent} · ${$('span', b).textContent}`;
      $('.brk-note-t', note).textContent = $('.brk-why', b).textContent;
      if (img.getAttribute('src') !== b.dataset.src) {
        const pre = new Image(); pre.sizes = img.sizes; pre.srcset = b.dataset.srcset; pre.src = b.dataset.src;
        img.classList.add('is-out');
        const swap = () => { img.srcset = b.dataset.srcset; img.src = b.dataset.src; img.alt = b.dataset.alt; img.classList.remove('is-out'); };
        (pre.decode ? pre.decode() : Promise.resolve()).then(() => setTimeout(swap, RM.matches ? 0 : 140), swap);
      }
      if (fx && !RM.matches) { phone.classList.remove('is-shake'); void phone.offsetWidth; phone.classList.add('is-shake'); }
    }
    phone.addEventListener('animationend', e => { if (e.target === phone) phone.classList.remove('is-shake'); });
    btns.forEach(b => b.addEventListener('click', () => show(b)));
    brk.addEventListener('toggle', () => { if (brk.open) { img.loading = 'eager'; btns.forEach(b => { const p = new Image(); p.sizes = img.sizes; p.srcset = b.dataset.srcset; }); } });
  }
})();
