    (function initRouting() {
      const path = location.pathname;

      if (path.match(/^\/technique\/(.+)$/)) {
        loadTechnique(decodeURIComponent(path.slice('/technique/'.length)), false);
      } else if (path === '/prep') {
        openPrep();
      } else if (path === '/profile') {
        openProfile();
      } else if (path.match(/^\/c\/([a-f0-9-]+)$/)) {
        resumeConversation(path.slice('/c/'.length), false);
      } else if (path.match(/^\/a\/([a-f0-9-]+)$/)) {
        loadAnalysisFromHistory(path.slice('/a/'.length), false);
      } else if (path.match(/^\/s\/[\w-]+$/)) {
        loadSharedAnalysis(path.slice('/s/'.length), false);
      }

      window.addEventListener('popstate', () => {
        const p = location.pathname;
        if (p.match(/^\/technique\/(.+)$/)) {
          loadTechnique(decodeURIComponent(p.slice('/technique/'.length)), false);
        } else if (p === '/prep') {
          openPrep();
        } else if (p === '/profile') {
          openProfile();
        } else if (p.match(/^\/c\/([a-f0-9-]+)$/)) {
          resumeConversation(p.slice('/c/'.length), false);
        } else if (p.match(/^\/a\/([a-f0-9-]+)$/)) {
          loadAnalysisFromHistory(p.slice('/a/'.length), false);
        } else if (p.match(/^\/s\/[\w-]+$/)) {
          loadSharedAnalysis(p.slice('/s/'.length), false);
        } else {
          document.title = 'Tapcodex';
          currentConversationId = null;
          setMode(hasResults ? 'results' : 'landing');
        }
      });
    })();

    // ── Init ────────────────────────────────────────────────
    checkAuth();
    loadNodes();
