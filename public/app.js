'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const GIB = 1024 ** 3, MIB = 1024 ** 2;
const storage = { get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, value); } catch {} }, remove(key) { try { localStorage.removeItem(key); } catch {} } };
const state = { config: {}, user: null, csrf: '', view: 'files', parent: null, entries: [], crumbs: [], search: '', sort: 'updated', layout: storage.get('shcloudpanel-layout') || 'list', selected: new Set(), loading: false, uploading: false, maxUpload: 0, chunkSize: 20 * MIB, generation: 0, transfer: null };
const paths = {
 cloud:'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
 home:'m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
 folder:'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
 clock:'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
 star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
 image:'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21M10 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
 trash:'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
 users:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M15 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-3.9M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 settings:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
 shield:'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1ZM9 12l2 2 4-4',
 search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
 upload:'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6',
 download:'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
 plus:'M12 5v14M5 12h14', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6',
 grid:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
 list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
 file:'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4',
 archive:'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
 video:'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM16 13l5.22 3.48a.5.5 0 0 0 .78-.42V7.94a.5.5 0 0 0-.75-.43L16 10.5',
 music:'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 more:'M5 12h.01M12 12h.01M19 12h.01', close:'m6 6 12 12M6 18 18 6',
 logout:'M9 21H3V3h6M8 12h13m-5-5 5 5-5 5', lock:'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM7 11V7a5 5 0 0 1 10 0v4',
 drive:'M22 12H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11ZM6 16h.01M10 16h.01',
 help:'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 edit:'m15 3 6 6-12 12H3v-6L15 3Zm-3 3 6 6', restore:'M3 3v6h6M3 9a9 9 0 1 1 1 9M12 8v5l3 2',
 check:'m5 12 4 4L19 6', menu:'M3 6h18M3 12h18M3 18h18',
 activity:'M3 12h4l3-8 4 16 3-8h4', move:'M12 3v18M3 12h18m-9-9-3 3m3-3 3 3m-3 15-3-3m3 3 3-3M3 12l3-3m-3 3 3 3m15-3-3-3m3 3-3 3',
 mail:'M3 5h18v14H3V5Zm0 0 9 8 9-8', spark:'m12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7',
 sun:'M12 3v1m0 16v1M3 12h1m16 0h1M5.6 5.6l.7.7m11.4 11.4.7.7m0-12.8-.7.7M6.3 17.7l-.7.7M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
 moon:'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z', monitor:'M3 4h18v13H3V4Zm5 17h8m-4-4v4', pause:'M8 5v14M16 5v14', arrow:'M4 12h16m-5-5 5 5-5 5', cloudup:'M12 13v8M8 17l4-4 4 4M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29', server:'M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2ZM6 6h.01M6 18h.01', doc:'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8', pdf:'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M9 18v-6h1.5a1.5 1.5 0 0 1 0 3H9M14.5 18v-6', sheet:'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M8 13h2M14 13h2M8 17h2M14 17h2', slides:'M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5', code:'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M10 12.5 8 15l2 2.5M14 12.5l2 2.5-2 2.5'
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const button = (action, name, title, cls = '') => `<button type="button" class="icon-btn ${cls}" data-action="${action}" title="${esc(title)}" aria-label="${esc(title)}">${icon(name)}</button>`;
function size(bytes) { if (!bytes) return '0 B'; const units = ['B','KB','MB','GB','TB']; const n = Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),4); return `${(bytes/1024**n).toFixed(n > 1 ? 1 : 0)} ${units[n]}`; }
const date = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const initials = value => value.trim().split(/\s+/).map(s => [...s][0]).slice(0,2).join('').toUpperCase();
function fileType(entry) {
  if (entry.kind === 'folder') return { icon:'folder', color:'', label:'Folder' };
  const ext = entry.name.includes('.') ? entry.name.split('.').pop().toLowerCase() : '';
  if (entry.mime.startsWith('image/')) return { icon:'image', color:'', label:'Image' };
  if (['zip','rar','7z','gz','tar'].includes(ext)) return { icon:'archive', color:'', label:'Archive' };
  if (['mp4','mkv','mov','webm'].includes(ext)) return { icon:'video', color:'', label:'Video' };
  if (['mp3','wav','flac','ogg'].includes(ext)) return { icon:'music', color:'', label:'Audio' };
  if (ext === 'pdf') return { icon:'pdf', color:'', label:'Document' };
  if (['xls','xlsx','csv'].includes(ext)) return { icon:'sheet', color:'', label:'Document' };
  if (['ppt','pptx'].includes(ext)) return { icon:'slides', color:'', label:'Document' };
  if (['doc','docx','txt','md'].includes(ext)) return { icon:'doc', color:'', label:'Document' };
  if (['js','mjs','ts','tsx','jsx','py','json','html','css','sh','php','go','rs','java','c','cpp','sql','yml','yaml'].includes(ext)) return { icon:'code', color:'', label:'Code' };
  return { icon:'file', color:'', label: ext && ext.length < 9 ? ext.toUpperCase() : 'File' };
}
const tile = (name,color = '') => `<div class="tile-icon ${color}">${icon(name)}</div>`;
function toast(message, error = false) { const div = document.createElement('div'); div.className = `toast ${error ? 'error' : ''}`; div.textContent = message; $('#toast').append(div); setTimeout(() => div.remove(), 4500); }
async function api(route, options = {}) {
  const headers = { ...options.headers };
  if (options.body && typeof options.body !== 'string') { options.body = JSON.stringify(options.body); headers['Content-Type'] = 'application/json'; }
  if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = state.csrf;
  const response = await fetch(route, { ...options, headers, credentials: 'same-origin' });
  let data;
  try { data = await response.json(); } catch { const error = new Error('The server returned an unexpected response. Please try again.'); error.status = response.status; throw error; }
  if (!response.ok) {
    if (response.status === 401 && state.user && !route.startsWith('/api/auth/')) { state.transfer?.xhr?.abort(); state.transfer?.controller?.abort(); if (state.transfer) state.transfer.mode = 'pause'; state.user = null; closeModal(true); renderAuth(); }
    const error = new Error(data.error || 'Request failed.'); error.status = response.status; throw error;
  }
  return data;
}
function applyBrand() {
  const c = state.config;
  document.title = c.siteName || 'SHCloudPanel';
  // Legacy purple and the SHCloudPanel green mean "use the theme's own accent"; any other owner-chosen color is applied.
  const custom = c.accent && !['#7367f0', '#4ade80', '#0a0a0a', '#fafafa', '#ffffff'].includes(c.accent.toLowerCase());
  const root = document.documentElement.style;
  if (custom) { root.setProperty('--accent', c.accent); root.setProperty('--accent-text', c.accent); root.setProperty('--accent-soft', `${c.accent}18`); }
  else { root.removeProperty('--accent'); root.removeProperty('--accent-text'); root.removeProperty('--accent-soft'); }
  $('#favicon').href = c.favicon || '/mark.svg';
  $('#favicon').type = c.favicon ? c.favicon.split(';')[0].slice(5) : 'image/svg+xml';
  $$('[data-brand-name]').forEach(el => el.textContent = c.siteName);
  $$('[data-brand-logo]').forEach(el => el.src = c.logo || '/mark.svg');
}
function appearanceControl() { return `<button type="button" class="theme-control" data-action="appearance" aria-label="Change appearance" title="Change appearance">${icon(window.SHCloudPanelTheme?.theme === 'dark' ? 'moon' : 'sun')}<span>Appearance</span></button>`; }
function updateAppearance() {
  $$('[data-action="appearance"]').forEach(el => el.innerHTML = `${icon(window.SHCloudPanelTheme?.theme === 'dark' ? 'moon' : 'sun')}<span>Appearance</span>`);
  $$('[data-theme-choice]').forEach(el => { const selected = el.dataset.themeChoice === window.SHCloudPanelTheme?.preference; el.classList.toggle('active', selected); el.setAttribute('aria-pressed', String(selected)); });
}
function appearance() {
  modal('Make yourself comfortable', `<p>Choose the look that feels right. Your preference stays on this browser.</p><div class="theme-options">${[['light','sun','Light','Clean and bright'],['dark','moon','Dark','Calm after hours'],['system','monitor','System','Follows your device']].map(([value,name,label,description]) => `<button type="button" data-theme-choice="${value}" class="theme-option" aria-pressed="false"><span class="theme-swatch ${value}">${icon(name)}</span><strong>${label}</strong><small>${description}</small>${icon('check','theme-check')}</button>`).join('')}</div>`, '<button class="btn" data-action="close-modal">Done</button>');
  updateAppearance();
}
window.addEventListener('shcloudpanel-theme-change', updateAppearance);
const brand = () => `<div class="brand"><img data-brand-logo src="${esc(state.config.logo || '/mark.svg')}" alt=""><span data-brand-name>${esc(state.config.siteName)}</span></div>`;

