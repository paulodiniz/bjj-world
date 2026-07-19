    function relativeDate(iso) {
      const d = new Date(iso);
      const now = new Date();
      const today = new Date(now); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      const dDay = new Date(d); dDay.setHours(0,0,0,0);
      if (dDay >= today) return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      if (dDay >= yesterday) return 'Yesterday';
      return d.toLocaleDateString([], {month:'short', day:'numeric'});
    }

    function groupConversations(convs) {
      const today = new Date(); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
      const groups = [
        { label: 'Today',     items: [] },
        { label: 'Yesterday', items: [] },
        { label: 'Earlier',   items: [] },
      ];
      for (const c of convs) {
        const d = new Date(c.updated_at); d.setHours(0,0,0,0);
        if (d >= today)     groups[0].items.push(c);
        else if (d >= yesterday) groups[1].items.push(c);
        else                groups[2].items.push(c);
      }
      return groups.filter(g => g.items.length > 0);
    }

    function buildHistoryItems(items, onClickFn, onDeleteFn, listEl) {
      const groups = groupConversations(items.map(i => ({ ...i, updated_at: i.updated_at || i.created_at })));
      for (const group of groups) {
        const groupEl = document.createElement('div');
        groupEl.className = 'history-group';
        groupEl.innerHTML = `<div class="history-group-label">${group.label}</div><div class="history-list"></div>`;
        const ul = groupEl.querySelector('.history-list');
        for (const item of group.items) {
          const el = document.createElement('div');
          el.className = 'history-item';
          el.innerHTML = `
            <span class="history-item-title">${escHtml(item.title)}</span>
            <span class="history-item-date">${relativeDate(item.updated_at || item.created_at)}</span>
            <button class="history-item-del" title="Delete" aria-label="Delete">✕</button>`;
          el.querySelector('.history-item-del').addEventListener('click', async e => {
            e.stopPropagation();
            await onDeleteFn(item.id);
            el.remove();
          });
          el.addEventListener('click', () => onClickFn(item.id));
          ul.appendChild(el);
        }
        listEl.appendChild(groupEl);
      }
    }

    async function loadHistory() {
      const listEl = document.getElementById('history-list');
      listEl.innerHTML = `<p class="history-empty">Loading…</p>`;
      try {
        const [convRes, anlRes] = await Promise.all([
          fetch('/api/conversations'),
          fetch('/api/analyses'),
        ]);
        if (convRes.status === 401) {
          listEl.innerHTML = `<p class="history-empty">Sign in to see your history.</p>`;
          return;
        }
        const convData = await convRes.json();
        const anlData  = anlRes.ok ? await anlRes.json() : { analyses: [] };
        const convs    = convData.conversations || [];
        const analyses = anlData.analyses || [];

        if (!convs.length && !analyses.length) {
          listEl.innerHTML = `<p class="history-empty">No history yet.</p>`;
          return;
        }

        listEl.innerHTML = '';

        if (convs.length) {
          const section = document.createElement('div');
          section.innerHTML = `<div class="history-group-label" style="margin-bottom:12px">Conversations</div>`;
          listEl.appendChild(section);
          buildHistoryItems(convs, id => resumeConversation(id), async id => {
            await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
          }, listEl);
        }

        if (analyses.length) {
          const section = document.createElement('div');
          section.style.marginTop = '28px';
          section.innerHTML = `<div class="history-group-label" style="margin-bottom:12px">Video analyses</div>`;
          listEl.appendChild(section);
          buildHistoryItems(analyses, id => loadAnalysisFromHistory(id), async id => {
            await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
          }, listEl);
        }
      } catch {
        listEl.innerHTML = `<p class="history-empty">Failed to load history.</p>`;
      }
    }

    async function resumeConversation(id, push = true) {
      try {
        const res  = await fetch(`/api/conversations/${id}`);
        const data = await res.json();
        if (!data.messages) return;

        // Restore conversation state
        currentConversationId = id;
        conversationHistory.length = 0;
        entries.innerHTML = '';
        hasResults = true;
        if (push) history.pushState({ conversation_id: id }, '', `/c/${id}`);
        setMode('results');

        for (let i = 0; i < data.messages.length; i += 2) {
          const userMsg = data.messages[i];
          const asstMsg = data.messages[i + 1];
          if (!userMsg) break;

          const entry = document.createElement('div');
          entry.className = 'entry';

          const entryQ = document.createElement('div');
          entryQ.className = 'entry-q';
          entryQ.innerHTML = `<span class="entry-q-glyph" aria-hidden="true">▸</span><span class="entry-q-text">${escHtml(userMsg.content)}</span>`;
          entry.appendChild(entryQ);

          if (asstMsg) {
            const entryA = document.createElement('div');
            entryA.className = 'entry-a';
            const textEl = document.createElement('div');
            textEl.className = 'answer-text';
            textEl.innerHTML = marked.parse(asstMsg.content);
            entryA.appendChild(textEl);
            applyChips(textEl);
            entry.appendChild(entryA);
            conversationHistory.push({ role: 'user', content: userMsg.content });
            conversationHistory.push({ role: 'assistant', content: asstMsg.content });
          }
          entries.appendChild(entry);
        }
        entries.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } catch {
        console.error('Failed to load conversation');
      }
    }

    // ── Saved analyses ───────────────────────────────────────
    async function _autoSaveNotes(id, noteArea, timeline, savedEl) {
