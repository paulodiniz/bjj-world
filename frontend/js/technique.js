    const TP_ACTION_LABEL = {
      attack_with:'Attacks', sweep_with:'Sweeps', pass_with:'Guard passes',
      transition_to:'Transitions to', follow_up:'Follow-ups', recover_to:'Recovers to',
      escape_with:'Escapes', counters:'Counters', requires:'Requires',
      developed:'Developed', centers_on:'Centers on', features:'Features',
      known_for:'Known for', coached_by:'Coached by',
    };

    function ytId(url) {
      if (!url) return null;
      const m = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
      return m ? m[1] : null;
    }

    function tpChip(node) {
      const span = document.createElement('span');
      span.className = `nc nc-${node.type}`;
      span.textContent = node.name;
      span.title = node.type.replace(/_/g, ' ');
      span.setAttribute('role', 'button');
      span.setAttribute('tabindex', '0');
      span.addEventListener('click', () => loadTechnique(node.id));
      span.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') loadTechnique(node.id); });
      return span;
    }

    function renderTechnique(data) {
      const container = document.getElementById('tp-content');
      container.innerHTML = '';

      // Back
      const back = document.createElement('div');
      back.className = 'tp-back';
      back.innerHTML = `<button onclick="history.back()">← back</button>`;
      container.appendChild(back);

      // Hero
      const hero = document.createElement('div');
      hero.className = 'tp-hero';
      const gi = data.gi_requirement && data.gi_requirement !== 'both'
        ? `<span class="tp-gi">${escHtml(data.gi_requirement)}</span>` : '';
      hero.innerHTML = `
        <div class="tp-meta">
          <span class="tp-type ${escHtml(data.type)}">${escHtml(data.type.replace(/_/g,' '))}</span>
          ${gi}
        </div>
        <h1 class="tp-name">${escHtml(data.name)}</h1>
        ${data.description ? `<p class="tp-desc">${escHtml(data.description)}</p>` : ''}`;
      container.appendChild(hero);

      // Video
      const vid = ytId(data.video_url);
      if (vid) {
        const vidEl = document.createElement('div');
        vidEl.className = 'tp-video';
        vidEl.innerHTML = `<iframe src="https://www.youtube.com/embed/${escHtml(vid)}"
          title="${escHtml(data.name)} technique" allowfullscreen loading="lazy"></iframe>`;
        container.appendChild(vidEl);
      }

      // Connections
      const hasOut = data.outgoing && data.outgoing.length > 0;
      const hasIn  = data.incoming && data.incoming.length > 0;
      if (hasOut || hasIn) {
        const conns = document.createElement('div');
        conns.className = 'tp-connections';

        if (hasOut) {
          const sec = document.createElement('div');
          sec.className = 'tp-conn-section';
          sec.innerHTML = `<h3 class="tp-conn-heading">From here</h3>`;
          for (const group of data.outgoing) {
            const g = document.createElement('div');
            g.className = 'tp-group';
            const label = document.createElement('span');
            label.className = 'tp-group-label';
            label.textContent = group.label;
            const chips = document.createElement('div');
            chips.className = 'tp-chips';
            group.nodes.forEach(n => chips.appendChild(tpChip(n)));
            g.appendChild(label);
            g.appendChild(chips);
            sec.appendChild(g);
          }
          conns.appendChild(sec);
        }

        if (hasIn) {
          const sec = document.createElement('div');
          sec.className = 'tp-conn-section';
          sec.innerHTML = `<h3 class="tp-conn-heading">Leads here from</h3>`;
          for (const group of data.incoming) {
            const g = document.createElement('div');
            g.className = 'tp-group';
            const label = document.createElement('span');
            label.className = 'tp-group-label';
            label.textContent = group.label;
            const chips = document.createElement('div');
            chips.className = 'tp-chips';
            group.nodes.forEach(n => chips.appendChild(tpChip(n)));
            g.appendChild(label);
            g.appendChild(chips);
            sec.appendChild(g);
          }
          conns.appendChild(sec);
        }

        container.appendChild(conns);
      }

      // CTA
      const cta = document.createElement('div');
      cta.className = 'tp-cta';
      const askBtn = document.createElement('button');
      askBtn.className = 'tp-ask-btn';
      askBtn.textContent = `Ask coach about ${data.name} →`;
      askBtn.addEventListener('click', () => {
        submitQuestion(`Tell me more about ${data.name}`);
      });
      const pathBtn = document.createElement('button');
      pathBtn.className = 'tp-path-btn';
      pathBtn.textContent = `Find path to ${data.name} →`;
      pathBtn.addEventListener('click', () => {
        setMode('path');
        if (!pathLoaded) loadPathNodes();
        document.getElementById('path-to-input').value = data.name;
        document.getElementById('path-to-input').focus();
      });
      cta.appendChild(askBtn);
      cta.appendChild(pathBtn);
      container.appendChild(cta);
    }

    async function loadTechnique(id, push = true) {
      if (push) history.pushState({ technique: id }, '', `/technique/${id}`);
      setMode('technique');
      const container = document.getElementById('tp-content');
      container.innerHTML = `<div style="font-family:var(--mono);font-size:0.8rem;color:var(--ink-3)">Loading…</div>`;
      try {
        const data = await fetch(`/api/technique/${encodeURIComponent(id)}`).then(r => {
          if (!r.ok) throw new Error('Not found');
          return r.json();
        });
        document.title = `${data.name} — Tapcodex`;
        renderTechnique(data);
      } catch {
        container.innerHTML = `<p style="color:var(--ink-3);font-size:0.88rem">Technique not found.</p>`;
      }
    }

    // ── Auth ─────────────────────────────────────────────────
