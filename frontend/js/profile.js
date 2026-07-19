// ── Profile ──────────────────────────────────────────────

const BELT_LEVELS = ['white', 'blue', 'purple', 'brown', 'black'];
const GI_OPTIONS  = [{ value: 'gi', label: 'Gi' }, { value: 'nogi', label: 'No-Gi' }, { value: 'both', label: 'Both' }];

const GUARD_TYPES    = ['position', 'technique'];
const PASSING_TYPES  = ['guard_pass', 'technique'];
const SUB_TYPES      = ['submission'];
const GAME_TYPES     = ['position', 'technique', 'submission', 'guard_pass', 'concept', 'system', 'sweep', 'takedown', 'escape'];

let _profile = null; // cached after first load

function openProfile() {
  closeUserMenu();
  document.getElementById('profile-nudge').style.display = 'none';
  setMode('profile');
  history.pushState({}, '', '/profile');
  document.title = 'My game — Tapcodex';
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
  const beltLabelId = 'profile-label-belt';
  beltSection.innerHTML = `<span class="profile-section-label" id="${beltLabelId}">Belt</span>`;
  const beltOptions = document.createElement('div');
  beltOptions.className = 'belt-options';
  beltOptions.setAttribute('role', 'group');
  beltOptions.setAttribute('aria-labelledby', beltLabelId);
  let selectedBelt = profile.belt || 'white';
  BELT_LEVELS.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'belt-btn' + (b === selectedBelt ? ' active' : '');
    btn.textContent = b;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-pressed', b === selectedBelt ? 'true' : 'false');
    btn.addEventListener('click', () => {
      selectedBelt = b;
      beltOptions.querySelectorAll('.belt-btn').forEach(el => {
        const match = el.textContent === b;
        el.classList.toggle('active', match);
        el.setAttribute('aria-pressed', match ? 'true' : 'false');
      });
    });
    beltOptions.appendChild(btn);
  });
  beltSection.appendChild(beltOptions);
  container.appendChild(beltSection);

  // Gi preference
  const giSection = document.createElement('div');
  giSection.className = 'profile-section';
  const giLabelId = 'profile-label-gi';
  giSection.innerHTML = `<span class="profile-section-label" id="${giLabelId}">Trains</span>`;
  const giOptions = document.createElement('div');
  giOptions.className = 'gi-options';
  giOptions.setAttribute('role', 'group');
  giOptions.setAttribute('aria-labelledby', giLabelId);
  let selectedGi = profile.gi_preference || 'both';
  GI_OPTIONS.forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.className = 'gi-btn' + (value === selectedGi ? ' active' : '');
    btn.textContent = label;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-pressed', value === selectedGi ? 'true' : 'false');
    btn.addEventListener('click', () => {
      selectedGi = value;
      giOptions.querySelectorAll('.gi-btn').forEach((el, i) => {
        const match = GI_OPTIONS[i].value === value;
        el.classList.toggle('active', match);
        el.setAttribute('aria-pressed', match ? 'true' : 'false');
      });
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

  // Favourite game / focus (multi select node picker)
  const gameSection = buildNodePicker('Favourite game / focus', GAME_TYPES, profile.favourite_game || [], true);
  const gameHint = document.createElement('p');
  gameHint.className = 'profile-field-hint';
  gameHint.textContent = 'The AI connects its answers to your game when you ask questions.';
  gameSection.el.appendChild(gameHint);
  container.appendChild(gameSection.el);

  // Notes
  const notesSection = document.createElement('div');
  notesSection.className = 'profile-section';
  const notesLabelId = 'profile-label-notes';
  notesSection.innerHTML = `<span class="profile-section-label" id="${notesLabelId}">Anything else? (injuries, goals, style)</span>`;
  const notesArea = document.createElement('textarea');
  notesArea.className = 'profile-notes';
  notesArea.id = 'profile-notes-input';
  notesArea.setAttribute('aria-labelledby', notesLabelId);
  notesArea.placeholder = 'e.g. "Recovering from a knee injury, avoiding leg entanglements"';
  notesArea.value = profile.notes || '';
  notesSection.appendChild(notesArea);
  container.appendChild(notesSection);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'profile-footer';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'profile-save-btn';
  saveBtn.setAttribute('type', 'button');
  saveBtn.textContent = 'Save profile';
  const savedEl = document.createElement('span');
  savedEl.className = 'profile-saved';
  savedEl.textContent = '✓ Saved';
  savedEl.setAttribute('role', 'status');
  savedEl.setAttribute('aria-live', 'polite');
  savedEl.setAttribute('aria-hidden', 'true');
  const errorEl = document.createElement('span');
  errorEl.className = 'profile-save-error';
  footer.appendChild(saveBtn);
  footer.appendChild(savedEl);
  footer.appendChild(errorEl);
  container.appendChild(footer);

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    errorEl.textContent = '';
    try {
      const body = {
        belt: selectedBelt,
        gi_preference: selectedGi,
        primary_guard: guardSection.getSelected()[0] || null,
        passing_style: passSection.getSelected()[0] || null,
        submission_prefs: subSection.getSelected(),
        favourite_game: gameSection.getSelected(),
        notes: notesArea.value.trim() || null,
      };
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const data = await res.json();
      _profile = data.profile;
      // Hide nudge permanently once the user has saved
      document.getElementById('profile-nudge').style.display = 'none';
      savedEl.setAttribute('aria-hidden', 'false');
      savedEl.classList.add('visible');
      setTimeout(() => {
        savedEl.classList.remove('visible');
        savedEl.setAttribute('aria-hidden', 'true');
      }, 3000);
    } catch (e) {
      errorEl.textContent = 'Save failed — try again.';
    }
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save profile';
  });
}

function buildNodePicker(label, types, initialValues, multi) {
  const section = document.createElement('div');
  section.className = 'profile-section';

  const labelId = 'profile-label-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const lbl = document.createElement('span');
  lbl.className = 'profile-section-label';
  lbl.id = labelId;
  lbl.textContent = label;
  section.appendChild(lbl);

  const wrap = document.createElement('div');
  wrap.className = 'node-picker-wrap';

  const input = document.createElement('input');
  input.className = 'node-picker-input';
  input.type = 'text';
  input.placeholder = 'Search…';
  input.autocomplete = 'off';
  input.setAttribute('aria-labelledby', labelId);
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
      chip.innerHTML = `${escHtml(node.name)}<button class="node-picker-chip-remove" type="button" aria-label="Remove ${escHtml(node.name)}">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        selected = selected.filter(id => id !== nodeId);
        renderSelected();
      });
      selectedWrap.appendChild(chip);
    });
  };
  renderSelected();

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) return;
    const matches = nodeList
      .filter(n => types.includes(n.type) && n.name.toLowerCase().includes(q) && !selected.includes(n.id))
      .slice(0, 8);
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