function renderAuth(register = false) {
  state.generation++;
  $('#app').innerHTML = `<div class="auth"><aside class="auth-art">${brand()}<div class="auth-copy"><div class="eyebrow">STORAGE CONSOLE</div><h1>Secure cloud storage, <br>managed from one place.</h1><p>Private, encrypted file storage on your own infrastructure, with role-based access, quotas and resumable transfers.</p></div><ul class="auth-points"><li>${icon('shield')}<div><strong>AES-256-GCM encryption</strong><small>Every file is encrypted at rest on the server.</small></div></li><li>${icon('upload')}<div><strong>Resumable large uploads</strong><small>Chunked transfers with pause, retry and resume.</small></div></li><li>${icon('users')}<div><strong>Role-based access</strong><small>Separate owner, administrator and member permissions.</small></div></li></ul><div class="auth-foot">${icon('shield')}Self-hosted. Private by design.</div></aside><main class="auth-main"><div class="auth-appearance">${appearanceControl()}</div><div class="auth-form"><div class="eyebrow">SECURE SIGN IN</div><h2>${register ? 'Create your account' : 'Sign in to your account'}</h2><p>${register ? 'Create an account to start storing your files securely.' : 'Enter your credentials to access your storage.'}</p>${state.config.setupRequired ? '<div class="setup">Your cloud is ready for its owner.<br>Finish setup in your server terminal:<code>npm run setup</code>Then sign in with the owner account.</div>' : ''}<form id="auth-form" data-register="${register}">${register ? '<div class="field"><label for="displayName">Your name</label><input id="displayName" name="displayName" autocomplete="name" maxlength="60" placeholder="Alex Morgan" required></div><div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" minlength="3" maxlength="32" pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}" placeholder="alex.morgan" required></div>' : ''}<div class="field"><label for="identifier">${register ? 'Email address' : 'Email or username'}</label><input id="identifier" name="${register ? 'email' : 'identifier'}" type="${register ? 'email' : 'text'}" autocomplete="${register ? 'email' : 'username'}" placeholder="${register ? 'you@gmail.com' : 'you@gmail.com or your username'}" maxlength="254" required></div><div class="field"><label for="password">Password</label><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" ${register ? 'minlength="8"' : ''} maxlength="128" placeholder="${register ? 'At least 8 characters' : 'Enter your password'}" required>${button('toggle-password','eye','Show password')}</div>${register ? '<small>Use at least 8 characters. A long passphrase works well.</small>' : ''}</div>${!register ? '<div class="auth-options"><label><input type="checkbox" name="remember">Keep me signed in for 7 days</label><button type="button" class="text-button" data-action="login-help">Need help?</button></div>' : ''}<div id="auth-error" hidden class="modal-error" role="alert"></div><button type="submit" class="btn full">${register ? 'Create account' : 'Sign in'}${icon('chevron')}</button></form><div class="auth-divider">or continue with</div><button class="google-button" disabled title="Google login will be configured in a later version"><span class="google-g">G</span>Google<span class="coming">Coming soon</span></button><div class="auth-switch">${register ? 'Already have an account? <button data-action="auth-login">Sign in</button>' : state.config.registrationEnabled && !state.config.setupRequired ? 'New here? <button data-action="auth-register">Create an account</button>' : 'Registration is closed. Contact your cloud owner.'}</div><div class="auth-privacy">Your files stay on this cloud’s server. Your password stays private.<br><a class="discord-link" href="https://dsc.gg/hozvikcloud" target="_blank" rel="noopener noreferrer">Join our official Discord</a></div></div></main></div>`;
  if (register) $('.auth-form > p').textContent = `Create an account with ${size(state.config.defaultQuota ?? 5 * GIB)} of private storage.`;
  else if (state.config.tagline) $('.auth-form > p').textContent = state.config.tagline;
  applyBrand();
}
const NAV = [['files','folder','My files'],['recent','clock','Recent'],['starred','star','Starred'],['photos','image','Photos'],['trash','trash','Trash']];
const STAFF = [['users','users','Members'],['disk','drive','Disk & storage'],['settings','settings','Cloud settings'],['audit','activity','Activity log']];
const crumb = () => {
  const name = [...NAV, ...STAFF].find(v => v[0] === state.view)?.[2] || 'Overview';
  const group = ['users','disk','settings','audit'].includes(state.view) ? 'Administration' : 'Storage';
  return `<div class="crumb-line"><span>${group}</span><i>/</i><span>${esc(name)}</span></div>`;
};
function overview() {
  const u = state.user, pct = u.quota ? Math.min(100, u.used / u.quota * 100) : 100;
  const folders = state.entries.filter(e => e.kind === 'folder').length, files = state.entries.length - folders;
  const cell = (name, label, value, cls = '') => `<div class="ov-cell ${cls}"><span class="ov-label">${icon(name)}${label}</span>${value}</div>`;
  return `<section class="overview" aria-label="Account overview">${cell('drive','Storage used',`<strong>${size(u.used)} <small>of ${size(u.quota)}</small></strong><div class="progress${pct >= 90 ? ' high' : ''}" style="--progress:${pct}%"><i></i></div>`,'ov-wide')}${cell('cloud','Available',`<strong>${size(Math.max(0, u.quota - u.used))}</strong>`)}${cell('folder','Folders',`<strong>${folders}</strong>`)}${cell('file','Files',`<strong>${files}</strong>`)}${cell('lock','Encryption','<strong class="ov-status"><i class="status-dot"></i>AES-256-GCM</strong>')}</section>`;
}
function dropzone() {
  return `<button type="button" class="dropzone" data-action="upload">${tile('cloudup')}<div><strong>Upload files</strong><small>Drag and drop anywhere on this page, or browse. Large files upload in resumable parts.</small></div><span class="dz-cta">Browse files</span></button>`;
}
function kindTabs() {
  const files = state.entries.filter(e => e.kind === 'file');
  const count = k => k === 'All' ? state.entries.length : files.filter(e => k === 'Other' ? !['Image','Document','Archive'].includes(fileType(e).label) : fileType(e).label === k).length;
  return `<div class="kind-tabs" role="tablist">${[['All','All'],['Image','Images'],['Document','Documents'],['Archive','Archives'],['Other','Other']].map(([k,l]) => `<button type="button" role="tab" data-category="${k}" class="${k === 'All' ? 'active' : ''}">${l}<span>${count(k)}</span></button>`).join('')}</div>`;
}
function renderShell() {
  const staff = state.user.role !== 'member';
  $('#app').innerHTML = `<div class="screen-shade" data-action="close-sidebar"></div><header class="topbar">${button('toggle-sidebar','menu','Open navigation','mobile-menu')}${brand()}<div class="search">${icon('search')}<input id="search" placeholder="Search files…" aria-label="Search files"><span class="kbd">Ctrl K</span></div><div class="topbar-right">${appearanceControl()}${button('help','help','Help')}<div class="topbar-separator"></div><button class="profile" data-action="account" aria-label="Open account settings"><div class="avatar ${state.user.role}">${esc(initials(state.user.displayName))}</div><div class="profile-text"><div class="name">${esc(state.user.displayName)}</div><div class="role">${state.user.role}</div></div>${icon('down')}</button></div></header><aside class="sidebar"><div class="nav-label">STORAGE</div><nav class="nav">${NAV.map(([view,name,label]) => `<button data-view="${view}">${icon(name)}${label}</button>`).join('')}</nav>${staff ? `<div class="nav-label">${state.user.role === 'owner' ? 'MANAGEMENT' : 'ADMINISTRATION'}</div><nav class="nav">${STAFF.filter(([v]) => state.user.role === 'owner' || v === 'users' || v === 'disk').map(([view,name,label]) => `<button data-view="${view}">${icon(name)}${label}${view === 'settings' ? '<span class="count">OWNER</span>' : ''}</button>`).join('')}</nav>` : ''}<div class="storage-widget" id="storage-widget"></div><div class="sidebar-foot">© ${new Date().getFullYear()} ${esc(state.config.siteName)} · <a class="discord-link" href="https://dsc.gg/hozvikcloud" target="_blank" rel="noopener noreferrer">Discord</a></div></aside><div class="workspace"><main class="content" id="content"></main></div>`;
  applyBrand(); updateUsage(); markNav();
}
function updateUsage() {
  if (!state.user || !$('#storage-widget')) return;
  const u = state.user, percent = u.quota ? Math.min(100,u.used/u.quota*100) : 100;
  $('#storage-widget').innerHTML = `<div class="storage-box"><div class="storage-head">${icon('cloud')}Your storage<span style="margin-left:auto;color:var(--muted);font-size:10px">${percent.toFixed(0)}%</span></div><div class="progress${percent >= 90 ? ' high' : ''}" style="--progress:${percent}%"><i></i></div><div class="storage-caption"><strong>${size(u.used)}</strong> of ${size(u.quota)} used</div><button class="text-button" data-action="storage-help" style="padding:10px 0 0">Storage details ${icon('chevron')}</button></div>`;
}
function markNav() { $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view)); }
function closeSidebar() { $('.sidebar')?.classList.remove('open'); $('.screen-shade')?.classList.remove('open'); }
async function navigate(view, parent = null) {
  if (state.uploading && ['users','disk','settings','audit'].includes(view)) { toast('Finish the current upload first.'); return; }
  state.view = view; state.parent = parent; state.selected.clear(); state.search = ''; if ($('#search')) $('#search').value = ''; closeSidebar(); markNav(); await loadView();
}
async function loadView() {
  const generation = ++state.generation;
  if (!$('#content')) return;
  $('#content').innerHTML = '<div class="skeleton" aria-label="Loading"></div>';
  try {
    if (state.view === 'users') { const result = await api('/api/admin/users'); if (generation === state.generation) renderUsers(result.users); return; }
    if (state.view === 'disk') { const result = await api('/api/admin/disk'); if (generation === state.generation) renderDisk(result); return; }
    if (state.view === 'settings') { const result = await api('/api/admin/overview'); if (generation === state.generation) renderSettings(result); return; }
    if (state.view === 'audit') { const result = await api('/api/admin/audit'); if (generation === state.generation) renderAudit(result.events); return; }
    const params = new URLSearchParams({ view: state.view });
    if (state.parent) params.set('parent', state.parent); if (state.search) params.set('q',state.search);
    const result = await api(`/api/entries?${params}`);
    if (generation !== state.generation || !state.user) return;
    state.entries = result.entries; state.crumbs = result.breadcrumbs; state.user = result.user; state.total = result.total; updateUsage(); renderFiles();
  } catch (error) { if (generation === state.generation && $('#content')) $('#content').innerHTML = `<div class="inline-error">${esc(error.message)}<br><button class="btn secondary" data-action="refresh" style="margin-top:16px">Try again</button></div>`; }
}
function sortedEntries() {
  return [...state.entries].sort((a,b) => a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : state.sort === 'name' ? a.name.localeCompare(b.name) : state.sort === 'size' ? b.size-a.size : b.updatedAt-a.updatedAt);
}
function renderFiles() {
  const view = state.view, root = view === 'files' && !state.parent && !state.search;
  const title = state.search ? 'Search results' : NAV.find(v => v[0] === view)?.[2] || 'My files';
  const desc = {files:'Browse and manage the files stored in your private cloud.',recent:'Files you added or changed recently.',starred:'Files and folders you marked as favorites.',photos:'Image files stored in your account.',trash:'Deleted items stay here until you remove them permanently.'};
  const folders = state.entries.filter(e => e.kind === 'folder'), rows = sortedEntries();
  const categories = [{label:'Photos',icon:'image',color:'blue',kind:'Image'},{label:'Documents',icon:'file',color:'',kind:'Document'},{label:'Archives',icon:'archive',color:'orange',kind:'Archive'},{label:'Other files',icon:'grid',color:'green',kind:'Other'}];
  $('#content').innerHTML = `<div class="page-heading"><div>${crumb()}<h1>${esc(title)}</h1><p>${state.search ? `Results for “${esc(state.search)}”` : desc[view]}</p></div><div class="heading-actions">${view === 'trash' ? '<button class="btn secondary" data-action="empty-trash">'+icon('trash')+'Empty trash</button>' : '<button class="btn secondary" data-action="new-folder">'+icon('plus')+'New folder</button><button class="btn" data-action="upload">'+icon('upload')+'Upload files</button>'}</div></div>${state.user.used >= state.user.quota ? '<div class="notice">'+icon('drive')+'Your storage is full. Empty trash or ask your administrator for more space.</div>' : ''}${root ? overview() : ''}${state.parent && !state.search ? `<div class="breadcrumbs"><button data-parent="">My files</button>${state.crumbs.map((p,i) => icon('chevron') + (i === state.crumbs.length-1 ? `<span>${esc(p.name)}</span>` : `<button data-parent="${p.id}">${esc(p.name)}</button>`)).join('')}</div>` : ''}${view === 'files' && !state.search ? dropzone() : ''}<div class="file-panel"><div class="file-toolbar"><h2>${state.parent ? esc(state.crumbs.at(-1)?.name || 'Folder') : root ? 'All files' : esc(title)}</h2><div class="toolbar-controls"><select id="sort" aria-label="Sort files"><option value="updated" ${state.sort === 'updated' ? 'selected' : ''}>Last modified</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Name A–Z</option><option value="size" ${state.sort === 'size' ? 'selected' : ''}>Largest first</option></select><div class="segmented"><button data-layout="list" class="${state.layout === 'list' ? 'active' : ''}" aria-label="List view">${icon('list')}</button><button data-layout="grid" class="${state.layout === 'grid' ? 'active' : ''}" aria-label="Grid view">${icon('grid')}</button></div></div></div>${view === 'files' && !state.search ? kindTabs() : ''}<div id="selection-toolbar"></div><div id="file-results">${rows.length ? state.layout === 'grid' ? fileGrid(rows) : fileTable(rows) : emptyState(view)}</div><div class="panel-foot"><span>${rows.length} ${rows.length === 1 ? 'item' : 'items'}${state.total > rows.length ? ` · showing first ${rows.length} of ${state.total}; use search to narrow results` : ''}</span><span class="security-note">${icon('shield')}Encrypted at rest · Only you can access your files</span></div></div>`;
  updateSelection();
}
function emptyState(view) {
  const messages = {files:['Your space, waiting for you.','Upload your first file or create a folder to get started.'],recent:['Nothing here just yet.','Your files will appear here as you add and update them.'],starred:['Keep your favorites close.','Tap the star beside a file or folder to find it here.'],photos:['Make room for your memories.','Upload PNG, JPEG, GIF or WebP images to see them here.'],trash:['A clean slate.','Files you move to trash will appear here.']};
  const [title,desc] = state.search ? ['No matches found.','Try another file name or a shorter search.'] : messages[view] || messages.files;
  return `<div class="empty">${tile(view === 'trash' ? 'trash' : view === 'starred' ? 'star' : view === 'photos' ? 'image' : 'cloud')}<h3>${title}</h3><p>${desc}</p>${view === 'files' && !state.search ? '<button class="btn soft" data-action="upload">'+icon('upload')+'Upload your first file</button>' : ''}</div>`;
}
function rowActions(e) {
  if (state.view === 'trash') return `<button class="icon-btn" data-entry-action="restore" data-id="${e.id}" aria-label="Restore ${esc(e.name)}" title="Restore">${icon('restore')}</button><button class="icon-btn danger" data-entry-action="purge" data-id="${e.id}" aria-label="Delete permanently" title="Delete permanently">${icon('trash')}</button>`;
  return `<button class="icon-btn ${e.starred ? 'starred-icon' : ''}" data-entry-action="star" data-id="${e.id}" aria-label="${e.starred ? 'Unstar' : 'Star'} ${esc(e.name)}" title="${e.starred ? 'Unstar' : 'Star'}">${icon('star')}</button>${e.kind === 'file' ? `<button class="icon-btn desktop-action" data-entry-action="download" data-id="${e.id}" aria-label="Download ${esc(e.name)}" title="Download">${icon('download')}</button>` : ''}<button class="icon-btn" data-entry-action="menu" data-id="${e.id}" aria-label="More actions for ${esc(e.name)}" title="More actions">${icon('more')}</button>`;
}
function fileTable(rows) {
  return `<table class="file-table"><thead><tr><th><input id="select-all" type="checkbox" aria-label="Select all files"></th><th>Name</th><th class="date-col">Last modified</th><th>Size</th><th class="type-col">Type</th><th style="text-align:right">Actions</th></tr></thead><tbody>${rows.map(e => { const type = fileType(e); return `<tr><td><input type="checkbox" data-select="${e.id}" aria-label="Select ${esc(e.name)}" ${state.selected.has(e.id) ? 'checked' : ''}></td><td><button class="file-name" data-open="${e.id}">${e.mime.startsWith('image/') && !e.deletedAt ? `<img class="thumb" loading="lazy" src="/api/entries/${e.id}/download?preview=1" alt="">` : tile(type.icon,type.color)}<strong>${esc(e.name)}</strong></button></td><td class="date-col">${date(e.updatedAt)}</td><td class="nowrap">${e.kind === 'folder' ? '—' : size(e.size)}</td><td class="type-col"><span class="badge">${esc(type.label)}</span></td><td><div class="actions">${rowActions(e)}</div></td></tr>`; }).join('')}</tbody></table>`;
}
function fileGrid(rows) {
  return `<div class="file-grid">${rows.map(e => { const type = fileType(e); return `<div class="grid-file"><button class="grid-preview" data-open="${e.id}" aria-label="Open ${esc(e.name)}">${e.mime.startsWith('image/') && !e.deletedAt ? `<img loading="lazy" src="/api/entries/${e.id}/download?preview=1" alt="${esc(e.name)}">` : tile(type.icon,type.color)}</button><div class="grid-info"><strong>${esc(e.name)}</strong><small>${e.kind === 'folder' ? 'Folder' : size(e.size)} · ${date(e.updatedAt)}</small><div class="grid-actions">${rowActions(e)}</div></div></div>`; }).join('')}</div>`;
}
function updateSelection() {
  if (!$('#selection-toolbar')) return;
  const count = state.selected.size;
  $('#selection-toolbar').innerHTML = count ? `<div class="selection-bar"><span>${count} selected</span><div>${state.view === 'trash' ? '<button class="btn soft" data-action="bulk-restore">Restore</button>' : '<button class="btn soft" data-action="bulk-trash">'+icon('trash')+'Move to trash</button>'}<button class="icon-btn" data-action="clear-selection" aria-label="Clear selection">${icon('close')}</button></div></div>` : '';
  if ($('#select-all')) { $('#select-all').checked = count > 0 && count === state.entries.length; $('#select-all').indeterminate = count > 0 && count < state.entries.length; }
}

