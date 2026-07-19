    let nodeList = [];
    let chipRe = null;

    async function loadNodes() {
      try {
        const data = await fetch('/api/nodes').then(r => r.json());
        nodeList = data.sort((a, b) => b.name.length - a.name.length);
        const escaped = nodeList.map(n => n.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        chipRe = new RegExp('\\b(?:' + escaped.join('|') + ')\\b', 'gi');
      } catch (e) {
        console.warn('Node chip load failed', e);
      }
    }

    function applyChips(container) {
      if (!chipRe || !nodeList.length) return;
      walkForChips(container);
    }

    function walkForChips(el) {
      const skip = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE']);
      for (const child of [...el.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          chipifyTextNode(child);
        } else if (child.nodeType === Node.ELEMENT_NODE
          && !skip.has(child.tagName)
          && !child.classList.contains('nc')) {
          walkForChips(child);
        }
      }
    }

    function chipifyTextNode(textNode) {
      const text = textNode.textContent;
      chipRe.lastIndex = 0;
      if (!chipRe.test(text)) return;
      chipRe.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, match;
      while ((match = chipRe.exec(text)) !== null) {
        if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        const node = nodeList.find(n => n.name.toLowerCase() === match[0].toLowerCase());
        if (node) {
          const span = document.createElement('span');
          span.className = `nc nc-${node.type}`;
          span.textContent = match[0];
          span.title = node.type.replace('_', ' ');
          span.setAttribute('role', 'button');
          span.setAttribute('tabindex', '0');
          span.addEventListener('click', () => loadTechnique(node.id));
          span.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') loadTechnique(node.id); });
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(match[0]));
        }
        last = match.index + match[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.replaceWith(frag);
    }

    // ── Query helpers ───────────────────────────────────────
