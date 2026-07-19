    let pathLoaded = false;
    let pathNodeMap = {}; // name.toLowerCase() → id

    async function loadPathNodes() {
      try {
        const data = await fetch('/api/nodes').then(r => r.json());
        const relevant = data.filter(n =>
          ['position','submission','sweep','guard_pass','takedown','escape'].includes(n.type)
        );
        const dl = document.getElementById('path-nodes-list');
        dl.innerHTML = relevant.map(n => `<option value="${escHtml(n.name)}">`).join('');
        relevant.forEach(n => { pathNodeMap[n.name.toLowerCase()] = n.id; });
        pathLoaded = true;
      } catch (err) {
        console.error('Failed to load path nodes', err);
      }
    }

    async function findPath() {
      const fromName = document.getElementById('path-from-input').value.trim();
      const toName   = document.getElementById('path-to-input').value.trim();
      const btn    = document.getElementById('path-btn');
      const result = document.getElementById('path-result');

      const fromId = pathNodeMap[fromName.toLowerCase()];
      const toId   = pathNodeMap[toName.toLowerCase()];

      if (!fromId || !toId) {
        result.style.display = 'block';
        result.innerHTML = '<p class="path-no-result">Type an exact technique name from the suggestions.</p>';
        return;
      }
      if (fromId === toId) {
        result.style.display = 'block';
        result.innerHTML = '<p class="path-no-result">Pick two different techniques.</p>';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Finding…';
      result.style.display = 'none';

      try {
        const data = await fetch(`/api/path?from=${fromId}&to=${toId}`).then(r => r.json());
        result.style.display = 'block';

        if (!data.found) {
          result.innerHTML = '<p class="path-no-result">No path found between these two techniques.</p>';
          return;
        }

        const stepsHtml = data.steps.map((step, i) => {
          const badge = step.type.replace('_', ' ');
          const node = `<div class="step-node">
            <span class="step-badge ${step.type}">${badge}</span>
            <span class="step-name">${escHtml(step.name)}</span>
          </div>`;
          if (i < data.transitions.length) {
            return `<div class="step-item">${node}
              <div class="step-connector">
                <div class="step-line"></div>
                <span class="step-rel">${escHtml(data.transitions[i])}</span>
              </div></div>`;
          }
          return `<div class="step-item">${node}</div>`;
        }).join('');

        const first = data.steps[0].name;
        const last  = data.steps[data.steps.length - 1].name;

        result.innerHTML = `
          <div class="path-meta">${data.steps.length} steps — <strong>${escHtml(first)}</strong> to <strong>${escHtml(last)}</strong></div>
          <div class="step-sequence">${stepsHtml}</div>
          <div id="path-explanation"></div>`;

        const pathStr = data.steps.map((s, i) =>
          i < data.transitions.length ? `${s.name} --[${data.transitions[i]}]-->` : s.name
        ).join(' ');

        const expEl = document.getElementById('path-explanation');
        const resp  = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: `Explain this BJJ path step by step as a coach: ${pathStr}. Be concise and practical.` })
        });

        const reader  = resp.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '', text = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const parts = sseBuffer.split('\n\n');
          sseBuffer = parts.pop();
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            let ev; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
            if (ev.type === 'token') { text += ev.text; expEl.innerHTML = marked.parse(text); }
          }
        }
      } catch (err) {
        result.innerHTML = `<p class="path-no-result">Something went wrong — try again.</p>`;
        result.style.display = 'block';
        console.error(err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Find Path';
      }
    }

    // ── History ──────────────────────────────────────────────
