// ── Profile ──────────────────────────────────────────────

const BELT_LEVELS = ['white', 'blue', 'purple', 'brown', 'black'];
const GI_OPTIONS  = [{ value: 'gi', label: 'Gi' }, { value: 'nogi', label: 'No-Gi' }, { value: 'both', label: 'Both' }];

const GUARD_TYPES    = ['position', 'technique'];
const PASSING_TYPES  = ['guard_pass', 'technique'];
const SUB_TYPES      = ['submission'];

let _profile = null; // cached after first load

function openProfile() {
  closeUserMenu();
  setMode('profile');
  history.pushState({}, '', '/profile');
  document.title = 'My Game — Tapcodex';
  renderProfilePage();
}

async function renderProfilePage() {
  const container = document.getElementById('profile-content');
  container.innerHTML = `<p style="font-family:var(--mono);font-size:0.8rem;color:var(--ink-3)">Loading…</p>`;

  try {
    const res = await fetch('/api/profile');
    if (!res.ok) { container.innerHTML = ''; return; }
    const { profile, email } = await res.json();
    _profile = profile || {};
    buildProfileForm(container, _profile, email);
  } catch {
    container.innerHTML = `<p style="color:var(--ink-3);font-family:var(--mono);font-size:0.85rem">Failed to load profile.</p>`;
  }
}

function buildProfileForm(container, profile, email) {
  container.innerHTML = '';

  // Header
  const head = document.createElement('div');
  head.className = 'profile-head';
  head.innerHTML = `
    <h2 class="profile-title">My game</h2>
    <p class="profile-sub">${escHtml(email)} · answers are tailored to your game when this is set</p>`;
  container.appendChild(head);

  // Belt
  const beltSection = document.createElement('div');
  beltSection.className = 'profile-section';
  beltSection.innerHTML = `<span class="profile-section-label">Belt</span>`;
  const beltOptions = document.createElement('div');
  beltOptions.className = 'belt-options';
  let selectedBelt = profile.belt || 'white';
  BELT_LEVELS.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'belt-btn' + (b === selectedBelt ? ' active' : '');
    btn.textContent = b;
    btn.addEventListener('click', () => {
      selectedBelt = b;
      beltOptions.querySelectorAll('.belt-btn').forEach(el => el.classList.toggle('active', el.textContent === b));
    });
    beltOptions.appendChild(btn);
  });
  beltSection.appendChild(beltOptions);
  container.appendChild(beltSection);

  // Gi preference
  const giSection = document.createElement('div');
  giSection.className = 'profile-section';
  giSection.innerHTML = `<span class="profile-section-label">Trains</span>`;
  const giOptions = document.createElement('div');
  giOptions.className = 'gi-options';
  let selectedGi = profile.gi_preference || 'both';
  GI_OPTIONS.forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.className = 'gi-btn' + (value === selectedGi ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      selectedGi = value;
      giOptions.querySelectorAll('.gi-btn').forEach(el => el.classList.toggle('active', el.textContent === label));
    });
    giOptions.appendChild(btn);
  });
  giSection.appendChild(giOptions);
  container.appendChild(giSection);

  // Primary guard picker (single select)
  const guardSection = buildNodePicker('Primary guard', GUARD_TYPES, profile.primary_guard ? [profile.primary_guard] : [], false);
  container.appendChild(guardSection.el);

  // Passing style (single select)
  const passSection = buildNodePicker('Passing style', PASSING_TYPES, profile.passing_style ? [profile.passing_style] : [], false);
  container.appendChild(passSection.el);

  // Favourite submissions (multi select)
  const subSection = buildNodePicker('Favourite submissions', SUB_TYPES, profile.submission_prefs || [], true);
  container.appendChild(subSection.el);

  // Notes
  const notesSection = document.createElement('div');
  notesSection.className = 'profile-section';
  notesSection.innerHTML = `<span class="profile-section-label">Anything else? (injuries, goals, style)</span>`;
  const notesArea = document.createElement('textarea');
  notesArea.className = 'profile-notes';
  notesArea.placeholder = 'e.g. "Recovering from a knee injury, avoiding leg entanglements"';
  notesArea.value = profile.notes || '';
  notesSection.appendChild(notesArea);
  container.appendChild(notesSection);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'profile-footer';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'profile-save-btn';
  saveBtn.textContent = 'Save game profile';
  const savedEl = document.createElement('span');
  savedEl.className = 'profile-saved';
  savedEl.textContent = '✓ Saved';
  footer.appendChild(saveBtn);
  footer.appendChild(savedEl);
  container.appendChild(footer);

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const body = {
        belt: selectedBelt,
        gi_preference: selectedGi,
        primary_guard: guardSection.getSelected()[0] || null,
        passing_style: passSection.getSelected()[0] || null,
        submission_prefs: subSection.getSelected(),
        notes: notesArea.value.trim() || null,
      };
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      _profile = data.profile;
      savedEl.classList.add('visible');
      setTimeout(() => savedEl.classList.remove('visible'), 2000);
    } catch {}
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save game profile';
  });
}

