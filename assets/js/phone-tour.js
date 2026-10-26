/* Homepage phone tour: a sticky CSS iPhone whose screen follows page scroll; side panels highlight in sync.
   Transform/opacity only, one rAF per scroll frame, images lazy-loaded near the section.
   No JS or prefers-reduced-motion => the section stays a static list of screens (CSS default). */
(() => {
  const sec = document.getElementById('tour');
  if (!sec || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const steps = [...sec.querySelectorAll('.pt-step')], box = sec.querySelector('.pt-steps');
  const imgs = [...sec.querySelectorAll('.pt-img')], N = imgs.length;
  const main = sec.querySelector('.pt-main'), sticky = sec.querySelector('.pt-sticky'), stage = sec.querySelector('.pt-stage');
  const [gl, gr] = [...sec.querySelectorAll('.pt-gimg')];
  const capT = sec.querySelector('.pt-cap-t'), capN = sec.querySelector('.pt-cap-n');
  const dots = steps.map(s => [...s.querySelectorAll('.pt-dots i')]);
  const mq = matchMedia('(max-width: 860px)');
  sec.classList.add('pt-on');

  const load = i => { const im = imgs[i]; if (im && !im.src) im.src = im.dataset.src; };
  for (let i = 0; i < 3; i++) load(i);
  new IntersectionObserver((es, io) => { if (es.some(e => e.isIntersecting)) { imgs.forEach((_, i) => load(i)); io.disconnect(); } },
    { rootMargin: '100% 0px' }).observe(sec);

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ease = t => t * t * (3 - 2 * t);
  let top = 0, h = 1, H = innerHeight, A = 0, raf = 0, last = -1, cur = -1, ry = 0, vy = 0, lastY = scrollY, live = false;
  const measure = () => {
    const r = box.getBoundingClientRect(), m = mq.matches; H = innerHeight; top = r.top + scrollY;
    // the anchor line: viewport middle on desktop, just under the sticky phone on mobile
    const sh = stage.offsetHeight; if (m) sec.style.setProperty('--stage-h', sh + 'px'); else sec.style.removeProperty('--stage-h');
    A = m ? sh + 24 : H * .5;
    // finish the sequence (with a short hold) before the sticky phone / last card is released
    const rel = m ? sh + steps[steps.length - 1].firstElementChild.offsetHeight : parseFloat(getComputedStyle(sticky).top) + sticky.offsetHeight;
    h = Math.max(1, r.bottom + scrollY - rel + A - top - H * .08);
  };

  function frame() {
    raf = 0;
    const y = scrollY, anchor = y + A;
    const u = clamp((anchor - top) / h, 0, .9999) * N, k = Math.floor(u);
    // each screen holds for the first half of its slot, then hands over to the next one
    const f = Math.min(N - 1, k + ease(clamp((u - k - .5) / .5, 0, 1)));
    // gentle 3D turn driven by scroll speed (settles back to flat)
    vy += ((y - lastY) - vy) * .2; lastY = y;
    ry += (clamp(vy * .25, -7, 7) - ry) * .15;
    main.style.setProperty('--ry', (ry * .6).toFixed(2) + 'deg');
    main.style.setProperty('--rx', (-ry * .35).toFixed(2) + 'deg');
    sticky.style.setProperty('--gy', ((u / N - .5) * 40).toFixed(1) + 'px');
    if (Math.abs(f - last) > 1e-4) {
      for (let i = 0; i < N; i++) {
        const d = i - f, s = imgs[i].style;
        if (d <= -1 || d >= 1) { if (s.visibility !== 'hidden') { s.visibility = 'hidden'; s.opacity = 0; } continue; }
        load(i); s.visibility = 'visible';
        // incoming screen slides up over the current one (like the app scrolling); the outgoing one recedes
        if (d >= 0) { s.opacity = Math.min(1, (1 - d) * 3).toFixed(3); s.transform = `translate3d(0,${(d * 100).toFixed(2)}%,0)`; s.zIndex = 2; }
        else { s.opacity = (1 + d * .6).toFixed(3); s.transform = `translate3d(0,${(d * 28).toFixed(2)}%,0) scale(${(1 + d * .05).toFixed(4)})`; s.zIndex = 1; }
      }
      last = f;
      const c = Math.round(f);
      steps.forEach((st, j) => {
        const a = +st.dataset.from, n = +st.dataset.count;
        dots[j].forEach((dt, q) => dt.style.setProperty('--f', clamp(f - (a + q) + 1, 0, 1).toFixed(3)));
        st.classList.toggle('is-active', c >= a && c < a + n);
      });
      if (c !== cur) {
        cur = c;
        capT.textContent = imgs[c].dataset.study; capN.textContent = `${c + 1} / ${N}`;
        const p = imgs[c - 1] || imgs[c + 1], q = imgs[c + 1] || imgs[c - 1];
        if (gl.dataset.s !== p.dataset.src) { gl.src = gl.dataset.s = p.dataset.src; }
        if (gr.dataset.s !== q.dataset.src) { gr.src = gr.dataset.s = q.dataset.src; }
      }
    }
    if (live && Math.abs(ry) > .02) raf = requestAnimationFrame(frame); // let the tilt settle
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(es => { live = es[0].isIntersecting; if (live) { measure(); kick(); } }, { rootMargin: '20% 0px' }).observe(sec);
  addEventListener('scroll', () => live && kick(), { passive: true });
  addEventListener('resize', () => { measure(); last = -1; kick(); });
  addEventListener('load', () => { measure(); last = -1; kick(); });
  if (window.ResizeObserver) new ResizeObserver(() => { measure(); last = -1; kick(); }).observe(box);
  measure(); frame();
  window.__pt = { get f() { return last; } };
})();
