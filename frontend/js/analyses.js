    async function _autoSaveNotes(id, noteArea, timeline, savedEl) {
      const eventNotes = {};
      timeline.querySelectorAll('.ev-note-text').forEach(el => {
        const val = el.textContent.trim();
        if (val) eventNotes[el.dataset.ts] = val;
      });
      try {
        await fetch(`/api/analyses/${id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ global_note: noteArea.value, event_notes: eventNotes }),
        });
        savedEl.classList.add('visible');
        setTimeout(() => savedEl.classList.remove('visible'), 1800);
      } catch {}
    }

    async function loadAnalysisFromHistory(id, push = true) {
      try {
        const res = await fetch(`/api/analyses/${id}`);
        if (!res.ok) return;
        const data = await res.json();

        if (push) history.pushState({ analysis_id: id }, '', `/a/${id}`);
        entries.innerHTML = '';
        hasResults = true;
        setMode('results');
        document.title = `${data.title} — Tapcodex`;

        const eventNotes = data.event_notes || {};
        let shareUrl = null;

        const entry = document.createElement('div');
        entry.className = 'entry';

        const entryQ = document.createElement('div');
        entryQ.className = 'entry-q';
        entryQ.innerHTML = `<span class="entry-q-glyph" aria-hidden="true">▶</span>
          <span class="entry-q-text">${escHtml(data.title)}</span>`;
        entry.appendChild(entryQ);

        const entryA = document.createElement('div');
        entryA.className = 'entry-a';

        // ── Share panel ──────────────────────────────────────
        const sharePanel = document.createElement('div');
        sharePanel.className = 'an-share-panel';

        const shareHead = document.createElement('div');
        shareHead.className = 'an-share-head';

        const shareLabel = document.createElement('span');
        shareLabel.className = 'an-share-label';
        shareLabel.textContent = data.is_shared ? 'Shared' : 'Share this analysis';

        const shareToggle = document.createElement('button');
        shareToggle.className = 'an-share-toggle' + (data.is_shared ? ' active' : '');
        shareToggle.textContent = data.is_shared ? 'Sharing on' : 'Share';

        shareHead.appendChild(shareLabel);
        shareHead.appendChild(shareToggle);
        sharePanel.appendChild(shareHead);

        const shareBody = document.createElement('div');
        shareBody.className = 'an-share-body';
        shareBody.style.display = data.is_shared ? 'flex' : 'none';

        const shareLinkEl = document.createElement('span');
        shareLinkEl.className = 'an-share-link';
        shareLinkEl.title = 'Click to select';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'an-copy-btn';
        copyBtn.textContent = 'Copy';

        const revokeBtn = document.createElement('button');
        revokeBtn.className = 'an-revoke-btn';
        revokeBtn.textContent = 'Revoke';

        shareBody.appendChild(shareLinkEl);
        shareBody.appendChild(copyBtn);
        shareBody.appendChild(revokeBtn);
        sharePanel.appendChild(shareBody);

        const populateShareUrl = (url) => {
          shareUrl = url;
          shareLinkEl.textContent = url;
        };

        if (data.is_shared) {
          fetch(`/api/analyses/${id}/share`, { method: 'POST' })
            .then(r => r.json()).then(d => populateShareUrl(d.share_url));
        }

        shareToggle.addEventListener('click', async () => {
          if (shareToggle.classList.contains('active')) return;
          shareToggle.textContent = 'Sharing…';
          const r = await fetch(`/api/analyses/${id}/share`, { method: 'POST' });
          const d = await r.json();
          populateShareUrl(d.share_url);
          shareToggle.classList.add('active');
          shareToggle.textContent = 'Sharing on';
          shareLabel.textContent = 'Shared';
          shareBody.style.display = 'flex';
        });

        copyBtn.addEventListener('click', () => {
          if (!shareUrl) return;
          navigator.clipboard.writeText(shareUrl);
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1800);
        });

        revokeBtn.addEventListener('click', async () => {
          await fetch(`/api/analyses/${id}/share`, { method: 'DELETE' });
          shareBody.style.display = 'none';
          shareToggle.classList.remove('active');
          shareToggle.textContent = 'Share';
          shareLabel.textContent = 'Share this analysis';
        });

        entryA.appendChild(sharePanel);

        // ── Fight header ─────────────────────────────────────
        const header = document.createElement('div');
        header.className = 'fight-header';
        header.innerHTML = `
          <div class="fight-meta">
            <div class="fight-title">${escHtml(data.title)}</div>
            <div class="fight-summary">${escHtml(data.summary || '')}</div>
            ${data.fighter_a && data.fighter_a !== 'Fighter A'
              ? `<div class="fight-fighters">${escHtml(data.fighter_a)} vs ${escHtml(data.fighter_b)}</div>`
              : ''}
          </div>`;
        entryA.appendChild(header);

        // ── Coach notes ──────────────────────────────────────
        const notesSection = document.createElement('div');
        notesSection.className = 'an-notes-section';

        const notesLabelRow = document.createElement('div');
        notesLabelRow.className = 'an-notes-label';
        notesLabelRow.innerHTML = `<span>Your notes</span>`;
        const savedEl = document.createElement('span');
        savedEl.className = 'an-notes-saved';
        savedEl.textContent = '✓ Saved';
        notesLabelRow.appendChild(savedEl);
        notesSection.appendChild(notesLabelRow);

        const noteArea = document.createElement('textarea');
        noteArea.className = 'an-notes-textarea';
        noteArea.placeholder = 'Add coaching notes for this analysis — they appear for anyone you share this with.';
        noteArea.value = data.global_note || '';
        notesSection.appendChild(noteArea);
        entryA.appendChild(notesSection);

        // ── Timeline with inline per-event notes ─────────────
        const timeline = document.createElement('div');
        timeline.className = 'fight-timeline';

        for (const ev of data.events || []) {
          const row = buildTimelineRow(ev, new Map());
          const tsKey = String(ev.timestamp ?? 0);
          const existingNote = eventNotes[tsKey] || '';

          // Append note body into .timeline-info, not the flex row
          const info = row.querySelector('.timeline-info');
          if (info) {
            const noteBody = document.createElement('div');
            noteBody.className = 'ev-note-body' + (existingNote ? ' has-note' : '');

            const noteEl = document.createElement('div');
            noteEl.className = 'ev-note-text';
            noteEl.contentEditable = 'true';
            noteEl.dataset.ts = tsKey;
            noteEl.textContent = existingNote;
            noteEl.setAttribute('aria-label', 'Note for this moment');

            noteEl.addEventListener('focus', () => noteBody.classList.add('editing'));
            noteEl.addEventListener('blur', () => {
              noteBody.classList.remove('editing');
              const val = noteEl.textContent.trim();
              noteBody.classList.toggle('has-note', !!val);
              _autoSaveNotes(id, noteArea, timeline, savedEl);
            });

            noteBody.appendChild(noteEl);
            info.appendChild(noteBody);
          }

          timeline.appendChild(row);
        }

        applyChips(timeline);
        entryA.appendChild(timeline);

        // Auto-save on blur from global note area
        const triggerSave = () => _autoSaveNotes(id, noteArea, timeline, savedEl);
        noteArea.addEventListener('blur', triggerSave);

        entry.appendChild(entryA);
        entries.appendChild(entry);
        entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        console.error('Failed to load analysis', e);
      }
    }

    // ── Shared public view ────────────────────────────────────
    async function loadSharedAnalysis(token, push = true) {
      if (push) history.pushState({ share_token: token }, '', `/s/${token}`);
      setMode('shared');
      const container = document.getElementById('shared-content');
      container.innerHTML = `<p style="color:var(--ink-3);font-family:var(--mono);font-size:0.80rem;padding-top:8px">Loading…</p>`;

      try {
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          container.innerHTML = `<p style="color:var(--ink-3);font-family:var(--mono);font-size:0.85rem">This analysis is no longer shared or doesn't exist.</p>`;
          return;
        }
        const data = await res.json();
        const eventNotes = data.event_notes || {};
        document.title = `${data.title} — Tapcodex`;

        container.innerHTML = '';

        // Title block
        const titleEl = document.createElement('h1');
        titleEl.className = 'shared-title';
        titleEl.textContent = data.title;
        container.appendChild(titleEl);

        if (data.fighter_a && data.fighter_a !== 'Fighter A') {
          const fightersEl = document.createElement('div');
          fightersEl.className = 'shared-fighters';
          fightersEl.textContent = `${data.fighter_a} vs ${data.fighter_b}`;
          container.appendChild(fightersEl);
        }

        if (data.summary) {
          const summaryEl = document.createElement('p');
          summaryEl.className = 'shared-summary';
          summaryEl.textContent = data.summary;
          container.appendChild(summaryEl);
        }

        // Coach note
        if (data.global_note) {
          const noteBlock = document.createElement('div');
          noteBlock.className = 'shared-coach-note';
          const byline = document.createElement('div');
          byline.className = 'shared-coach-note-byline';
          byline.textContent = 'Coach notes';
          const body = document.createElement('div');
          body.className = 'shared-coach-note-body';
          body.textContent = data.global_note;
          noteBlock.appendChild(byline);
          noteBlock.appendChild(body);
          container.appendChild(noteBlock);
        }

        // Timeline
        const timeline = document.createElement('div');
        timeline.className = 'fight-timeline';
        for (const ev of data.events || []) {
          const row = buildTimelineRow(ev, new Map());
          const tsKey = String(ev.timestamp ?? 0);
          if (eventNotes[tsKey]) {
            const noteEl = document.createElement('div');
            noteEl.className = 'shared-ev-note';
            noteEl.textContent = eventNotes[tsKey];
            row.appendChild(noteEl);
          }
          timeline.appendChild(row);
        }
        applyChips(timeline);
        container.appendChild(timeline);

        // Bottom CTA
        const cta = document.createElement('div');
        cta.className = 'shared-bottom-cta';
        cta.innerHTML = `
          <span class="shared-bottom-cta-text">Analyse your own matches</span>
          <a href="/" class="shared-bottom-cta-link">Try Tapcodex →</a>`;
        container.appendChild(cta);

      } catch {
        container.innerHTML = `<p style="color:var(--ink-3);font-family:var(--mono);font-size:0.85rem">Failed to load analysis.</p>`;
      }
    }

    // ── Graph visualizer ────────────────────────────────────
