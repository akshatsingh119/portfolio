/* Warm theme helpers. The theme itself is chosen by the inline script in <head> (?theme=cream|terra|cocoa, default cream).
   1) swaps the pre-rendered cover / flow images to the active theme (they have the page colours baked in);
   2) shows a small theme switcher while previewing with ?theme=. */
(() => {
  const R = document.documentElement, T = R.getAttribute('data-warm') || 'cream', DEF = 'cream';
  const sw = s => s && s.replace(/\/(cover|flow)-(cream|terra|cocoa)-(\d+)\.webp/g, `/$1-${T}-$3.webp`);
  if (T !== DEF) document.querySelectorAll('img').forEach(im => {
    if (im.hasAttribute('srcset')) im.setAttribute('srcset', sw(im.getAttribute('srcset')));
    const s = im.getAttribute('src'); if (s) im.setAttribute('src', sw(s));
  });
  if (!R.hasAttribute('data-preview')) return;
  const nav = document.createElement('nav'); nav.className = 'theme-sw'; nav.setAttribute('aria-label', 'Preview colour theme');
  [['cream', 'Cream'], ['terra', 'Terracotta'], ['cocoa', 'Cocoa']].forEach(([k, n]) => {
    const a = document.createElement('a'); a.textContent = n; a.href = '?theme=' + k + location.hash; if (k === T) a.setAttribute('aria-current', 'true'); nav.appendChild(a);
  });
  document.body.appendChild(nav);
})();
