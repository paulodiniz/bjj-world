    function useHint(btn) { fillQuery(btn.textContent.trim()); }

    function fillQuery(text) {
      const mode = document.documentElement.dataset.mode;
      if (mode === 'landing') {
        document.getElementById('landing-input').value = text;
        document.getElementById('landing-input').focus();
      } else {
        document.getElementById('header-input').value = text;
        document.getElementById('header-input').focus();
      }
      if (mode === 'path') setMode(hasResults ? 'results' : 'landing');
    }

    // ── Chat ────────────────────────────────────────────────
    const entries      = document.getElementById('entries');
    const conversationHistory = [];
    let abortCtrl = null;
    let lastQuestion  = '';

    function isDirectVideoUrl(text) {
      return /^https?:\/\/.+\.(mp4|mov|webm|mkv|avi|m4v)(\?.*)?$/i.test(text) ||
        /dropbox\.com\//.test(text) ||
        /dropboxusercontent\.com\//.test(text) ||
        /drive\.google\.com\/file\//.test(text);
    }

    document.getElementById('landing-form').addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('landing-input').value.trim();
      document.getElementById('landing-input').value = '';
      if (!q) return;
      if (isDirectVideoUrl(q)) { submitDirectVideoAnalysis(q); } else { submitQuestion(q); }
    });

    document.getElementById('header-form').addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('header-input').value.trim();
      document.getElementById('header-input').value = '';
      if (!q) return;
      if (isDirectVideoUrl(q)) { submitDirectVideoAnalysis(q); } else { submitQuestion(q); }
    });

    document.getElementById('header-stop-btn').addEventListener('click', () => {
      if (abortCtrl) abortCtrl.abort();
    });

    async function submitQuestion(question) {
      // Cancel any active stream
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();

      lastQuestion = question;
      conversationHistory.push({ role: 'user', content: question });

      if (!hasResults) { hasResults = true; setMode('results'); }

      // Build entry
      const entry = document.createElement('div');
      entry.className = 'entry';

      const entryQ = document.createElement('div');
      entryQ.className = 'entry-q';
      entryQ.innerHTML = `<span class="entry-q-glyph" aria-hidden="true">▸</span><span class="entry-q-text">${escHtml(question)}</span>`;

      const entryA = document.createElement('div');
      entryA.className = 'entry-a';
      entryA.setAttribute('data-streaming', '');

      const statusEl = document.createElement('div');
      statusEl.className = 'entry-status';
      statusEl.innerHTML = '<span class="status-dot" aria-hidden="true"></span><span class="status-label">Searching…</span>';
      entryA.appendChild(statusEl);

      entry.appendChild(entryQ);
      entry.appendChild(entryA);
      entries.appendChild(entry);
      entry.scrollIntoView({ behavior: 'smooth', block: 'start' });

      setStreaming(true);

      let buffer = '';
      let textEl = null;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, history: conversationHistory.slice(-6), conversation_id: currentConversationId }),
          signal: abortCtrl.signal
        });

        const reader  = res.body.getReader();
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

            if (event.type === 'conversation_id') {
              currentConversationId = event.id;
              history.pushState({ conversation_id: event.id }, '', `/c/${event.id}`);

            } else if (event.type === 'status') {
              const lbl = statusEl.querySelector('.status-label');
              if (lbl) lbl.textContent = event.text;

            } else if (event.type === 'token') {
              if (statusEl.parentNode) statusEl.remove();
              if (!textEl) {
                textEl = document.createElement('div');
                textEl.className = 'answer-text';
                entryA.appendChild(textEl);
              }
              buffer += event.text;
              textEl.innerHTML = marked.parse(buffer);
              entry.scrollIntoView({ behavior: 'smooth', block: 'end' });

            } else if (event.type === 'videos') {
              const videosDiv = document.createElement('div');
              videosDiv.className = 'videos';
              videosDiv.innerHTML = event.videos.map(v => {
                const id = new URL(v.url).searchParams.get('v');
                if (!id) return '';
                return `<div class="video-card">
                  <div class="video-label">${escHtml(v.name)}</div>
                  <iframe src="https://www.youtube.com/embed/${id}"
                    title="${escHtml(v.name)} — BJJ tutorial"
                    allowfullscreen loading="lazy"></iframe>
                </div>`;
              }).join('');
              entryA.appendChild(videosDiv);

            } else if (event.type === 'done') {
              entryA.removeAttribute('data-streaming');
              if (statusEl.parentNode) statusEl.remove();
              if (textEl) applyChips(textEl);
              if (buffer) conversationHistory.push({ role: 'assistant', content: buffer });

            } else if (event.type === 'error') {
              entryA.removeAttribute('data-streaming');
              showError(entryA, event.text, question);
            }
          }
        }
      } catch (err) {
        entryA.removeAttribute('data-streaming');
        if (err.name === 'AbortError') {
          if (statusEl.parentNode) statusEl.remove();
          if (!textEl && buffer === '') {
            entryA.innerHTML = '';
            const cancelled = document.createElement('p');
            cancelled.style.cssText = 'font-family:var(--mono);font-size:0.75rem;color:var(--ink-3)';
            cancelled.textContent = 'Stopped.';
            entryA.appendChild(cancelled);
          }
        } else {
          showError(entryA, err.message, question);
        }
      } finally {
        setStreaming(false);
        abortCtrl = null;
      }
    }

    function showError(container, msg, question) {
      if (container.querySelector('.entry-status')) {
        container.querySelector('.entry-status').remove();
      }
      const err = document.createElement('div');
      err.className = 'entry-error';
      err.innerHTML = `
        <span class="entry-error-msg">${escHtml(msg || 'Something went wrong — try asking again.')}</span>
        <button class="retry-btn" type="button">Retry</button>`;
      err.querySelector('.retry-btn').addEventListener('click', () => {
        container.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'entry-status';
        statusEl.innerHTML = '<span class="status-dot"></span><span class="status-label">Retrying…</span>';
        container.appendChild(statusEl);
        submitQuestion(question);
      });
      container.appendChild(err);
      console.warn('Chat error:', msg);
    }

    function setStreaming(on) {
      document.getElementById('header-ask-btn').style.display  = on ? 'none' : '';
      document.getElementById('header-stop-btn').style.display = on ? '' : 'none';
    }

    function escHtml(str) {
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function nearestFrame(frameStore, timestamp) {
      if (frameStore.size === 0) return null;
      let best = null, bestDist = Infinity;
      for (const [ts, data] of frameStore) {
        const dist = Math.abs(ts - timestamp);
        if (dist < bestDist) { bestDist = dist; best = data; }
      }
      return best;
    }

    function buildTimelineRow(event, frameStore) {
      const BADGE_LABELS = { position:'position', transition:'transition', submission_attempt:'sub attempt', submission:'submission ✓', sweep:'sweep', guard_pass:'guard pass', escape:'escape', takedown:'takedown' };
      const badge = event.badge || 'position';
      const thumb = nearestFrame(frameStore, event.timestamp);
      const row = document.createElement('div');
      row.className = 'timeline-row';

      const thumbEl = thumb
        ? `<img class="timeline-thumb" src="data:image/jpeg;base64,${thumb}" alt="Frame at ${escHtml(event.label)}">`
        : `<div class="timeline-thumb" style="display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:0.68rem;color:var(--ink-3)">${escHtml(event.label)}</div>`;

      const relatedHtml = (event.related || []).length > 0
        ? `<div class="timeline-related">${event.related.map(n =>
            `<span class="nc nc-${escHtml(n.type)}" role="button" tabindex="0" title="${escHtml(n.type.replace('_',' '))}">${escHtml(n.name)}</span>`
          ).join('')}</div>`
        : '';

      row.innerHTML = `
        ${thumbEl}
        <div class="timeline-info">
          <div class="timeline-meta">
            <span class="timeline-ts">${escHtml(event.label)}</span>
            <span class="timeline-badge ${escHtml(badge)}">${escHtml(BADGE_LABELS[badge] || badge)}</span>
          </div>
          <span class="timeline-desc">${escHtml(event.description)}</span>
          ${relatedHtml}
        </div>`;

      // wire up related chip clicks
      row.querySelectorAll('.timeline-related .nc').forEach(chip => {
        const name = chip.textContent;
        chip.addEventListener('click', () => fillQuery(`Tell me more about ${name}`));
        chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fillQuery(`Tell me more about ${name}`); });
      });

      return row;
    }