let modalPrevious = null;
function modal(title, content, actions = '', wide = false) {
  modalPrevious = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${esc(title)}</h2>${button('close-modal','close','Close dialog')}</div>${content}<div id="modal-error" class="modal-error" role="alert" hidden></div>${actions ? `<div class="modal-actions">${actions}</div>` : ''}</section></div>`;
  setTimeout(() => $('.modal input:not([type=checkbox]), .modal select, .modal button')?.focus(), 0);
}
function closeModal(force = false) { if (state.uploading && !force) { toast('Please wait for your uploads to finish.'); return; } $('#modal-root').innerHTML = ''; modalPrevious?.focus?.(); }
function showModalError(error) { const element = $('#modal-error'); if (element) { element.hidden = false; element.textContent = error.message || error; } else toast(error.message || error,true); }
function cancelButton() { return '<button type="button" class="btn secondary" data-action="close-modal">Cancel</button>'; }
function confirm(title, message, label, run, danger = false) {
  modal(title,`<p>${esc(message)}</p>`,`${cancelButton()}<button id="confirm-action" class="btn ${danger ? 'danger' : ''}">${esc(label)}</button>`);
  $('#confirm-action').onclick = async event => { event.target.disabled = true; try { await run(); closeModal(); } catch (error) { showModalError(error); event.target.disabled = false; } };
}
function newFolder() {
  modal('A new home for your files', `<form id="folder-form"><div class="field"><label for="folder-name">Folder name</label><input id="folder-name" name="name" maxlength="180" placeholder="e.g. Project files" required></div><div class="modal-actions">${cancelButton()}<button class="btn" type="submit">${icon('plus')}Create folder</button></div></form>`);
  $('#folder-form').onsubmit = async event => { event.preventDefault(); const btn = $('button[type=submit]',event.target); btn.disabled = true; try { await api('/api/folders',{method:'POST',body:{name:$('#folder-name').value,parentId:state.view === 'files' ? state.parent : null}}); closeModal(); toast('Folder created.'); await loadView(); } catch(error) { showModalError(error); btn.disabled = false; } };
}
function openEntry(id) {
  const e = state.entries.find(f => f.id === id); if (!e) return;
  if (state.view === 'trash') return entryMenu(e);
  if (e.kind === 'folder') return navigate('files',e.id);
  const t = fileType(e);
  modal(e.name, `${e.mime.startsWith('image/') ? `<img class="preview-image" src="/api/entries/${e.id}/download?preview=1" alt="${esc(e.name)}">` : `<div class="empty" style="min-height:170px">${tile(t.icon,t.color)}<h3>${esc(t.label)}</h3><p>This file is stored securely. Download it to open.</p></div>`}<div class="meta-grid"><div><label>File size</label><span>${size(e.size)}</span></div><div><label>Last modified</label><span>${date(e.updatedAt)}</span></div><div><label>Storage</label><span>AES-256-GCM encrypted</span></div><div><label>Access</label><span>Private to your account</span></div></div>`,`<button class="btn secondary" data-action="close-modal">Close</button><a class="btn" href="/api/entries/${e.id}/download">${icon('download')}Download file</a>`,true);
}
function entryMenu(e) {
  const options = state.view === 'trash' ? [['restore','restore','Restore'],['purge','trash','Delete permanently']] : [...(e.kind === 'file' ? [['download','download','Download']] : [['open','folder','Open folder']]),['rename','edit','Rename'],['move','move','Move to folder'],['star','star',e.starred ? 'Remove from starred' : 'Add to starred'],['trash','trash','Move to trash']];
  modal(e.name, options.map(([action,name,label]) => `<button class="menu-option" data-entry-action="${action}" data-id="${e.id}">${icon(name)}${label}</button>`).join(''));
}
async function entryAction(action,id) {
  const e = state.entries.find(f => f.id === id); if (!e) return;
  if (action === 'menu') return entryMenu(e);
  if (action === 'open') { closeModal(); return openEntry(id); }
  if (action === 'download') { const a = document.createElement('a'); a.href = `/api/entries/${id}/download`; a.click(); return; }
  if (action === 'rename') {
    modal('Rename file or folder',`<form id="rename-form"><div class="field"><label for="rename-value">Name</label><input id="rename-value" value="${esc(e.name)}" maxlength="180" required></div><div class="modal-actions">${cancelButton()}<button type="submit" class="btn">Save name</button></div></form>`);
    $('#rename-form').onsubmit = async event => { event.preventDefault(); try { await api(`/api/entries/${id}`,{method:'PATCH',body:{name:$('#rename-value').value}}); closeModal(); toast('Name updated.'); await loadView(); } catch(error){showModalError(error);} }; return;
  }
  if (action === 'move') return moveEntry(e);
  if (action === 'trash') return confirm('Move to trash?',`“${e.name}” will move to trash. You can restore it later.`, 'Move to trash', async() => { await api(`/api/entries/${id}`,{method:'DELETE'}); state.selected.delete(id); toast('Moved to trash.'); await loadView(); });
  if (action === 'purge') return confirm('Delete permanently?',`“${e.name}” and any files inside will be permanently removed. This cannot be undone.`, 'Delete permanently', async() => { await api(`/api/entries/${id}/purge`,{method:'DELETE'}); toast('Permanently deleted.'); await loadView(); },true);
  try { await api(`/api/entries/${id}${action === 'restore' ? '/restore' : ''}`,{method:action === 'restore' ? 'POST' : 'PATCH',body:action === 'star' ? {starred:!e.starred} : {}}); closeModal(); if (action === 'restore') toast('Restored to your files.'); await loadView(); } catch(error){toast(error.message,true);}
}
async function moveEntry(e) {
  let folder = null, chosen = null;
  modal('Move to a folder',`<p>Choose a destination for “${esc(e.name)}”.</p><div id="move-breadcrumb" class="breadcrumbs"></div><div id="folder-destinations" class="folder-select"></div>`,`${cancelButton()}<button id="move-confirm" class="btn">Move here</button>`);
  async function browse(id = null) {
    folder = id; chosen = id; const result = await api(`/api/entries?${new URLSearchParams({view:'files',...(id?{parent:id}:{})})}`);
    if (!$('#folder-destinations')) return;
    $('#move-breadcrumb').innerHTML = `<button id="move-root">My files</button>${result.breadcrumbs.map(p => icon('chevron') + `<button data-move-parent="${p.id}">${esc(p.name)}</button>`).join('')}`;
    $('#folder-destinations').innerHTML = result.entries.filter(f => f.kind === 'folder' && f.id !== e.id).map(f => `<button data-destination="${f.id}">${icon('folder')}${esc(f.name)}${icon('chevron')}</button>`).join('') || '<div class="empty" style="min-height:120px"><p>No subfolders. You can move your file here.</p></div>';
    $('#move-root').onclick = () => browse().catch(showModalError);
    $$('[data-move-parent]').forEach(btn => btn.onclick = () => browse(btn.dataset.moveParent).catch(showModalError));
    $$('[data-destination]').forEach(btn => btn.onclick = () => browse(btn.dataset.destination).catch(showModalError));
  }
  $('#move-confirm').onclick = async event => { event.target.disabled = true; try { await api(`/api/entries/${e.id}`,{method:'PATCH',body:{parentId:chosen}}); closeModal(); toast('Moved to the selected folder.'); await loadView(); } catch(error) {showModalError(error);event.target.disabled=false;} };
  await browse(folder);
}

function uploadMenu() {
  modal('Bring it into your cloud', `<div class="upload-welcome">${tile('upload')}<div><strong>A home for every kind of file</strong><small>Photos, documents, archives, and everything in between.</small></div></div><button class="menu-option" data-action="pick-files">${icon('upload')}Choose files${icon('arrow')}</button><button class="menu-option" data-action="pick-folder">${icon('folder')}Choose a folder${icon('arrow')}</button><div class="transfer-info">${icon('shield')}<div><strong>${size(state.chunkSize)} upload parts</strong><small>${state.maxUpload > 0 ? `Up to ${size(state.maxUpload)} per file.` : "Unlimited file size, within your account storage and available disk space."} Interrupted transfers can be resumed by choosing the same file again within 24 hours.</small></div></div>`);
}
function uploadProgress(item, bytes, detail, status) {
  const row = $(`#upload-${item.index}`); if (!row) return;
  const percent = item.file.size ? Math.min(100, bytes / item.file.size * 100) : item.status === 'complete' ? 100 : 0;
  $('.progress', row).style.setProperty('--progress', `${percent}%`);
  $('.progress', row).setAttribute('aria-valuenow',String(Math.floor(percent)));
  $('.upload-status', row).textContent = status || `${Math.floor(percent)}%`;
  $('small', row).textContent = detail || `${size(bytes)} of ${size(item.file.size)}`;
  row.dataset.status = item.status;
}
function transferSummary(transfer) {
  if (!$('#upload-summary')) return;
  const count = kind => transfer.items.filter(item => item.status === kind).length;
  $('#upload-summary').textContent = `${count('complete')} of ${transfer.items.length} uploaded${count('failed') ? ` · ${count('failed')} need attention` : ''}${count('paused') ? ` · ${count('paused')} paused` : ''}${count('canceled') ? ` · ${count('canceled')} canceled` : ''}`;
}
function transferButtons(transfer) {
  const actions = $('.modal-actions'); if (!actions || !$('#upload-list')) return;
  if (state.uploading) actions.innerHTML = '<button class="btn secondary" data-action="upload-cancel">Cancel uploads</button><button class="btn" data-action="upload-pause">'+icon('pause')+'Pause</button>';
  else {
    const pending = transfer.items.some(item => ['paused','failed','queued'].includes(item.status));
    actions.innerHTML = `${pending ? '<button class="btn secondary" data-action="upload-cancel">Discard pending</button><button class="btn" data-action="upload-resume">'+icon('upload')+'Resume / retry</button>' : ''}<button class="btn secondary" data-action="close-modal">Done</button>`;
  }
}
function pauseTransfer() {
  const transfer = state.transfer; if (!transfer || !state.uploading) return;
  transfer.mode = 'pause'; transfer.xhr?.abort(); transfer.controller.abort(); transfer.waiting?.('stop');
}
async function cancelTransfer() {
  const transfer = state.transfer; if (!transfer) return;
  transfer.mode = 'cancel'; transfer.xhr?.abort(); transfer.controller.abort(); transfer.waiting?.('stop');
  if (!state.uploading) { state.uploading = true; transferButtons(transfer); try { await discardTransfers(transfer); } finally { state.uploading = false; transferButtons(transfer); transferSummary(transfer); if (state.user) await loadView(); } }
}
function abortError() { return new DOMException('Transfer paused.', 'AbortError'); }
function checkTransfer(transfer) { if (transfer.mode !== 'run' || transfer.controller.signal.aborted || !state.user) throw abortError(); }
function newUploadId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
async function fingerprintKey(file, parentId) {
  const head = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const tail = new Uint8Array(await file.slice(Math.max(65536, file.size - 65536)).arrayBuffer());
  const metadata = new TextEncoder().encode(JSON.stringify([state.user.id, parentId, file.name, file.webkitRelativePath || '', file.size, file.lastModified]));
  const bytes = new Uint8Array(metadata.length + head.length + tail.length); bytes.set(metadata); bytes.set(head, metadata.length); bytes.set(tail, metadata.length + head.length);
  const {fingerprintDigest}=await import('/fingerprint.js');
  return `shcloudpanel-upload-${state.user.id}-${await fingerprintDigest(bytes)}`;
}
function rememberUpload(item) {
  const id = item.upload?.id || item.clientId;
  if (item.key && id) storage.set(item.key, JSON.stringify({ id, name:item.file.name, size:item.file.size, parentId:item.parentId, lastModified:item.file.lastModified, expiresAt:item.upload?.expiresAt || Date.now()+24*60*60*1000 }));
}
function forgetUpload(item) { if (item.key) storage.remove(item.key); }
function savedUpload(item) {
  try {
    const saved = JSON.parse(storage.get(item.key));
    if (!saved) return null;
    const expires = typeof saved.expiresAt === 'number' ? saved.expiresAt : Date.parse(saved.expiresAt);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(saved.id) || saved.name !== item.file.name || saved.size !== item.file.size || saved.lastModified !== item.file.lastModified || saved.parentId !== item.parentId || !Number.isFinite(expires) || expires <= Date.now()) { forgetUpload(item); return null; }
    return saved;
  } catch { forgetUpload(item); return null; }
}
async function chooseResume(transfer, item, upload) {
  const row = $(`#upload-${item.index}`);
  if (!row) throw abortError();
  uploadProgress(item, upload.uploadedBytes, `${size(upload.uploadedBytes)} already uploaded. Resume using the original, unchanged file?`, 'Pending');
  const choices = $('.upload-choices', row);
  choices.innerHTML = '<button class="btn soft" data-resume-choice="resume">Resume</button><button class="btn secondary" data-resume-choice="new">Start again</button>';
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (settled) return; settled = true; choices.innerHTML = ''; transfer.waiting = null; resolve(value); };
    transfer.waiting = finish;
    $$('[data-resume-choice]', choices).forEach(button => button.onclick = () => finish(button.dataset.resumeChoice));
    if (transfer.mode !== 'run') finish('stop');
  });
}
async function getUpload(transfer, item) {
  item.key ||= await fingerprintKey(item.file, item.parentId); checkTransfer(transfer);
  const saved = item.key ? savedUpload(item) : null;
  const reselected = !!saved && !item.clientId && !item.upload;
  const id = item.upload?.id || item.clientId || saved?.id;
  if (id) {
    item.clientId = id;
    let upload;
    try { upload = (await api(`/api/uploads/${id}`, {signal:transfer.controller.signal})).upload; }
    catch (error) { if ([404,410].includes(error.status)) { forgetUpload(item); item.upload = null; if (error.status === 410) item.clientId = null; } else throw error; }
    checkTransfer(transfer);
    if (upload && upload.name === item.file.name && upload.size === item.file.size) {
      item.upload = upload;
      if (upload.state === 'complete' || upload.state === 'completed') return upload;
      const choice = reselected ? await chooseResume(transfer, item, upload) : 'resume'; checkTransfer(transfer);
      if (choice === 'resume') { item.verifyResume = upload.nextIndex > 0; return upload; }
      await discardUpload(item); item.upload = null; item.clientId = null; forgetUpload(item);
    }
  }
  checkTransfer(transfer);
  // A client-generated ID makes creation recoverable even if its acknowledgment is lost.
  item.clientId ||= newUploadId(); rememberUpload(item);
  const result = await api('/api/uploads', { method:'POST', body:{ clientId:item.clientId, name:item.file.name, parentId:item.parentId, size:item.file.size, mime:item.file.type || 'application/octet-stream' }, signal:transfer.controller.signal });
  item.upload = result.upload; rememberUpload(item); return item.upload;
}
function sendPart(transfer, item, upload) {
  return new Promise((resolve,reject) => {
    const start = upload.uploadedBytes, end = Math.min(start + upload.chunkSize, item.file.size), began = performance.now();
    const xhr = new XMLHttpRequest(); transfer.xhr = xhr;
    xhr.open('PUT', `/api/uploads/${upload.id}/chunks/${upload.nextIndex}`);
    xhr.setRequestHeader('X-CSRF-Token', state.csrf); xhr.setRequestHeader('Content-Type','application/octet-stream'); xhr.timeout = 20 * 60 * 1000;
    const fail = (message, status = 0) => { const error = new Error(message); error.status = status; reject(error); };
    xhr.upload.onprogress = event => {
      const speed = event.loaded / Math.max((performance.now() - began) / 1000, 0.2);
      if (upload.verifyOnly) uploadProgress(item,upload.verifiedBytes,'Checking your last saved part. Use the original, unchanged file.','Checking');
      else uploadProgress(item, start + event.loaded, `Part ${upload.nextIndex+1} of ${upload.totalChunks} · ${size(start + event.loaded)} / ${size(item.file.size)} · ${size(speed)}/s`, event.loaded >= end-start ? 'Saving…' : undefined);
    };
    xhr.onload = () => {
      let result; try { result = JSON.parse(xhr.responseText); } catch { fail('The connection returned an unexpected response.'); return; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(result.upload);
      else fail(result.error || 'This part could not be uploaded.', xhr.status);
    };
    xhr.onerror = () => fail('Connection interrupted.'); xhr.ontimeout = () => fail('This part timed out.'); xhr.onabort = () => reject(abortError());
    xhr.send(item.file.slice(start,end));
  }).finally(() => { transfer.xhr = null; });
}
function waitForRetry(transfer, milliseconds) {
  return new Promise((resolve,reject) => {
    const stopped = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { transfer.controller.signal.removeEventListener('abort',stopped); resolve(); }, milliseconds);
    transfer.controller.signal.addEventListener('abort',stopped,{once:true});
    if (transfer.controller.signal.aborted) stopped();
  });
}
async function uploadItem(transfer, item) {
  item.status = 'uploading'; uploadProgress(item, item.upload?.uploadedBytes || 0, 'Preparing your transfer…', 'Preparing');
  let upload = await getUpload(transfer, item); checkTransfer(transfer);
  if (!Number.isSafeInteger(upload.chunkSize) || upload.chunkSize < MIB || upload.chunkSize > 80*MIB || !Number.isSafeInteger(upload.uploadedBytes) || upload.uploadedBytes < 0 || upload.uploadedBytes > item.file.size) throw new Error('The server returned an invalid transfer configuration.');
  if (item.verifyResume && upload.nextIndex > 0 && !['complete','completed'].includes(upload.state)) {
    const previousIndex = upload.nextIndex-1;
    try { upload = await sendPart(transfer,item,{...upload,nextIndex:previousIndex,uploadedBytes:previousIndex*upload.chunkSize,verifyOnly:true,verifiedBytes:upload.uploadedBytes}); }
    catch(error) { if(error.status===409) throw new Error('This file differs from your saved upload. Choose the original unchanged file, or discard the pending transfer and start again.'); throw error; }
    item.upload=upload;item.verifyResume=false;rememberUpload(item);checkTransfer(transfer);
  }
  while (upload.uploadedBytes < item.file.size) {
    let sent = false;
    for (let attempt=0; attempt<4 && !sent; attempt++) {
      checkTransfer(transfer);
      try { upload = await sendPart(transfer,item,upload); item.upload = upload; rememberUpload(item); sent = true; }
      catch (error) {
        if (error.name === 'AbortError' || transfer.mode !== 'run') throw abortError();
        if (error.status && ![408,409,425,429,500,502,503,504].includes(error.status)) throw error;
        if (attempt === 3) throw new Error('Connection interrupted. Your uploaded parts are saved; resume or choose this file again later.');
        uploadProgress(item, upload.uploadedBytes, `Connection interrupted · retry ${attempt+1} of 3…`, 'Retrying');
        await waitForRetry(transfer, 1000 * 2 ** attempt);
        // The server is authoritative: a missing acknowledgment may still mean the part was saved.
        upload = (await api(`/api/uploads/${upload.id}`,{signal:transfer.controller.signal})).upload;
        item.upload = upload; rememberUpload(item);
        if (upload.uploadedBytes >= item.file.size) sent = true;
      }
    }
    checkTransfer(transfer);
  }
  uploadProgress(item,item.file.size,'All parts received. Finishing your file…','Finishing');
  let result;
  for (let attempt=0;attempt<3;attempt++) {
    checkTransfer(transfer);
    try { result = await api(`/api/uploads/${upload.id}/complete`,{method:'POST',body:{},signal:transfer.controller.signal}); break; }
    catch(error) { if (error.name === 'AbortError' || (error.status && error.status < 500) || attempt === 2) throw error; await waitForRetry(transfer,1000*(attempt+1)); }
  }
  forgetUpload(item); item.status = 'complete'; if (result.user) state.user=result.user;
  uploadProgress(item,item.file.size,`${size(item.file.size)} · Safely in your cloud`,'Complete'); updateUsage();
}
async function discardUpload(item) {
  const id = item.upload?.id || item.clientId; if (!id) return 'canceled';
  for(let attempt=0;attempt<5;attempt++) {
    try { await api(`/api/uploads/${id}`,{method:'DELETE'}); return 'canceled'; }
    catch(error) {
      if([404,410].includes(error.status))return 'canceled';
      if(error.status!==409)throw error;
      const upload=(await api(`/api/uploads/${id}`)).upload;item.upload=upload;
      if(['complete','completed'].includes(upload.state))return 'complete';
      if(attempt===4)throw error;
      await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));
    }
  }
}
async function discardTransfers(transfer) {
  for (const item of transfer.items) {
    if (item.status === 'complete' || item.status === 'canceled') continue;
    try { item.status=await discardUpload(item); forgetUpload(item); item.upload=null;item.clientId=null; uploadProgress(item,item.status==='complete'?item.file.size:0,item.status==='complete'?'Your file finished before cancellation.':'Pending parts discarded.',item.status==='complete'?'Complete':'Canceled'); }
    catch(error) { if ([404,410].includes(error.status)) {forgetUpload(item);item.upload=null;item.status='canceled';uploadProgress(item,0,'Pending parts discarded.','Canceled');} else {item.status='failed';uploadProgress(item,item.upload?.uploadedBytes||0,'Could not discard the pending upload. Try again.','Pending');} }
  }
}
async function runTransfer(transfer) {
  if (!transfer || state.uploading || !state.user) return;
  state.uploading = true; transfer.mode='run'; transfer.controller = new AbortController(); transferButtons(transfer);
  $('#modal-title').textContent = 'Your files are on their way';
  try {
    for (const item of transfer.items) {
      if (['complete','canceled'].includes(item.status)) continue;
      if (transfer.mode !== 'run') break;
      try {
        if (state.maxUpload > 0 && item.file.size > state.maxUpload) throw new Error(`This file exceeds the ${size(state.maxUpload)} limit.`);
        const relative = item.file.webkitRelativePath?.split('/').slice(0,-1).join('/') || '';
        if (item.parentId === undefined) item.parentId = relative ? await transfer.ensureFolder(relative) : transfer.destination;
        checkTransfer(transfer); await uploadItem(transfer,item);
      } catch(error) {
        if (error.name === 'AbortError' || transfer.mode !== 'run') { item.status='paused'; uploadProgress(item,item.upload?.uploadedBytes||0,'Your saved parts are ready when you are.','Paused'); break; }
        item.status='failed'; uploadProgress(item,item.upload?.uploadedBytes||0,error.message,'Needs retry');
      }
      transferSummary(transfer);
    }
    if (transfer.mode === 'cancel') await discardTransfers(transfer);
    else if (transfer.mode === 'pause') for(const item of transfer.items) if(item.status==='queued') {item.status='paused';uploadProgress(item,0,'Waiting to resume.','Paused');}
  } finally {
    state.uploading=false; transferSummary(transfer); transferButtons(transfer);
    if ($('#upload-list')) $('#modal-title').textContent = transfer.mode === 'pause' ? 'Paused. Pick up where you left off.' : transfer.items.every(item=>item.status==='complete') ? 'Everything, safely home.' : 'Your transfer summary';
    $('#file-picker').value=''; $('#folder-picker').value='';
    if (state.user) await loadView();
  }
}
async function uploadFiles(files) {
  if (!files.length || state.uploading || !state.user) return;
  const transfer = { items:[...files].map((file,index)=>({file,index,status:'queued',upload:null,key:null})), destination:state.view==='files'?state.parent:null, mode:'run', xhr:null, controller:new AbortController(), waiting:null };
  state.transfer=transfer;
  modal('Your files are on their way', `<p class="transfer-description">Sent securely in smaller parts. Pause any time and continue from your last saved part.</p><div class="transfer-pill">${icon('shield')}${size(state.chunkSize)} per part<span>Encrypted storage</span></div><div id="upload-list">${transfer.items.map(item=>`<div class="upload-item" id="upload-${item.index}" data-status="queued">${tile(fileType({name:item.file.name,mime:item.file.type||'application/octet-stream',kind:'file'}).icon)}<div><strong>${esc(item.file.webkitRelativePath||item.file.name)}</strong><small>${size(item.file.size)} · Waiting</small><div class="progress" role="progressbar" aria-label="Upload progress for ${esc(item.file.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" style="--progress:0%"><i></i></div><div class="upload-choices"></div></div><span class="upload-status">Queued</span></div>`).join('')}</div><div class="upload-summary" id="upload-summary" role="status" aria-live="polite">0 of ${transfer.items.length} uploaded</div>`,'<button class="btn secondary" disabled>Preparing…</button>',true);
  const folders = new Map([['',transfer.destination]]);
  transfer.ensureFolder=async relative=>{
    if(folders.has(relative))return folders.get(relative);
    const parts=relative.split('/'),name=parts.pop(),parentId=await transfer.ensureFolder(parts.join('/'));checkTransfer(transfer);
    try { const result=await api('/api/folders',{method:'POST',body:{name,parentId},signal:transfer.controller.signal});folders.set(relative,result.entry.id); }
    catch(error) {checkTransfer(transfer);const listing=await api(`/api/entries?${new URLSearchParams({view:'files',...(parentId?{parent:parentId}:{})})}`,{signal:transfer.controller.signal});const found=listing.entries.find(entry=>entry.kind==='folder'&&entry.name===name);if(!found)throw error;folders.set(relative,found.id);}
    return folders.get(relative);
  };
  // A persistent record stores only the upload ID and file fingerprint, never file contents.
  await runTransfer(transfer);
}

