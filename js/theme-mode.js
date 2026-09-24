(() => {
  'use strict';

  const key = 'kaifei-blog-color-mode';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';
  let mode = 'system';
  try { mode = valid(window.localStorage.getItem(key)); } catch { /* Storage is optional. */ }

  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  const colors = {
    light: metas.find(meta => meta.media?.includes('light'))?.content || metas[0]?.content || '#eee',
    dark: metas.find(meta => meta.media?.includes('dark'))?.content || '#222'
  };
  // One active meta avoids a system-driven entry overriding a manual choice.
  metas.slice(1).forEach(meta => meta.remove());
  metas[0]?.removeAttribute('media');

  function apply() {
    const color = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
    root.dataset.theme = color;
    root.dataset.themeMode = mode;
    if (metas[0]) metas[0].content = colors[color];
    document.querySelectorAll('.theme-switch input').forEach(input => {
      input.checked = input.value === mode;
    });
    const toggle = document.querySelector('.theme-switch-toggle');
    if (toggle) toggle.title = `外观：${{light: '浅色', dark: '深色', system: '跟随系统'}[mode]}`;
  }

  apply();
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    // Ignore sessionStorage events; localStorage getters can throw in private contexts.
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
    mode = valid(event.newValue);
    apply();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const control = document.querySelector('.theme-switch');
    if (!control) return;
    const toggle = control.querySelector('.theme-switch-toggle');
    const panel = control.querySelector('.theme-switch-panel');
    const setOpen = open => {
      control.classList.toggle('is-open', open);
      panel.toggleAttribute('inert', !open);
      panel.setAttribute('aria-hidden', String(!open));
      toggle.setAttribute('aria-expanded', String(open));
    };
    const close = () => setOpen(false);
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
      if (open) control.querySelector(`input[value="${mode}"]`).focus();
    });
    control.addEventListener('change', event => {
      if (!event.target.matches('input[name="color-mode"]')) return;
      mode = valid(event.target.value);
      try { window.localStorage.setItem(key, mode); } catch { /* Keep this page usable. */ }
      apply();
    });
    document.addEventListener('click', event => {
      if (!control.contains(event.target)) close();
    });
    control.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        event.preventDefault();
        close();
        toggle.focus();
      }
    });
    control.addEventListener('focusout', event => {
      // Label clicks can briefly leave no focused element before selecting their radio.
      // Only dismiss for a known outside focus target; outside clicks are handled above.
      if (event.relatedTarget && !control.contains(event.relatedTarget)) close();
    });
    apply();
    control.hidden = false;
  });
})();