function buildNodePicker(label, types, initialValues, multi) {
  const section = document.createElement('div');
  section.className = 'profile-section';

  const lbl = document.createElement('span');
  lbl.className = 'profile-section-label';
  lbl.textContent = label;
  section.appendChild(lbl);

  const wrap = document.createElement('div');
  wrap.className = 'node-picker-wrap';

  const input = document.createElement('input');
  input.className = 'node-picker-input';
  input.type = 'text';
  input.placeholder = 'Search…';
  input.autocomplete = 'off';
  wrap.appendChild(input);

  const selectedWrap = document.createElement('div');
  selectedWrap.className = 'node-picker-selected';
  wrap.appendChild(selectedWrap);

  let selected = [...initialValues];

  const renderSelected = () => {
    selectedWrap.innerHTML = '';
    selected.forEach(nodeId => {
      const node = nodeList.find(n => n.id === nodeId);
      if (!node) return;
      const chip = document.createElement('span');
      chip.className = 'node-picker-chip';
      chip.innerHTML = `${escHtml(node.name)}<button class="node-picker-chip-remove" aria-label="Remove ${escHtml(node.name)}">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        selected = selected.filter(id => id !== nodeId);
        renderSelected();
      });
      selectedWrap.appendChild(chip);
    });
  };
  renderSelected();

  // Filter nodes by type and input text
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) return;
    const matches = nodeList
      .filter(n => types.includes(n.type) && n.name.toLowerCase().includes(q) && !selected.includes(n.id))
      .slice(0, 8);
    // Use datalist for suggestions
    let dl = wrap.querySelector('datalist');
    if (!dl) { dl = document.createElement('datalist'); dl.id = `picker-dl-${Math.random().toString(36).slice(2)}`; input.setAttribute('list', dl.id); wrap.appendChild(dl); }
    dl.innerHTML = matches.map(n => `<option value="${escHtml(n.name)}" data-id="${escHtml(n.id)}">`).join('');
  });

  input.addEventListener('change', () => {
    const val = input.value.trim();
    const node = nodeList.find(n => n.name.toLowerCase() === val.toLowerCase() && types.includes(n.type));
    if (!node) return;
    if (!selected.includes(node.id)) {
      if (!multi) selected = [node.id];
      else selected.push(node.id);
      renderSelected();
    }
    input.value = '';
  });

  section.appendChild(wrap);
  return { el: section, getSelected: () => selected };
}

// ── User menu ─────────────────────────────────────────────
function openUserMenu(btn) {
  const menu = document.getElementById('user-menu');
  if (menu.style.display !== 'none') { closeUserMenu(); return; }
  const rect = btn.getBoundingClientRect();
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  menu.style.left = 'auto';
  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', closeUserMenu, { once: true }), 0);
}

function closeUserMenu() {
  document.getElementById('user-menu').style.display = 'none';
}

async function signOut() {
  closeUserMenu();
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  _profile = null;
  renderAuthState();
  goHome();
}
