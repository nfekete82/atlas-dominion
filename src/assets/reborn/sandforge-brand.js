/* SANDFORGE BRAND V2: presentation-only integration; preserves all game controls. */
(() => {
  'use strict';
  const name = 'Sandforge: Bastion Wars';
  const logo = '/src/assets/reborn/sandforge-logo-transparent.webp';
  const makeLogo = (nameClass) => {
    const img = document.createElement('img');
    img.src = logo;
    img.alt = name;
    img.className = 'sandforge-logo ' + nameClass;
    img.decoding = 'async';
    return img;
  };
  const brandedMenu = (selector, logoClass) => {
    const root = document.querySelector(selector);
    if (!root) return;
    root.setAttribute('aria-label', selector === '#main-dialog' ? name + ' Hauptmenü' : name + ' Spielmenü');
    let brand = root.querySelector('.menu-brand');
    if (!brand) {
      brand = document.createElement('div');
      brand.className = 'menu-brand';
      (root.querySelector('form') || root).prepend(brand);
    }
    brand.replaceChildren(makeLogo(logoClass));
  };
  document.title = name;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = name + ' – taktisches Wüsten-RTS mit Infanterie, Fahrzeugen und Bastionen.';
  brandedMenu('#main-dialog', 'sandforge-splash-logo');
  brandedMenu('#pause-dialog', 'sandforge-pause-logo');
  const loading = document.querySelector('#loading');
  if (loading) {
    const text = loading.querySelector('p');
    loading.replaceChildren(makeLogo('sandforge-loading-logo'));
    if (text) loading.appendChild(text);
  }
  const hud = document.querySelector('.top .wordmark, header .wordmark');
  if (hud) {
    hud.setAttribute('aria-label', name);
    hud.replaceChildren(makeLogo('sandforge-hud-logo'));
  }
  const handbook = document.querySelector('#help-dialog small');
  if (handbook && /ATLAS/i.test(handbook.textContent)) {
    handbook.textContent = handbook.textContent.replace(/ATLAS/i, 'SANDFORGE');
  }
  document.documentElement.classList.add('sandforge-branded');
  // The cinematic poster contains the whole emblem. Never overlay the old
  // transparent wordmark onto it: double lettering and a black fringe would
  // reappear. Keep the original separate logo as a network-safe fallback.
  const cinematic = new Image();
  cinematic.decoding = 'async';
  cinematic.onload = () => {
    if (cinematic.naturalWidth >= 1200 && cinematic.naturalHeight >= 700) {
      document.documentElement.classList.add('sandforge-cinematic-title');
    }
  };
  cinematic.onerror = () => {
    // Older installs still have the original title screen and transparent logo.
  };
  cinematic.src = '/src/assets/reborn/start-screen-cinematic.webp';
})();