function renderUsers(users) {
  state.users = users;
  $('#content').innerHTML = `<div class="page-heading"><div>${crumb()}<h1>Members</h1><p>Manage accounts, roles and storage quotas.</p></div><div class="heading-actions"><button class="btn" data-action="create-user">${icon('plus')}Add member</button></div></div><div class="notice">${icon('shield')}${state.user.role === 'owner' ? 'You are the only owner. You can appoint administrators; administrators can manage members only.' : 'You can create and manage members. Administrator and owner accounts are protected.'}</div><div class="file-panel"><div class="file-toolbar"><h2>${users.length} accounts</h2><span class="small muted">Owner · Admin · Member</span></div><table class="file-table admin-table"><thead><tr><th></th><th>Member</th><th>Role</th><th>Storage</th><th class="type-col">Status</th><th style="text-align:right">Manage</th></tr></thead><tbody>${users.map(u => `<tr><td><div class="avatar ${u.role}" style="width:28px;height:28px;font-size:9px">${esc(initials(u.displayName))}</div></td><td><div style="font-size:12px;color:var(--ink)">${esc(u.displayName)}</div><div class="small muted" style="font-size:10px">@${esc(u.username)} · ${esc(u.email)}</div></td><td><span class="badge ${u.role}">${u.role}</span></td><td class="nowrap">${size(u.used)} / ${size(u.quota)}<div class="progress" style="--progress:${u.quota ? Math.min(u.used/u.quota*100,100) : 100}%;margin-top:6px;max-width:100px;height:3px"><i></i></div></td><td class="type-col"><span class="badge ${u.active ? 'green' : 'red'}">${u.active ? 'Active' : 'Suspended'}</span></td><td><div class="actions">${(state.user.role === 'owner' || u.role === 'member') ? `<button class="icon-btn" data-user="${u.id}" aria-label="Manage ${esc(u.username)}">${icon('settings')}</button>` : icon('lock')}</div></td></tr>`).join('')}</tbody></table><div class="panel-foot"><span>Each account has its own private files</span><span>Role changes revoke existing sessions</span></div></div>`;
}
function createUser() {
  modal('Welcome someone new', `<form id="create-user-form"><div class="field"><label for="new-display">Display name</label><input id="new-display" name="displayName" maxlength="60" required></div><div class="field-row"><div class="field"><label for="new-username">Username</label><input id="new-username" name="username" minlength="3" maxlength="32" required></div><div class="field"><label for="new-role">Role</label><select id="new-role" name="role"><option value="member">Member</option>${state.user.role === 'owner' ? '<option value="admin">Administrator</option>' : ''}</select></div></div><div class="field"><label for="new-email">Email</label><input id="new-email" type="email" name="email" maxlength="254" required></div><div class="field"><label for="new-password">Initial password</label><input id="new-password" type="password" name="password" minlength="8" maxlength="128" autocomplete="new-password" required><small>At least 8 characters. Share it privately; the member can change it after signing in.</small></div><div class="field"><label for="new-quota">Storage allowance (GB)</label><input id="new-quota" type="number" name="quota" step="0.1" min="0" max="100000" value="5" required></div><div class="modal-actions">${cancelButton()}<button type="submit" class="btn">Create account</button></div></form>`);
  api('/api/admin/overview').then(r=>{if($('#new-quota'))$('#new-quota').value=r.settings.defaultQuota/GIB;}).catch(()=>{});
  $('#create-user-form').onsubmit = async event => { event.preventDefault(); const btn=$('button[type=submit]',event.target);btn.disabled=true; const input=Object.fromEntries(new FormData(event.target));input.quota=Math.round(Number(input.quota)*GIB); try{await api('/api/admin/users',{method:'POST',body:input});closeModal();toast('Account created.');await loadView();}catch(error){showModalError(error);btn.disabled=false;} };
}
function manageUser(id) {
  const u=state.users.find(u=>u.id===id);if(!u)return;
  if (u.role === 'owner') {
    modal('Your owner storage', `<p>Your role and account remain protected. You can adjust your own storage allowance here.</p><form id="owner-quota-form"><div class="field"><label for="owner-quota">Storage allowance (GB)</label><input id="owner-quota" type="number" min="0" max="100000" step="any" value="${u.quota/GIB}" required><small>${size(u.used)} currently used, including trash.</small></div><div class="modal-actions">${cancelButton()}<button class="btn" type="submit">Save allowance</button></div></form>`);
    $('#owner-quota-form').onsubmit = async event => { event.preventDefault(); try { const r = await api(`/api/admin/users/${id}`, { method:'PATCH', body:{ quota:Math.round(Number($('#owner-quota').value)*GIB) } }); state.user = r.user; updateUsage(); closeModal(); toast('Your storage allowance is updated.'); await loadView(); } catch(error) { showModalError(error); } }; return;
  }
  modal(`Manage ${u.displayName}`,`<form id="manage-user-form"><div class="account-info"><div class="avatar ${u.role}">${esc(initials(u.displayName))}</div><div><strong>@${esc(u.username)}</strong><small>${esc(u.email)}</small></div></div>${state.user.role==='owner'?`<div class="field"><label for="manage-role">Account role</label><select id="manage-role"><option value="member" ${u.role==='member'?'selected':''}>Member</option><option value="admin" ${u.role==='admin'?'selected':''}>Administrator</option></select><small>Only the owner can appoint administrators.</small></div>`:''}<div class="field"><label for="manage-quota">Storage allowance (GB)</label><input id="manage-quota" type="number" min="${(u.used/GIB).toFixed(6)}" max="100000" step="any" value="${u.quota/GIB}" required><small>${size(u.used)} currently used, including trash.</small></div><div class="toggle-row"><div><strong>Account active</strong><small>Suspending access signs this account out.</small></div><input id="manage-active" type="checkbox" class="toggle" ${u.active?'checked':''} aria-label="Account active"></div><div class="modal-actions"><button type="button" class="btn secondary" id="delete-user" style="margin-right:auto;color:#d16b7a">Delete account</button><button type="submit" class="btn">Save changes</button></div></form>`);
  $('#manage-user-form').onsubmit=async event=>{event.preventDefault();const input={quota:Math.round(Number($('#manage-quota').value)*GIB),active:$('#manage-active').checked};if($('#manage-role') && $('#manage-role').value!==u.role)input.role=$('#manage-role').value;try{await api(`/api/admin/users/${id}`,{method:'PATCH',body:input});closeModal();toast('Account updated.');await loadView();}catch(error){showModalError(error);}};
  $('#delete-user').onclick=()=>confirm('Delete this account?',`This permanently deletes @${u.username} and all their files. This cannot be undone.`,'Delete account',async()=>{await api(`/api/admin/users/${id}`,{method:'DELETE'});toast('Account deleted.');await loadView();},true);
}
function renderDisk(d) {
  const isOwner = state.user.role === 'owner', pct = (v, t) => t ? Math.max(0, Math.min(100, v / t * 100)) : 0;
  const total = d.disk.total || 1, cloudPct = pct(d.cloud.used, total), otherPct = pct(d.other, total), freePct = pct(d.disk.free, total);
  const allocPct = d.capacity ? Math.min(100, d.allocated / d.capacity * 100) : 100;
  const best = bytes => bytes >= GIB * 1024 && bytes % (GIB * 1024) === 0 ? ['TB', bytes / (GIB * 1024)] : bytes >= GIB ? ['GB', +(bytes / GIB).toFixed(2)] : ['MB', +(bytes / MIB).toFixed(2)];
  const [unit0, amount0] = d.mode === 'custom' ? best(d.capacity) : ['GB', ''];
  const stats = [[size(d.disk.total),'Total server disk','drive',''],[size(d.cloud.used),'Used by cloud files','file','blue'],[size(d.allocated),'Allocated to accounts','users','orange'],[size(d.cloud.free),'Free for the cloud','cloud','green']];
  const rows = d.users.map(u => `<tr><td><div style="font-size:12px;color:var(--ink)">${esc(u.displayName)}</div><div class="small muted" style="font-size:10px">@${esc(u.username)}</div></td><td><span class="badge ${u.role}">${u.role}</span></td><td class="nowrap">${size(u.allocated)}</td><td class="nowrap">${size(u.used)}${u.trash ? `<div class="small muted" style="font-size:10px">${size(u.trash)} in trash</div>` : ''}</td><td class="nowrap"><div class="progress${u.percent >= 90 ? ' high' : ''}" style="--progress:${u.percent}%;max-width:110px;height:4px"><i></i></div><div class="small muted" style="font-size:10px;margin-top:4px">${u.percent.toFixed(1)}%</div></td><td class="nowrap">${size(u.remaining)}</td><td class="type-col"><span class="badge ${u.active ? 'green' : 'red'}">${u.active ? 'Active' : 'Suspended'}</span></td></tr>`).join('');
  $('#content').innerHTML = `<div class="page-heading"><div>${crumb()}<h1>Disk &amp; storage</h1><p>Server disk scan, allocated space and what every account has used.</p></div><div class="heading-actions"><span class="small muted">Scanned ${new Date(d.scannedAt).toLocaleTimeString()}</span><button class="btn secondary" data-action="refresh">${icon('restore')}Scan again</button></div></div>${d.warnings.map(w => `<div class="notice">${icon('shield')}${esc(w)}</div>`).join('')}<div class="stat-grid">${stats.map(([value,label,name,color]) => `<div class="stat-card">${tile(name,color)}<strong>${value}</strong><small>${label}</small></div>`).join('')}</div><div class="settings-grid"><section class="settings-card"><h2>Server disk</h2><p>Everything on the disk that holds the cloud data.</p><div class="stack-bar" role="img" aria-label="Disk usage"><i class="d-cloud" style="width:${cloudPct}%"></i><i class="d-other" style="width:${otherPct}%"></i><i class="d-free" style="width:${freePct}%"></i></div><ul class="legend"><li><b class="d-cloud"></b>Cloud files <span>${size(d.cloud.used)}</span></li><li><b class="d-other"></b>System &amp; other apps <span>${size(d.other)}</span></li><li><b class="d-free"></b>Free <span>${size(d.disk.free)}</span></li></ul><div class="small muted">Files: ${d.cloud.files.toLocaleString()} · In trash: ${size(d.cloud.trash)} · Active uploads reserved: ${size(d.cloud.reserved)}</div></section><section class="settings-card"><h2>Allocated vs capacity</h2><p>Sum of every account's storage allowance compared with what the cloud can hold.</p><strong style="font-size:22px">${size(d.allocated)} <small class="muted">of ${size(d.capacity)}</small></strong><div class="progress${d.overAllocated ? ' high' : ''}" style="--progress:${allocPct}%;margin:12px 0"><i></i></div><div class="small muted">${d.overAllocated ? 'Over-allocated by ' + size(d.allocated - d.capacity) : 'Unallocated: ' + size(d.unallocated)}. Allowances do not use disk space until files are stored.</div></section></div><section class="settings-card" style="margin-top:22px"><h2>Cloud storage capacity</h2><p>${d.mode === 'custom' ? 'Custom limit: the cloud will never store more than this in total.' : 'Auto detect: the cloud uses all disk space available on this server.'}</p>${isOwner ? `<form id="capacity-form"><div class="field-row"><div class="field"><label for="cap-mode">Mode</label><select id="cap-mode"><option value="auto" ${d.mode !== 'custom' ? 'selected' : ''}>Auto detect (scan this VPS)</option><option value="custom" ${d.mode === 'custom' ? 'selected' : ''}>Custom size</option></select></div><div class="field"><label for="cap-size">Size</label><input id="cap-size" type="number" min="0" step="any" value="${amount0}" ${d.mode !== 'custom' ? 'disabled' : ''}></div><div class="field"><label for="cap-unit">Unit</label><select id="cap-unit" ${d.mode !== 'custom' ? 'disabled' : ''}>${['MB','GB','TB'].map(u => `<option ${u === unit0 ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div><small class="muted">The cloud can use up to ${size(d.usable)} on this disk right now. 1 GB = 1,024 MB · 1 TB = 1,024 GB.</small><div style="display:flex;justify-content:flex-end;margin-top:16px"><button type="submit" class="btn">${icon('check')}Save capacity</button></div></form>` : `<div class="small muted">Only the owner can change the capacity. Current limit: ${d.mode === 'custom' ? size(d.capacity) : 'automatic (' + size(d.usable) + ')'}.</div>`}</section><div class="file-panel" style="margin-top:22px"><div class="file-toolbar"><h2>${d.users.length} accounts</h2><span class="small muted">Allocated vs used</span></div><div style="overflow-x:auto"><table class="file-table admin-table"><thead><tr><th>Account</th><th>Role</th><th>Allocated</th><th>Used</th><th>Usage</th><th>Remaining</th><th class="type-col">Status</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td><strong>Total</strong></td><td></td><td class="nowrap"><strong>${size(d.allocated)}</strong></td><td class="nowrap"><strong>${size(d.cloud.used)}</strong></td><td></td><td class="nowrap"><strong>${size(Math.max(0, d.allocated - d.cloud.used))}</strong></td><td class="type-col"></td></tr></tfoot></table></div><div class="panel-foot"><span>Used includes files in trash</span><span>Visible to administrators only</span></div></div>`;
  if (!isOwner) return;
  const mode = $('#cap-mode'); mode.onchange = () => { $('#cap-size').disabled = $('#cap-unit').disabled = mode.value !== 'custom'; if (mode.value === 'custom') $('#cap-size').focus(); };
  $('#capacity-form').onsubmit = async event => {
    event.preventDefault(); const btn = $('button[type=submit]', event.target); btn.disabled = true;
    try { const body = { mode: mode.value }; if (mode.value === 'custom') { body.size = Number($('#cap-size').value); body.unit = $('#cap-unit').value; }
      const result = await api('/api/admin/storage', { method: 'PATCH', body }); toast('Storage capacity saved.'); renderDisk(result); }
    catch (error) { toast(error.message, true); btn.disabled = false; }
  };
}
function renderSettings(info) {
  const s=info.settings;state.settings=s;
  $('#content').innerHTML=`<div class="page-heading"><div>${crumb()}<h1>Cloud settings</h1><p>Configure branding, registration, quotas and upload behavior.</p></div><span class="server-status"><i class="status-dot"></i>Server online · v${esc(info.version)}</span></div><div class="stat-grid">${[[info.users,'Accounts','users',''],[info.files,'Stored files','file','blue'],[size(info.used),'Storage in use','drive','orange'],[size(info.diskFree),'Free server space','cloud','green']].map(([value,label,name,color])=>`<div class="stat-card">${tile(name,color)}<strong>${value}</strong><small>${label}</small></div>`).join('')}</div><form id="settings-form"><div class="settings-grid"><section class="settings-card"><h2>Make it yours</h2><p>Your branding appears on the login page and throughout the cloud.</p><div class="field"><label for="site-name">Cloud name</label><input id="site-name" value="${esc(s.siteName)}" maxlength="40" required></div><div class="field"><label for="site-tagline">Tagline</label><input id="site-tagline" value="${esc(s.tagline)}" maxlength="100"></div><div class="brand-upload"><img id="logo-preview" src="${esc(s.logo||'/mark.svg')}" alt="Logo preview"><div><label for="logo-input">Cloud logo</label><div class="small muted">PNG, JPEG or WebP · up to 1 MB</div><input id="logo-input" type="file" accept="image/png,image/jpeg,image/webp"></div><button type="button" class="icon-btn" data-clear-brand="logo" title="Reset logo" aria-label="Reset logo">${icon('restore')}</button></div><div class="brand-upload"><img id="favicon-preview" src="${esc(s.favicon||'/mark.svg')}" alt="Favicon preview"><div><label for="favicon-input">Browser icon</label><div class="small muted">A square PNG works best</div><input id="favicon-input" type="file" accept="image/png,image/jpeg,image/webp"></div><button type="button" class="icon-btn" data-clear-brand="favicon" title="Reset browser icon" aria-label="Reset browser icon">${icon('restore')}</button></div><div class="field"><label for="accent-color">Accent color</label><input id="accent-color" type="color" value="${esc(s.accent)}"></div></section><section class="settings-card"><h2>Access &amp; storage</h2><p>Decide who can join and how much space they start with.</p><div class="toggle-row" style="border-top:0;padding-top:0"><div><strong>Allow new registrations</strong><small>Let visitors create a member account.</small></div><input id="registration-enabled" class="toggle" type="checkbox" ${s.registrationEnabled?'checked':''} aria-label="Allow registration"></div><div class="field"><label for="default-quota">Default storage per new account (GB)</label><input id="default-quota" type="number" step="0.1" min="0" max="100000" value="${s.defaultQuota/GIB}" required><small>Applies to new members. Existing allowances stay as set.</small></div><div class="field"><label for="max-upload">Optional file size limit (MB)</label><input id="max-upload" type="number" min="0" step="1" value="${s.maxUpload/MIB}" required><small>0 means unlimited file size. Account storage and free disk space still apply.</small></div><div class="field"><label for="upload-chunk-size">Upload part size (MB)</label><input id="upload-chunk-size" type="number" min="1" max="80" step="1" value="${(s.uploadChunkSize||20*MIB)/MIB}" required><small>Default: 20 MB per request. Choose 1–80 MB per upload request. Smaller parts help on unreliable connections.</small></div><div class="notice" style="margin-top:25px;margin-bottom:20px">${icon('shield')}Only you can grant admin access. The owner account is protected from deletion and role changes.</div><div class="toggle-row"><div><strong>Google sign-in</strong><small>Firebase / OAuth integration planned.</small></div><span class="coming">Coming soon</span></div><div class="small muted">Your cloud runs on port 6969, using localhost or the server IPv4 address. Storage units are binary: 1 GB = 1,024 MB.</div></section></div><div style="display:flex;justify-content:flex-end;margin-top:22px"><button type="submit" class="btn">${icon('check')}Save cloud settings</button></div></form>`;
  let brandUpdates={};
  for(const field of ['logo','favicon']) {
    $(`#${field}-input`).onchange=async event=>{const file=event.target.files[0];if(!file)return;if(file.size>MIB){toast('Choose an image smaller than 1 MB.',true);event.target.value='';return;}try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});brandUpdates[field]=data;$(`#${field}-preview`).src=data;}catch{toast('Could not read that image.',true);}};
    $(`[data-clear-brand="${field}"]`).onclick=()=>{brandUpdates[field]='';$(`#${field}-preview`).src='/mark.svg';$(`#${field}-input`).value='';};
  }
  $('#settings-form').onsubmit=async event=>{event.preventDefault();const btn=$('button[type=submit]',event.target);btn.disabled=true;try{const result=await api('/api/admin/settings',{method:'PATCH',body:{siteName:$('#site-name').value,tagline:$('#site-tagline').value,accent:$('#accent-color').value,registrationEnabled:$('#registration-enabled').checked,defaultQuota:Math.round(Number($('#default-quota').value)*GIB),maxUpload:Math.round(Number($('#max-upload').value)*MIB),uploadChunkSize:Math.round(Number($('#upload-chunk-size').value)*MIB),...brandUpdates}});state.config={...state.config,...result.settings};state.maxUpload=result.settings.maxUpload;state.chunkSize=result.settings.uploadChunkSize||20*MIB;applyBrand();toast('Your cloud settings are saved.');}catch(error){toast(error.message,true);}btn.disabled=false;};
}
function renderAudit(events) {
  $('#content').innerHTML=`<div class="page-heading"><div>${crumb()}<h1>Activity log</h1><p>Recent account and security events across your cloud.</p></div><button class="btn secondary" data-action="refresh">${icon('restore')}Refresh</button></div><div class="file-panel"><div class="file-toolbar"><h2>Recent activity</h2><span class="small muted">Latest 200 events</span></div><table class="file-table admin-table"><thead><tr><th></th><th>Event</th><th>By</th><th>Details</th><th class="date-col">Time</th></tr></thead><tbody>${events.map(e=>`<tr><td>${icon(e.action.startsWith('auth.')?'shield':e.action.startsWith('user.')?'users':'activity')}</td><td style="color:var(--ink)">${esc(e.action.replaceAll('.',' · ').replaceAll('_',' '))}</td><td>${esc(e.username||'System / removed account')}</td><td>${esc(e.detail||'—')}</td><td class="date-col nowrap">${new Date(e.created_at).toLocaleString()}</td></tr>`).join('')}</tbody></table>${!events.length?emptyState('recent'):''}</div>`;
}
function account() {
  const u=state.user;
  modal('Your account',`<div class="account-info"><div class="avatar ${u.role}">${esc(initials(u.displayName))}</div><div><strong>${esc(u.displayName)}</strong><small>${esc(u.email)} · ${u.role}</small></div></div><form id="password-form"><h3 style="margin-bottom:16px">Change your password</h3><div class="field"><label for="current-password">Current password</label><input id="current-password" type="password" autocomplete="current-password" required></div><div class="field"><label for="new-account-password">New password</label><input id="new-account-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required><small>At least 8 characters. Changing it signs out every session.</small></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="logout" style="margin-right:auto">${icon('logout')}Sign out</button><button type="submit" class="btn">Update password</button></div></form>`);
  $('#password-form').onsubmit=async event=>{event.preventDefault();try{await api('/api/account',{method:'PATCH',body:{currentPassword:$('#current-password').value,newPassword:$('#new-account-password').value}});state.user=null;closeModal();renderAuth();toast('Password updated. Please sign in again.');}catch(error){showModalError(error);}};
}
function help() {
  modal('A little guidance',`<div class="help-list"><div><strong>Keep your files organized</strong><small>Create folders, upload multiple files, or upload a whole folder. Drag files anywhere in your workspace to add them.</small></div><div><strong>Your files are private</strong><small>Files are encrypted on this server and accessible through your account. Server operators control the server and its encryption key.</small></div><div><strong>Trash counts toward storage</strong><small>Moving files to trash lets you restore them. Delete permanently or empty trash to free space.</small></div><div><strong>Forgot your password?</strong><small>Contact the server operator. They can reset an account password through the server terminal.</small></div><div><strong>Google login</strong><small>Google / Firebase sign-in will be added later. Use your email or username and password for now.</small></div></div>`,'<button class="btn" data-action="close-modal">Got it</button>');
}
function selectedRoots() {
  const parents = new Map(state.entries.map(e => [e.id,e.parentId]));
  return [...state.selected].filter(id => {
    let parent = parents.get(id);
    while (parent) { if (state.selected.has(parent)) return false; parent = parents.get(parent); }
    return true;
  });
}
const actions = {
 'auth-login':()=>renderAuth(false),'auth-register':()=>renderAuth(true),
 'toggle-password':()=>{const p=$('#password');p.type=p.type==='password'?'text':'password';},
 'login-help':()=>modal('Need help signing in?', '<p>Use the username or email address you registered with. If you forgot your password, contact the server operator to reset it.</p>', '<button class="btn" data-action="close-modal">Got it</button>'),
 'close-modal':()=>closeModal(),'toggle-sidebar':()=>{$('.sidebar').classList.toggle('open');$('.screen-shade').classList.toggle('open');},'close-sidebar':closeSidebar,
 'new-folder':newFolder,'upload':uploadMenu,'pick-files':()=>{closeModal();$('#file-picker').click();},'pick-folder':()=>{closeModal();$('#folder-picker').click();},
 'help':help,'account':account,'refresh':loadView,'create-user':createUser,'appearance':appearance,'upload-pause':pauseTransfer,'upload-cancel':cancelTransfer,'upload-resume':()=>runTransfer(state.transfer),'upload-retry':()=>runTransfer(state.transfer),
 'logout':async()=>{if(state.uploading){toast('Finish your upload before signing out.');return;}await api('/api/auth/logout',{method:'POST',body:{}});state.user=null;closeModal();renderAuth();},
 'storage-help':()=>modal('Your storage',`<p>You’ve used ${size(state.user.used)} of your ${size(state.user.quota)} allowance. Files in trash also count toward this total.</p><p>To make space, delete files permanently from trash. For a larger allowance, contact your cloud administrator.</p>`,'<button class="btn" data-action="close-modal">Got it</button>'),
 'empty-trash':()=>confirm('Empty your trash?', 'Everything in your trash will be permanently deleted. This cannot be undone.', 'Empty trash',async()=>{await api('/api/trash',{method:'DELETE'});state.selected.clear();toast('Trash emptied. Storage freed.');await loadView();},true),
 'clear-selection':()=>{state.selected.clear();renderFiles();},
 'bulk-trash':()=>confirm('Move selected items to trash?',`${state.selected.size} items will move to trash. You can restore them later.`,'Move to trash',async()=>{for(const id of selectedRoots())await api(`/api/entries/${id}`,{method:'DELETE'});state.selected.clear();toast('Selected items moved to trash.');await loadView();}),
 'bulk-restore':async()=>{for(const id of state.selected)await api(`/api/entries/${id}/restore`,{method:'POST',body:{}});state.selected.clear();toast('Selected items restored.');await loadView();}
};
document.addEventListener('click', async event => {
  const target=event.target.closest('button,a,[data-action]');if(!target)return;
  try {
    if(target.dataset.themeChoice){window.SHCloudPanelTheme?.set(target.dataset.themeChoice);return;}
    if(state.uploading && !['upload-pause','upload-cancel','toggle-sidebar','close-sidebar'].includes(target.dataset.action)){if(target.dataset.action||target.dataset.open||target.dataset.entryAction||target.dataset.user){toast('Pause your transfer before opening another dialog.');return;}}
    if(target.dataset.action && actions[target.dataset.action])return await actions[target.dataset.action]();
    if(target.dataset.view)return await navigate(target.dataset.view);
    if('parent' in target.dataset)return await navigate('files',target.dataset.parent || null);
    if(target.dataset.open)return openEntry(target.dataset.open);
    if(target.dataset.entryAction)return await entryAction(target.dataset.entryAction,target.dataset.id);
    if(target.dataset.layout){state.layout=target.dataset.layout;storage.set('shcloudpanel-layout',state.layout);renderFiles();return;}
    if(target.dataset.user)return manageUser(target.dataset.user);
    if(target.dataset.category){if(target.dataset.category==='All'){renderFiles();return;}if(target.dataset.category==='Image')return navigate('photos');const kind=target.dataset.category;const rows=sortedEntries().filter(e=>e.kind==='file'&&(kind==='Other'?!['Image','Document','Archive'].includes(fileType(e).label):fileType(e).label===kind));$('#file-results').innerHTML=rows.length?state.layout==='grid'?fileGrid(rows):fileTable(rows):'<div class="empty">'+tile('file')+'<h3>No files in this category yet.</h3><p>Upload files to see them here.</p><button class="btn soft" data-action="refresh">Show all files</button></div>';$('.file-toolbar h2').textContent=kind==='Other'?'Other files':`${kind}s`;$$('.kind-tabs button').forEach(b=>b.classList.toggle('active',b===target));state.selected.clear();updateSelection();}
  }catch(error){toast(error.message,true);}
});
document.addEventListener('submit',async event=>{
  if(event.target.id!=='auth-form')return;event.preventDefault();const form=event.target,btn=$('button[type=submit]',form);btn.disabled=true;$('#auth-error').hidden=true;
  const input=Object.fromEntries(new FormData(form));input.remember=input.remember==='on';
  try{const data=await api(`/api/auth/${form.dataset.register==='true'?'register':'login'}`,{method:'POST',body:input});state.user=data.user;state.csrf=data.csrf;state.view='files';state.parent=null;state.search='';state.selected.clear();const me=await api('/api/me');state.maxUpload=me.maxUpload;state.chunkSize=me.uploadChunkSize||me.settings?.uploadChunkSize||20*MIB;renderShell();await loadView();}catch(error){if($('#auth-error')){$('#auth-error').hidden=false;$('#auth-error').textContent=error.message;}btn.disabled=false;}
});
let searchTimer;
document.addEventListener('input',event=>{if(event.target.id==='search'){clearTimeout(searchTimer);const value=event.target.value;searchTimer=setTimeout(()=>{state.view='files';state.parent=null;state.search=value;state.selected.clear();markNav();loadView();},280);}});
document.addEventListener('change',event=>{
  if(event.target.id==='sort'){state.sort=event.target.value;renderFiles();}
  if(event.target.dataset.select){if(event.target.checked)state.selected.add(event.target.dataset.select);else state.selected.delete(event.target.dataset.select);updateSelection();}
  if(event.target.id==='select-all'){state.selected=event.target.checked?new Set($$('[data-select]').map(e=>e.dataset.select)):new Set();$$('[data-select]').forEach(e=>e.checked=event.target.checked);updateSelection();}
  if(['file-picker','folder-picker'].includes(event.target.id))uploadFiles([...event.target.files]).catch(error=>{state.uploading=false;toast(error.message,true);closeModal(true);});
});
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k' && $('#search')){event.preventDefault();$('#search').focus();}
  if(event.key==='Escape'){closeModal();closeSidebar();}
  if(event.key==='Tab' && $('.modal')){const nodes=$$('button:not(:disabled),input,select,a[href]', $('.modal'));const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
let dragDepth=0;
document.addEventListener('dragenter',event=>{if(!state.user||state.uploading||!event.dataTransfer.types.includes('Files'))return;event.preventDefault();dragDepth++;$('#drop-overlay').hidden=false;});
document.addEventListener('dragover',event=>{if(state.user){event.preventDefault();event.dataTransfer.dropEffect='copy';}});
document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('#drop-overlay').hidden=true;});
document.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;$('#drop-overlay').hidden=true;if(state.user&&!state.uploading)uploadFiles([...event.dataTransfer.files]).catch(error=>{state.uploading=false;toast(error.message,true);closeModal(true);});});
window.addEventListener('beforeunload',event=>{if(state.uploading){event.preventDefault();event.returnValue='';}});
(async()=>{
  try{state.config=await api('/api/config');applyBrand();try{const me=await api('/api/me');state.user=me.user;state.csrf=me.csrf;state.maxUpload=me.maxUpload;state.chunkSize=me.uploadChunkSize||me.settings?.uploadChunkSize||20*MIB;}catch{}if(state.user){renderShell();await loadView();}else renderAuth();}
  catch(error){$('#app').innerHTML=`<div class="boot"><div><h2>Couldn’t connect to your cloud.</h2><p>${esc(error.message)}</p><button class="btn" id="reload" style="margin-top:15px">Try again</button></div></div>`;$('#reload').onclick=()=>location.reload();}
})();
