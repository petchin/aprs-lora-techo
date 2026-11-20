import './style.css';
import { initUpdater } from './updater.js';
import { initConfig } from './config.js';

function initTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-tab]'));
  const panels = {
    update: document.getElementById('panel-update'),
    config: document.getElementById('panel-config'),
  };

  function show(name, push = true) {
    if (!panels[name]) name = 'update';
    for (const b of buttons) {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    for (const [key, el] of Object.entries(panels)) {
      if (el) el.classList.toggle('hidden', key !== name);
    }
    if (push && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  for (const b of buttons) {
    b.addEventListener('click', () => show(b.dataset.tab));
  }
  window.addEventListener('hashchange', () => show((location.hash || '#update').slice(1), false));
  show((location.hash || '#update').slice(1), false);
}

initTabs();
initUpdater();
initConfig();
