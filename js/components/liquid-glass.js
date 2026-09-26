/*
 * Shared liquid glass surfaces. Displacement math adapted from Shu Ding's
 * liquid-glass (MIT): /licenses/liquid-glass.txt. All presets use this renderer.
 */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const surfaces = new WeakMap();
  const groups = new WeakMap();
  const transparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
  let sequence = 0;
  let registry;

  function svg(tag, attributes = {}) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }
  function smoothStep(a, b, value) {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function roundedRectSDF(x, y, halfWidth, halfHeight, radius) {
    const qx = Math.abs(x) - halfWidth + radius;
    const qy = Math.abs(y) - halfHeight + radius;
    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  }
  function createFilter(layer, preset) {
    if (transparency.matches || !window.CSS?.supports('backdrop-filter', 'url("#glass") blur(1px)')) return null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;
    if (!registry) {
      registry = svg('svg', {width: 0, height: 0, 'aria-hidden': 'true', class: 'liquid-glass-registry'});
      document.body.append(registry);
    }
    const id = `liquid-glass-${++sequence}`;
    const filter = svg('filter', {id, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB'});
    const mapImage = svg('feImage', {result: 'map', preserveAspectRatio: 'none'});
    const displacement = svg('feDisplacementMap', {in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G'});
    filter.append(mapImage, displacement);
    registry.append(filter);
    const reference = preset === 'lens' || preset === 'float';
    const finish = reference ? 'blur(.25px) contrast(1.2) brightness(1.05) saturate(1.1)' : 'blur(12px) contrast(1.2) brightness(1.05) saturate(1.1)';
    layer.style.backdropFilter = `url("#${id}") ${finish}`;
    let oldSize = '';
    return {
      resize(width, height) {
        if (width <= 0 || height <= 0) return;
        // Cap map resolution; its SVG dimensions still match the actual surface.
        const ratio = Math.min(1, 1000 / width, 320 / height);
        const w = Math.max(1, Math.round(width * ratio));
        const h = Math.max(1, Math.round(height * ratio));
        const size = `${width}:${height}`;
        if (size === oldSize) return;
        oldSize = size;
        canvas.width = w;
        canvas.height = h;
        for (const node of [filter, mapImage]) {
          node.setAttribute('width', width);
          node.setAttribute('height', height);
        }
        filter.setAttribute('x', '0');
        filter.setAttribute('y', '0');
        const map = context.createImageData(w, h);
        const raw = reference ? new Float32Array(w * h * 2) : null;
        let maxScale = 0;
        const strength = preset === 'bar' ? 8 : 12;
        const scale = Math.max(30, strength * 2);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (reference) {
            const ix = x / w - .5;
            const iy = y / h - .5;
            const distance = roundedRectSDF(ix, iy, .3, .2, .6);
            const scaled = smoothStep(0, 1, smoothStep(.8, 0, distance - .15));
            const dx = (ix * scaled + .5) * w - x;
            const dy = (iy * scaled + .5) * h - y;
            raw[i * 2] = dx;
            raw[i * 2 + 1] = dy;
            maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
          } else {
            const radius = Math.max(2, Math.min(w, h) / 2 - 1);
            const distance = roundedRectSDF(x - w / 2, y - h / 2, w / 2 - 1, h / 2 - 1, radius);
            const edge = smoothStep(-Math.min(11, h * .29), 0, distance);
            map.data[i * 4] = 128 + (w / 2 - x) / w * edge * strength / scale * 255;
            map.data[i * 4 + 1] = 128 + (h / 2 - y) / h * edge * strength / scale * 255;
          }
          map.data[i * 4 + 3] = 255;
        }
        maxScale = Math.max(maxScale * .5, .001);
        if (reference) for (let i = 0; i < w * h; i++) {
          map.data[i * 4] = (raw[i * 2] / maxScale + .5) * 255;
          map.data[i * 4 + 1] = (raw[i * 2 + 1] / maxScale + .5) * 255;
        }
        context.putImageData(map, 0, 0);
        mapImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL());
        displacement.setAttribute('scale', (reference ? maxScale : scale) / ratio);
      },
      destroy() {
        layer.style.backdropFilter = '';
        filter.remove();
        if (!registry.childElementCount) { registry.remove(); registry = null; }
      }
    };
  }

  function mount(host, {preset = 'control', observe = true} = {}) {
    if (surfaces.has(host)) return surfaces.get(host);
    const layer = document.createElement('span');
    layer.className = 'liquid-glass-surface';
    layer.dataset.preset = preset;
    layer.setAttribute('aria-hidden', 'true');
    host.classList.add('liquid-glass-host');
    host.prepend(layer);
    let filter;
    let disposed = false;
    const resize = (width = host.clientWidth, height = host.clientHeight) => filter?.resize(width, height);
    const refresh = () => {
      filter?.destroy();
      filter = createFilter(layer, preset);
      resize();
    };
    refresh();
    const observer = observe && window.ResizeObserver ? new window.ResizeObserver(() => resize()) : null;
    observer?.observe(host);
    transparency.addEventListener?.('change', refresh);
    const instance = {
      resize,
      destroy() {
        if (disposed) return;
        disposed = true;
        observer?.disconnect();
        transparency.removeEventListener?.('change', refresh);
        filter?.destroy();
        layer.remove();
        host.classList.remove('liquid-glass-host');
        surfaces.delete(host);
      }
    };
    surfaces.set(host, instance);
    return instance;
  }

  function group(host, {items, active}) {
    if (groups.has(host)) return groups.get(host);
    const indicator = document.createElement(host.tagName === 'UL' ? 'li' : 'span');
    indicator.className = 'liquid-glass-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    host.prepend(indicator);
    host.classList.add('liquid-glass-group');
    const surface = mount(indicator, {preset: 'lens', observe: false});
    const cleanups = [];
    const listen = (node, type, handler) => {
      node.addEventListener(type, handler);
      cleanups.push(() => node.removeEventListener(type, handler));
    };
    let disposed = false;
    function position(item) {
      if (disposed) return;
      indicator.hidden = !item;
      if (!item) return;
      const bounds = host.getBoundingClientRect();
      const rect = item.getBoundingClientRect();
      indicator.style.width = `${rect.width}px`;
      indicator.style.height = `${rect.height}px`;
      indicator.style.transform = `translate3d(${rect.left - bounds.left - host.clientLeft}px, ${rect.top - bounds.top - host.clientTop}px, 0)`;
      surface.resize(rect.width, rect.height);
    }
    const reset = () => position(active());
    items.forEach(item => {
      listen(item, 'pointerenter', event => { if (event.pointerType !== 'touch') position(item); });
      listen(item, 'focus', () => position(item));
    });
    listen(host, 'pointerleave', reset);
    listen(host, 'focusout', event => { if (!host.contains(event.relatedTarget)) reset(); });
    const observer = window.ResizeObserver ? new window.ResizeObserver(reset) : null;
    observer?.observe(host);
    document.fonts?.ready.then(reset);
    reset();
    const instance = { refresh: reset, destroy() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      cleanups.forEach(cleanup => cleanup());
      surface.destroy();
      indicator.remove();
      host.classList.remove('liquid-glass-group');
      groups.delete(host);
    }};
    groups.set(host, instance);
    return instance;
  }

  // Decorative lenses share the same surface renderer. No content is copied.
  function fixedLens(stage) {
    const lens = document.createElement('div');
    lens.className = 'liquid-glass-float is-initializing';
    lens.setAttribute('aria-hidden', 'true');
    stage.append(lens);
    const surface = mount(lens, {preset: 'float'});
    let drag = null;
    const anchor = () => {
      const title = stage.querySelector('h1');
      if (title) {
        const bounds = stage.getBoundingClientRect();
        const rect = title.getBoundingClientRect();
        lens.style.left = `${Math.max(0, Math.min(stage.clientWidth - lens.offsetWidth, rect.left - bounds.left - 4))}px`;
        lens.style.top = `${Math.max(0, Math.min(stage.clientHeight - lens.offsetHeight, rect.top - bounds.top - 32))}px`;
      }
      lens.style.transform = 'translate3d(0, 0, 0)';
      lens.classList.remove('is-initializing', 'is-dragging');
    };
    lens.addEventListener('pointerdown', event => {
      if (event.button !== 0 || transparency.matches) return;
      const rect = lens.getBoundingClientRect();
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, rect};
      lens.setPointerCapture(event.pointerId);
      lens.classList.add('is-dragging');
      event.preventDefault();
    });
    lens.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const bounds = stage.getBoundingClientRect();
      const x = Math.max(bounds.left - drag.rect.left, Math.min(bounds.right - drag.rect.right, event.clientX - drag.x));
      const y = Math.max(bounds.top - drag.rect.top, Math.min(bounds.bottom - drag.rect.bottom, event.clientY - drag.y));
      lens.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
    const finish = () => { drag = null; anchor(); };
    lens.addEventListener('pointerup', finish);
    lens.addEventListener('pointercancel', finish);
    lens.addEventListener('lostpointercapture', finish);
    const observer = window.ResizeObserver ? new window.ResizeObserver(finish) : null;
    observer?.observe(stage);
    requestAnimationFrame(anchor);
    return {destroy() { observer?.disconnect(); surface.destroy(); lens.remove(); }};
  }

  function readingLens(area) {
    const lens = document.createElement('div');
    lens.className = 'liquid-glass-reading';
    lens.hidden = true;
    lens.setAttribute('aria-hidden', 'true');
    document.body.append(lens);
    const surface = mount(lens, {preset: 'float', observe: false});
    const cleanups = [];
    const listen = (node, type, handler, options) => {
      node.addEventListener(type, handler, options);
      cleanups.push(() => node.removeEventListener(type, handler, options));
    };
    let drag = null;
    let frame = 0;
    let hold = 0;
    let lines = [];
    function stop() {
      drag = null;
      clearTimeout(hold);
      cancelAnimationFrame(frame);
      frame = 0;
      lens.hidden = true;
    }
    function collectLines() {
      const collected = [];
      const walker = document.createTreeWalker(area, 4);
      const range = document.createRange();
      while (walker.nextNode()) {
        const text = walker.currentNode;
        if (!text.textContent.trim() || text.parentElement.closest('button, input, textarea, script, style, [aria-hidden="true"]')) continue;
        range.selectNodeContents(text);
        const height = parseFloat(window.getComputedStyle(text.parentElement).lineHeight);
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) continue;
          collected.push({left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: Math.max(rect.height, height || 0) + 10});
        }
      }
      return collected;
    }
    function show(x, y) {
      let nearest;
      let distance = 46;
      for (const line of lines) {
        const d = Math.hypot(Math.max(line.left - x, 0, x - line.right), Math.max(line.top - y, 0, y - line.bottom));
        if (d < distance) { distance = d; nearest = line; }
      }
      const height = nearest?.height || 42;
      const width = window.innerWidth <= 650 ? 140 : 150;
      const centerY = nearest ? (nearest.top + nearest.bottom) / 2 : y;
      const left = Math.max(6, Math.min(window.innerWidth - width - 6, x - width / 2));
      const top = Math.max(6, Math.min(window.innerHeight - height - 6, centerY - height / 2));
      lens.style.width = `${width}px`;
      lens.style.height = `${height}px`;
      lens.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      surface.resize(width, height);
      lens.hidden = false;
    }
    listen(area, 'pointerdown', event => {
      if (event.button !== 0 || transparency.matches || event.target.closest('a, button, input, textarea, select, [contenteditable]')) return;
      stop();
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, ready: event.pointerType !== 'touch', touch: event.pointerType === 'touch'};
      lines = collectLines();
      if (drag.touch) hold = setTimeout(() => { if (drag) drag.ready = true; }, 220);
    }, {passive: true});
    listen(document, 'pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      if (!drag.ready) { if (distance > 10) stop(); return; }
      if (distance < 5) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = 0; show(event.clientX, event.clientY); });
    }, {passive: true});
    ['pointerup', 'pointercancel'].forEach(type => listen(document, type, stop));
    listen(window, 'blur', stop);
    listen(window, 'scroll', stop, {passive: true});
    listen(window, 'resize', stop);
    return {destroy() { stop(); cleanups.forEach(cleanup => cleanup()); surface.destroy(); lens.remove(); }};
  }

  window.LiquidGlass = {mount, group, fixedLens, readingLens};
})();
