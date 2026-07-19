    let graphInitialized = false;

    const TYPE_COLORS = {};
    function typeColor(type) {
      if (!TYPE_COLORS[type]) {
        TYPE_COLORS[type] = getComputedStyle(document.documentElement)
          .getPropertyValue(`--c-${type}`).trim() || 'oklch(0.55 0 0)';
      }
      return TYPE_COLORS[type];
    }


    async function initGraph() {
      graphInitialized = true;
      const loadingEl = document.getElementById('graph-loading');
      const svgEl = document.getElementById('graph-svg');

      let data;
      try {
        data = await fetch('/api/graph').then(r => r.json());
      } catch {
        loadingEl.textContent = 'Failed to load graph.';
        return;
      }
      loadingEl.remove();

      const nodes = data.nodes;
      const edges = data.edges;
      const W = svgEl.clientWidth || window.innerWidth;
      const H = svgEl.clientHeight || window.innerHeight - 52;

      // Adjacency set for hover highlight
      const adjacency = new Set();
      edges.forEach(e => {
        adjacency.add(`${e.source}§${e.target}`);
        adjacency.add(`${e.target}§${e.source}`);
      });
      const areLinked = (a, b) => adjacency.has(`${a.id}§${b.id}`);

      const svg = d3.select('#graph-svg');
      const g = svg.append('g');

      const zoom = d3.zoom().scaleExtent([0.05, 8])
        .on('zoom', e => g.attr('transform', e.transform));
      svg.call(zoom).on('dblclick.zoom', null);

      const sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(edges).id(d => d.id).distance(70).strength(0.35))
        .force('charge', d3.forceManyBody().strength(-260))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collide', d3.forceCollide(18));

      const link = g.append('g')
        .selectAll('line').data(edges).join('line')
        .attr('class', 'graph-edge');

      const node = g.append('g')
        .selectAll('g').data(nodes).join('g')
        .attr('cursor', 'pointer')
        .call(d3.drag()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
        )
        .on('click', (e, d) => { e.stopPropagation(); loadTechnique(d.id); })
        .on('mouseenter', (e, d) => {
          node.select('circle')
            .attr('r', n => n === d ? 11 : 8)
            .attr('fill-opacity', n => n === d || areLinked(n, d) ? 0.95 : 0.15);
          node.select('text')
            .attr('opacity', n => n === d || areLinked(n, d) ? 1 : 0.1);
          link
            .attr('stroke-opacity', l => l.source === d || l.target === d ? 0.9 : 0.04)
            .attr('stroke', l => l.source === d || l.target === d
              ? getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim()
              : 'oklch(0.28 0 0)');
        })
        .on('mouseleave', () => {
          node.select('circle').attr('r', 8).attr('fill-opacity', 0.85);
          node.select('text').attr('opacity', 1);
          link.attr('stroke-opacity', 0.5).attr('stroke', 'oklch(0.28 0 0)');
        });

      node.append('circle')
        .attr('r', 8)
        .attr('fill', d => typeColor(d.type))
        .attr('fill-opacity', 0.85)
        .attr('stroke', d => typeColor(d.type))
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.4);

      node.append('text')
        .text(d => d.name)
        .attr('dy', -12)
        .attr('class', 'graph-label');

      sim.on('tick', () => {
        link
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

      // Auto-fit once layout settles
      sim.on('end', () => {
        try {
          const b = g.node().getBBox();
          const scale = 0.88 * Math.min(W / b.width, H / b.height);
          const tx = W / 2 - scale * (b.x + b.width / 2);
          const ty = H / 2 - scale * (b.y + b.height / 2);
          svg.transition().duration(800)
            .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        } catch {}
      });

      // Legend + filters
      const seenTypes = [...new Set(nodes.map(n => n.type))].sort();

      const legend = document.getElementById('graph-legend');
      legend.innerHTML = seenTypes.map(t => `
        <div class="graph-legend-row">
          <div class="graph-legend-dot" style="background:${typeColor(t)}"></div>
          <span>${t.replace(/_/g, ' ')}</span>
        </div>`).join('');

      const activeTypes = new Set(seenTypes);

      function applyFilter() {
        node
          .style('opacity', d => activeTypes.has(d.type) ? 1 : 0)
          .style('pointer-events', d => activeTypes.has(d.type) ? 'all' : 'none');
        link.style('opacity', l =>
          activeTypes.has(l.source.type) && activeTypes.has(l.target.type) ? 0.5 : 0);
      }

      const filterBar = document.getElementById('graph-filters');
      seenTypes.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'graph-filter-btn active';
        btn.style.setProperty('--fc', typeColor(t));
        btn.textContent = t.replace(/_/g, ' ');
        btn.addEventListener('click', () => {
          if (activeTypes.has(t)) {
            activeTypes.delete(t);
            btn.classList.remove('active');
          } else {
            activeTypes.add(t);
            btn.classList.add('active');
          }
          applyFilter();
        });
        filterBar.appendChild(btn);
      });
    }

    // ── Technique page ──────────────────────────────────────
