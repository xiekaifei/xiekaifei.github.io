(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const toc = document.querySelector('.post-toc');
    if (toc?.querySelector('.nav-link')) {
      document.body.classList.add('ui-has-toc');
      // Keep NexT's scroll listener and nested-item activation, changing only
      // its viewport threshold to match the heading's CSS scroll margin.
      const native = window.NexT?.utils;
      if (native?.activateNavByIndex) {
        native.updateActiveNav = function() {
          if (!Array.isArray(this.sections) || !this.sections.length) return;
          const heading = this.sections.find(Boolean);
          const offset = heading ? parseFloat(window.getComputedStyle(heading).scrollMarginTop) || 0 : 0;
          const next = this.sections.findIndex(section => section?.getBoundingClientRect().top > offset + 1);
          this.activateNavByIndex(next === -1 ? this.sections.length - 1 : Math.max(0, next - 1));
        };
        native.updateActiveNav();
      }
      // NexT keeps its link handling and active-section tracking. Its scrollTo
      // has no header offset; align with CSS scroll-margin after that handler.
      toc.addEventListener('click', event => {
        const link = event.target.closest('a.nav-link');
        if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const id = decodeURIComponent(link.hash || link.getAttribute('href')).slice(1);
        document.getElementById(id)?.scrollIntoView({block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      });
    }
    const header = document.querySelector('header.header');
    const sidebar = document.querySelector('.sidebar');
    if (header && sidebar) {
      const updateDrawerOverlap = () => {
        const sidebarStyle = window.getComputedStyle(sidebar);
        const headerStyle = window.getComputedStyle(header);
        const viewportWidth = document.documentElement.clientWidth;
        const maxWidth = parseFloat(headerStyle.getPropertyValue('--ui-header-max-width'));
        const gutter = parseFloat(headerStyle.getPropertyValue('--ui-header-gutter'));
        // Always compare with the original centered bar, even while it is shifted.
        const originalLeft = (viewportWidth - Math.min(maxWidth, viewportWidth - gutter)) / 2;
        const overlaps = sidebarStyle.position === 'fixed' && sidebarStyle.display !== 'none'
          && sidebar.getBoundingClientRect().width > originalLeft;
        document.body.classList.toggle('ui-drawer-overlaps-header', overlaps);
      };
      updateDrawerOverlap();
      window.addEventListener('resize', updateDrawerOverlap);
    }
    const glass = window.LiquidGlass;
    if (!glass) return; // Content and native controls work without decorative JS.
    const disposables = [];
    const menu = document.querySelector('.main-menu');
    const intro = document.querySelector('.ui-home .hero');
    const article = document.querySelector('.main-inner.post .post-content');
    if (header) disposables.push(glass.mount(header, {preset: intro ? 'bar' : 'panel'}));
    document.querySelectorAll('.ui-icon-button, .theme-switch-toggle').forEach(control => {
      disposables.push(glass.mount(control));
    });
    document.querySelectorAll('.glass-cta').forEach(control => disposables.push(glass.mount(control, {preset: 'cta'})));
    document.querySelectorAll('.theme-switch-panel, .search-popup').forEach(panel => {
      disposables.push(glass.mount(panel, {preset: 'panel'}));
    });
    if (menu) {
      const links = [...menu.querySelectorAll('.menu-item:not(.menu-item-search) > a')];
      const active = () => links.find(link => link.classList.contains('menu-item-active'));
      const group = glass.group(menu, {items: links, active});
      menu.addEventListener('ui:selection', group.refresh);
      disposables.push(group);
    }
    const filters = document.querySelector('.glass-filters');
    if (filters) {
      const group = glass.group(filters, {items:[...filters.querySelectorAll('.glass-item')], active:()=>filters.querySelector('.is-selected')});
      filters.addEventListener('ui:selection', group.refresh);
      disposables.push(group);
    }
    if (intro) {
      disposables.push(glass.fixedLens(intro));
      const updateContrast = () => {
        if (!header) return;
        const bar = header.getBoundingClientRect();
        const stage = intro.getBoundingClientRect();
        header.classList.toggle('ui-over-dark', bar.bottom > stage.top + 4 && bar.top < stage.bottom - 4);
      };
      updateContrast();
      window.addEventListener('scroll', updateContrast, {passive:true});
      window.addEventListener('resize', updateContrast);
      disposables.push({destroy() {
        window.removeEventListener('scroll', updateContrast);
        window.removeEventListener('resize', updateContrast);
      }});
    }
    if (article) disposables.push(glass.readingLens(article));
    window.addEventListener('pagehide', event => {
      if (!event.persisted) disposables.forEach(instance => instance.destroy());
    });
  });
})();
