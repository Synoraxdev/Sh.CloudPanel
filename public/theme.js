'use strict';
(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'dark';
  try { preference = localStorage.getItem('shcloudpanel-theme') || 'dark'; } catch {}
  if (!['light', 'dark', 'system'].includes(preference)) preference = 'system';
  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f6f6f4');
    window.dispatchEvent(new CustomEvent('shcloudpanel-theme-change', { detail: { preference, theme } }));
  }
  window.SHCloudPanelTheme = {
    get preference() { return preference; },
    get theme() { return document.documentElement.dataset.theme; },
    set(value) {
      if (!['light', 'dark', 'system'].includes(value)) return;
      preference = value;
      try { localStorage.setItem('shcloudpanel-theme', value); } catch {}
      apply();
    }
  };
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => { if (event.key === 'shcloudpanel-theme') window.SHCloudPanelTheme.set(event.newValue || 'system'); });
  apply();
})();
