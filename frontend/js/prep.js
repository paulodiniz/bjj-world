// ── Class Prep ───────────────────────────────────────────

const PREP_DURATIONS = [30, 45, 60, 90];
const PREP_ALL_TYPES = ['position', 'technique', 'submission', 'guard_pass',
                        'concept', 'system', 'sweep', 'takedown', 'escape', 'counter'];

let _prepAbort = null;

function openPrep() {
  setMode('prep');
  history.pushState({}, '', '/prep');
  document.title = 'Class Prep — Tapcodex';
  renderPrepPage();
}

function renderPrepPage() {
  const container = document.getElementById('prep-content');
  container.innerHTML = '';

  // Header
  const head = document.createElement('div');
  head.className = 'prep-head';
  head.innerHTML = `
    <h2 class="prep-title">Class Prep</h2>
    <p class="prep-sub">Pick a technique — get a mat-ready lesson plan from the knowledge graph</p>`;
  container.appendChild(head);

  // Form
  const form = document.createElement('div');
  form.className = 'prep-form';

  // Technique picker
  const techSection = buildNodePicker('Technique or position', PREP_ALL_TYPES, [], false);
  techSection.el.querySelector('.profile-section-label').className = 'prep-field-label';
  techSection.el.className = 'prep-field';
  form.appendChild(techSection.el);

  // Duration selector
  const durField = document.createElement('div');
  durField.className = 'prep-field';
  durField.innerHTML = `<span class="prep-field-label" id="prep-label-duration">Session length</span>`;
  const durOptions = document.createElement('div');
  durOptions.className = 'prep-duration-options';
  durOptions.setAttribute('role', 'group');
  durOptions.setAttribute('aria-labelledby', 'prep-label-duration');
  let selectedDuration = 60;
  PREP_DURATIONS.forEach(d => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prep-duration-btn' + (d === selectedDuration ? ' active' : '');
    btn.textContent = `${d} min`;
    btn.setAttribute('aria-pressed', d === selectedDuration ? 'true' : 'false');
    btn.addEventListener('click', () => {
      selectedDuration = d;
      durOptions.querySelectorAll('.prep-duration-btn').forEach((el, i) => {
        const match = PREP_DURATIONS[i] === d;
        el.classList.toggle('active', match);
        el.setAttribute('aria-pressed', match ? 'true' : 'false');
      });
    });
    durOptions.appendChild(btn);
  });
  durField.appendChild(durOptions);
  form.appendChild(durField);

  // Generate button
  const genBtn = document.createElement('button');
  genBtn.type = 'button';
  genBtn.className = 'prep-generate-btn';
  genBtn.textContent = 'Generate plan';
  form.appendChild(genBtn);
  container.appendChild(form);

  // Plan output area
  const planArea = document.createElement('div');
  planArea.className = 'prep-plan';
  planArea.id = 'prep-plan-area';

  const statusEl = document.createElement('div');
  statusEl.className = 'prep-status';
  statusEl.id = 'prep-status';
  statusEl.innerHTML = `<span class="prep-status-dot" aria-hidden="true"></span><span>Building lesson plan…</span>`;
  statusEl.style.display = 'none';
  planArea.appendChild(statusEl);

  const planBody = document.createElement('div');
  planBody.className = 'prep-plan-body';
  planBody.id = 'prep-plan-body';
  planArea.appendChild(planBody);

  const errorEl = document.createElement('p');
  errorEl.className = 'prep-error';
  errorEl.id = 'prep-error';
  planArea.appendChild(errorEl);

  const againBtn = document.createElement('button');
  againBtn.type = 'button';
  againBtn.className = 'prep-again-btn';
  againBtn.textContent = '← Generate another';
  againBtn.style.display = 'none';
  againBtn.addEventListener('click', () => {
    planArea.classList.remove('visible');
    planBody.innerHTML = '';
    errorEl.textContent = '';
    againBtn.style.display = 'none';
    genBtn.disabled = false;
    genBtn.textContent = 'Generate plan';
  });
  planArea.appendChild(againBtn);
  container.appendChild(planArea);

  genBtn.addEventListener('click', async () => {
    const selected = techSection.getSelected();
    if (!selected.length) {
      techSection.el.querySelector('.node-picker-input').focus();
      return;
    }

    if (_prepAbort) _prepAbort.abort();
    _prepAbort = new AbortController();

    genBtn.disabled = true;
    genBtn.textContent = 'Generating…';
    planBody.innerHTML = '';
    errorEl.textContent = '';
    againBtn.style.display = 'none';
    planArea.classList.add('visible');
    statusEl.style.display = 'flex';

    let buffer = '';

    try {
      const res = await fetch('/api/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technique_id: selected[0], duration: selectedDuration }),
        signal: _prepAbort.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const parts = sseBuffer.split('\n\n');
        sseBuffer = parts.pop();

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === 'status') {
            const lbl = statusEl.querySelector('span:last-child');
            if (lbl) lbl.textContent = event.text;
          } else if (event.type === 'token') {
            if (statusEl.style.display !== 'none') statusEl.style.display = 'none';
            buffer += event.text;
            planBody.innerHTML = marked.parse(buffer);
          } else if (event.type === 'done') {
            statusEl.style.display = 'none';
            againBtn.style.display = '';
            genBtn.disabled = false;
            genBtn.textContent = 'Generate plan';
          } else if (event.type === 'error') {
            statusEl.style.display = 'none';
            errorEl.textContent = event.text;
            genBtn.disabled = false;
            genBtn.textContent = 'Generate plan';
            againBtn.style.display = '';
          }
        }
      }
    } catch (err) {
      statusEl.style.display = 'none';
      if (err.name !== 'AbortError') {
        errorEl.textContent = 'Something went wrong — try again.';
      }
      genBtn.disabled = false;
      genBtn.textContent = 'Generate plan';
      againBtn.style.display = '';
    }
  });
}
