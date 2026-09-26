(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.querySelector('.main-menu');
    const links = [...document.querySelectorAll('.main-menu [data-section-link]')];
    const home = document.querySelector('.ui-home');
    function select(id) {
      links.forEach(link => {
        const active = link.dataset.sectionLink === id;
        link.classList.toggle('menu-item-active', active);
        if (active) link.setAttribute('aria-current', home ? 'location' : 'page');
        else link.removeAttribute('aria-current');
      });
      menu?.dispatchEvent(new Event('ui:selection'));
    }
    if (home) {
      const sections = [...home.querySelectorAll('section[id]')];
      const ids = sections.map(section=>section.id);
      let locked = false;
      let timer;
      let frame;
      function update() {
        frame = null;
        if (locked) return;
        const marker = Math.max(140, Math.min(window.innerHeight * .36, 320));
        let id = 'home';
        for (const section of sections) if (section.getBoundingClientRect().top <= marker) id = section.id;
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3) id = 'about';
        select(id);
      }
      function release() { locked = false; clearTimeout(timer); update(); }
      function go(id) {
        if (!ids.includes(id)) return;
        locked = true;
        select(id);
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        if (id === 'home') window.scrollTo({top:0,behavior});
        else document.getElementById(id).scrollIntoView({block:'start',behavior});
        clearTimeout(timer);
        timer = setTimeout(release, 300);
      }
      document.addEventListener('click', event => {
        const link = event.target.closest('a[data-section-link]');
        if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const id = link.dataset.sectionLink;
        if (!ids.includes(id)) return;
        event.preventDefault();
        if (window.location.hash !== `#${id}`) window.history.pushState(null,'',`#${id}`);
        go(id);
      });
      window.addEventListener('scroll', () => {
        if (locked) { clearTimeout(timer); timer = setTimeout(release,180); }
        else if (!frame) frame = requestAnimationFrame(update);
      }, {passive:true});
      window.addEventListener('resize', update);
      window.addEventListener('hashchange', () => go(window.location.hash.slice(1) || 'home'));
      // Native cross-page anchors and back/forward navigation remain real URLs.
      const initial = window.location.hash.slice(1);
      if (ids.includes(initial)) requestAnimationFrame(()=>go(initial));
      else update();
    } else if (menu) {
      select(document.querySelector('.main-inner.archive') ? 'archive' : document.querySelector('.tag-cloud') ? 'tags' : 'articles');
    }

    const filters = document.querySelector('.glass-filters');
    filters?.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      filters.querySelectorAll('[data-filter]').forEach(item => {
        item.classList.toggle('is-selected', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      document.querySelectorAll('[data-story-panel]').forEach(panel => {
        panel.hidden = panel.dataset.storyPanel !== button.dataset.filter;
        if (!panel.hidden) {
          document.getElementById('visible-count').textContent = String(Math.min(10,Number(panel.dataset.count))).padStart(2,'0');
          document.getElementById('total-count').textContent = panel.dataset.count.padStart(2,'0');
        }
      });
      filters.dispatchEvent(new Event('ui:selection'));
    });
    document.querySelectorAll('[data-tag]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-tag]').forEach(item => {
        item.classList.toggle('is-active',item===button);
        item.setAttribute('aria-pressed',String(item===button));
      });
      document.querySelectorAll('[data-tag-panel]').forEach(panel => { panel.hidden = panel.dataset.tagPanel !== button.dataset.tag; });
    }));
    const search = document.getElementById('category-search');
    search?.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      let count = 0;
      document.querySelectorAll('.directory-card').forEach(card => {
        card.hidden = !card.dataset.search.includes(query);
        if (!card.hidden) count++;
      });
      document.getElementById('category-index-count').textContent = `${count} 个分类`;
      document.querySelector('.category-empty').hidden = count > 0;
    });
  });
})();
