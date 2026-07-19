    async function _removed_submitVideoAnalysis(url, videoId) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();

      if (!hasResults) { hasResults = true; setMode('results'); }

      // Entry shell
      const entry = document.createElement('div');
      entry.className = 'entry';

      const entryQ = document.createElement('div');
      entryQ.className = 'entry-q';
      entryQ.innerHTML = `<span class="entry-q-glyph" aria-hidden="true">▸</span>
        <span class="entry-q-text">Analysing fight: <a href="${escHtml(url)}" target="_blank" rel="noopener" style="color:var(--accent-text)">${escHtml(url.length > 60 ? url.slice(0, 60) + '…' : url)}</a></span>`;

      const entryA = document.createElement('div');
      entryA.className = 'entry-a';
      entryA.setAttribute('data-streaming', '');

      const statusEl = document.createElement('div');
      statusEl.className = 'entry-status';
      statusEl.innerHTML = '<span class="status-dot" aria-hidden="true"></span><span class="status-label">Starting…</span>';
      entryA.appendChild(statusEl);

      entry.appendChild(entryQ);
      entry.appendChild(entryA);
      entries.appendChild(entry);
      entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setStreaming(true);

      // Placeholders filled in by events
      let fightHeader = null;
      let fightTimeline = null;
      let fightSummaryEl = null;

      try {
        const res = await fetch('/api/analyze-fight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: abortCtrl.signal,
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

            if (event.type === 'status') {
              const lbl = statusEl.querySelector('.status-label');
              if (lbl) lbl.textContent = event.text;

            } else if (event.type === 'video-info') {
              if (statusEl.parentNode) statusEl.remove();

              // Build fight header with embed + meta
              fightHeader = document.createElement('div');
              fightHeader.className = 'fight-header';
              fightHeader.innerHTML = `
                <div class="fight-embed">
                  <iframe src="https://www.youtube.com/embed/${escHtml(event.videoId)}"
                    title="${escHtml(event.title)} — BJJ match"
                    allowfullscreen loading="lazy"></iframe>
                </div>
                <div class="fight-meta">
                  <div class="fight-title">${escHtml(event.title)}</div>
                  <div class="fight-summary" id="fight-summary-${escHtml(event.videoId)}"></div>
                  <div class="fight-fighters" id="fight-fighters-${escHtml(event.videoId)}"></div>
                </div>`;
              entryA.appendChild(fightHeader);
              fightSummaryEl = fightHeader.querySelector(`#fight-summary-${event.videoId}`);

              fightTimeline = document.createElement('div');
              fightTimeline.className = 'fight-timeline';
              entryA.appendChild(fightTimeline);

              // Re-show status inside entry-a for the long analysis step
              entryA.appendChild(statusEl);

            } else if (event.type === 'analysis-summary') {
              if (fightSummaryEl) fightSummaryEl.textContent = event.summary;
              const fightersEl = fightHeader?.querySelector(`[id^="fight-fighters-"]`);
              if (fightersEl && (event.fighter_a !== 'Fighter A' || event.fighter_b !== 'Fighter B')) {
                fightersEl.textContent = `${event.fighter_a} vs ${event.fighter_b}`;
              }

            } else if (event.type === 'analysis-event') {
              if (statusEl.parentNode) statusEl.remove();
              if (!fightTimeline) break;

              const BADGE_LABELS = {
                position: 'position',
                transition: 'transition',
                submission_attempt: 'sub attempt',
                submission: 'submission ✓',
                escape: 'escape',
                takedown: 'takedown',
              };

              const row = document.createElement('div');
              row.className = 'timeline-row';
              row.dataset.type = event.type;

              const tsHref = `https://www.youtube.com/watch?v=${escHtml(videoId)}&t=${event.timestamp}s`;
              row.innerHTML = `
                <a class="timeline-ts" href="${tsHref}" target="_blank" rel="noopener">${escHtml(event.label)}</a>
                <span class="timeline-badge ${escHtml(event.type)}">${escHtml(BADGE_LABELS[event.type] || event.type)}</span>
                <span class="timeline-desc">${escHtml(event.description)}</span>`;
              fightTimeline.appendChild(row);
              entry.scrollIntoView({ behavior: 'smooth', block: 'end' });

            } else if (event.type === 'analysis-text') {
              // Fallback: Claude returned plain text instead of JSON
              if (statusEl.parentNode) statusEl.remove();
              const pre = document.createElement('p');
              pre.className = 'analysis-raw';
              pre.textContent = event.text;
              entryA.appendChild(pre);

            } else if (event.type === 'analysis_id') {
              history.pushState({ analysis_id: event.id }, '', `/a/${event.id}`);

            } else if (event.type === 'done') {
              entryA.removeAttribute('data-streaming');
              if (statusEl.parentNode) statusEl.remove();
              if (fightTimeline) {
                fightTimeline.querySelectorAll('.timeline-desc').forEach(el => applyChips(el));
              }
              if (fightSummaryEl) applyChips(fightSummaryEl);

            } else if (event.type === 'error') {
              entryA.removeAttribute('data-streaming');
              showError(entryA, event.text, url);
            }
          }
        }
      } catch (err) {
        entryA.removeAttribute('data-streaming');
        if (err.name !== 'AbortError') showError(entryA, err.message, url);
        else if (statusEl.parentNode) statusEl.remove();
      } finally {
        setStreaming(false);
        abortCtrl = null;
      }
    }

    // ── File upload analysis ────────────────────────────────
    const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;
    document.getElementById('video-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';
      if (file.size > MAX_UPLOAD_BYTES) {
        showUploadError(`File too large (${(file.size / 1e6).toFixed(0)} MB — max 60 MB)`);
        return;
      }
      submitFileAnalysis(file);
    });

    function showUploadError(msg) {
      const zone = document.getElementById('upload-zone');
      if (!zone) return;
      let err = zone.querySelector('.upload-zone-error');
      if (!err) {
        err = document.createElement('span');
        err.className = 'upload-zone-error';
        zone.appendChild(err);
      }
      err.textContent = msg;
      clearTimeout(zone._errTimer);
      zone._errTimer = setTimeout(() => { if (err.parentNode) err.remove(); }, 4000);
    }

    const uploadZone = document.getElementById('upload-zone');
    if (uploadZone) {
      uploadZone.addEventListener('dragover', e => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
      });
      uploadZone.addEventListener('dragleave', e => {
        if (!uploadZone.contains(e.relatedTarget)) uploadZone.classList.remove('drag-over');
      });
      uploadZone.addEventListener('drop', e => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('video/')) return;
        if (file.size > MAX_UPLOAD_BYTES) { showUploadError(`File too large (${(file.size / 1e6).toFixed(0)} MB — max 60 MB)`); return; }
        submitFileAnalysis(file);
      });
    }

    async function submitFileAnalysis(file) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();

      if (!hasResults) { hasResults = true; setMode('results'); }

      const entry = document.createElement('div');
      entry.className = 'entry';

      const entryQ = document.createElement('div');
      entryQ.className = 'entry-q';
      entryQ.innerHTML = `<span class="entry-q-glyph" aria-hidden="true">▸</span>
        <span class="entry-q-text">Analysing uploaded file: <em style="color:var(--ink-2)">${escHtml(file.name)}</em></span>`;

      const entryA = document.createElement('div');
      entryA.className = 'entry-a';
      entryA.setAttribute('data-streaming', '');

      const statusEl = document.createElement('div');
      statusEl.className = 'entry-status';
      statusEl.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span class="status-label">Uploading ${(file.size / 1e6).toFixed(1)} MB…</span>`;
      entryA.appendChild(statusEl);

      entry.appendChild(entryQ);
      entry.appendChild(entryA);
      entries.appendChild(entry);
      entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setStreaming(true);

      let fightHeader = null, fightTimeline = null, fightSummaryEl = null;
      const frameStore = new Map(); // timestamp → base64 data

      try {
        const formData = new FormData();
        formData.append('video', file);

        const res = await fetch('/api/analyze-upload', {
          method: 'POST',
          body: formData,
          signal: abortCtrl.signal,
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
              const lbl = statusEl.querySelector('.status-label');
              if (lbl) lbl.textContent = event.text;

            } else if (event.type === 'video-info') {
              if (statusEl.parentNode) statusEl.remove();
              fightHeader = document.createElement('div');
              fightHeader.className = 'fight-header';
              fightHeader.innerHTML = `
                <div class="fight-meta">
                  <div class="fight-title">${escHtml(event.title)}</div>
                  <div class="fight-summary" id="fight-summary-upload"></div>
                  <div class="fight-fighters" id="fight-fighters-upload"></div>
                </div>`;
              entryA.appendChild(fightHeader);
              fightSummaryEl = fightHeader.querySelector('#fight-summary-upload');
              fightTimeline = document.createElement('div');
              fightTimeline.className = 'fight-timeline';
              entryA.appendChild(fightTimeline);
              entryA.appendChild(statusEl);

            } else if (event.type === 'analysis-summary') {
              if (fightSummaryEl) fightSummaryEl.textContent = event.summary;
              const fightersEl = fightHeader?.querySelector('#fight-fighters-upload');
              if (fightersEl && event.fighter_a !== 'Fighter A') {
                fightersEl.textContent = `${event.fighter_a} vs ${event.fighter_b}`;
              }

            } else if (event.type === 'frame') {
              frameStore.set(event.timestamp, event.data);

            } else if (event.type === 'analysis-event') {
              if (statusEl.parentNode) statusEl.remove();
              if (!fightTimeline) continue;
              const row = buildTimelineRow(event, frameStore);
              fightTimeline.appendChild(row);
              entry.scrollIntoView({ behavior: 'smooth', block: 'end' });

            } else if (event.type === 'analysis-text') {
              if (statusEl.parentNode) statusEl.remove();
              const pre = document.createElement('p');
              pre.className = 'analysis-raw';
              pre.textContent = event.text;
              entryA.appendChild(pre);

            } else if (event.type === 'analysis_id') {
              history.pushState({ analysis_id: event.id }, '', `/a/${event.id}`);

            } else if (event.type === 'done') {
              entryA.removeAttribute('data-streaming');
              if (statusEl.parentNode) statusEl.remove();
              if (fightTimeline) fightTimeline.querySelectorAll('.timeline-desc').forEach(el => applyChips(el));
              if (fightSummaryEl) applyChips(fightSummaryEl);

            } else if (event.type === 'error') {
              entryA.removeAttribute('data-streaming');
              showError(entryA, event.text, file.name);
            }
          }
        }
      } catch (err) {
        entryA.removeAttribute('data-streaming');
        if (err.name !== 'AbortError') showError(entryA, err.message, file.name);
      } finally {
        setStreaming(false);
        abortCtrl = null;
      }
    }

    // ── Direct video analysis ───────────────────────────────
    async function submitDirectVideoAnalysis(url) {
      if (abortCtrl) abortCtrl.abort();
      abortCtrl = new AbortController();

      if (!hasResults) { hasResults = true; setMode('results'); }

      const entry = document.createElement('div');
      entry.className = 'entry';

      const entryQ = document.createElement('div');
      entryQ.className = 'entry-q';
      entryQ.innerHTML = `<span class="entry-q-glyph" aria-hidden="true">▸</span>
        <span class="entry-q-text">Analysing video: <a href="${escHtml(url)}" target="_blank" rel="noopener" style="color:var(--accent-text)">${escHtml(url.length > 60 ? url.slice(0, 60) + '…' : url)}</a></span>`;

      const entryA = document.createElement('div');
      entryA.className = 'entry-a';
      entryA.setAttribute('data-streaming', '');

      const statusEl = document.createElement('div');
      statusEl.className = 'entry-status';
      statusEl.innerHTML = '<span class="status-dot" aria-hidden="true"></span><span class="status-label">Starting…</span>';
      entryA.appendChild(statusEl);

      entry.appendChild(entryQ);
      entry.appendChild(entryA);
      entries.appendChild(entry);
      entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setStreaming(true);

      let fightHeader = null, fightTimeline = null, fightSummaryEl = null;
      const frameStore = new Map();

      try {
        const res = await fetch('/api/analyze-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
          signal: abortCtrl.signal,
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
              const lbl = statusEl.querySelector('.status-label');
              if (lbl) lbl.textContent = event.text;

            } else if (event.type === 'video-info') {
              if (statusEl.parentNode) statusEl.remove();
              fightHeader = document.createElement('div');
              fightHeader.className = 'fight-header';
              fightHeader.innerHTML = `
                <div class="fight-meta">
                  <div class="fight-title">${escHtml(event.title)}</div>
                  <div class="fight-summary" id="fight-summary-direct"></div>
                  <div class="fight-fighters" id="fight-fighters-direct"></div>
                </div>`;
              entryA.appendChild(fightHeader);
              fightSummaryEl = fightHeader.querySelector('#fight-summary-direct');
              fightTimeline = document.createElement('div');
              fightTimeline.className = 'fight-timeline';
              entryA.appendChild(fightTimeline);
              entryA.appendChild(statusEl);

            } else if (event.type === 'analysis-summary') {
              if (fightSummaryEl) fightSummaryEl.textContent = event.summary;
              const fightersEl = fightHeader?.querySelector('#fight-fighters-direct');
              if (fightersEl && event.fighter_a !== 'Fighter A') {
                fightersEl.textContent = `${event.fighter_a} vs ${event.fighter_b}`;
              }

            } else if (event.type === 'frame') {
              frameStore.set(event.timestamp, event.data);

            } else if (event.type === 'analysis-event') {
              if (statusEl.parentNode) statusEl.remove();
              if (!fightTimeline) continue;
              const row = buildTimelineRow(event, frameStore);
              fightTimeline.appendChild(row);
              entry.scrollIntoView({ behavior: 'smooth', block: 'end' });

            } else if (event.type === 'analysis-text') {
              if (statusEl.parentNode) statusEl.remove();
              const pre = document.createElement('p');
              pre.className = 'analysis-raw';
              pre.textContent = event.text;
              entryA.appendChild(pre);

            } else if (event.type === 'done') {
              entryA.removeAttribute('data-streaming');
              if (statusEl.parentNode) statusEl.remove();
              if (fightTimeline) fightTimeline.querySelectorAll('.timeline-desc').forEach(el => applyChips(el));
              if (fightSummaryEl) applyChips(fightSummaryEl);

            } else if (event.type === 'error') {
              entryA.removeAttribute('data-streaming');
              showError(entryA, event.text, url);
            }
          }
        }
      } catch (err) {
        entryA.removeAttribute('data-streaming');
        if (err.name !== 'AbortError') showError(entryA, err.message, url);
      } finally {
        setStreaming(false);
        abortCtrl = null;
      }
    }

