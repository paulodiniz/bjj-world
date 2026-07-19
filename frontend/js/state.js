    function setMode(mode) {
      document.documentElement.dataset.mode = mode;
      const pathToggle = document.getElementById('path-toggle-btn');
      if (pathToggle) {
        pathToggle.textContent = mode === 'path' ? '← Chat' : 'Path →';
        pathToggle.setAttribute('aria-label', mode === 'path' ? 'Back to chat' : 'Open Path Finder');
      }
    }

    function goHome() {
      currentConversationId = null;
      history.pushState({}, '', '/');
      document.title = 'Tapcodex';
      setMode('landing');
    }

    function togglePath() {
      const current = document.documentElement.dataset.mode;
      if (current === 'path') {
        setMode(hasResults ? 'results' : 'landing');
      } else {
        setMode('path');
        if (!pathLoaded) loadPathNodes();
      }
    }

    let hasResults = false;

    let currentConversationId = null;

    function toggleHistory() {
      if (document.documentElement.dataset.mode === 'history') {
        setMode(hasResults ? 'results' : 'landing');
      } else {
        setMode('history');
        loadHistory();
      }
    }

    function toggleGraph() {
      if (document.documentElement.dataset.mode === 'graph') {
        setMode(hasResults ? 'results' : 'landing');
      } else {
        setMode('graph');
        if (!graphInitialized) initGraph();
      }
    }

    function togglePrep() {
      if (document.documentElement.dataset.mode === 'prep') {
        setMode(hasResults ? 'results' : 'landing');
      } else {
        openPrep();
      }
    }

    function startNewConversation() {
      currentConversationId = null;
      conversationHistory.length = 0;
      entries.innerHTML = '';
      hasResults = false;
      history.pushState({}, '', '/');
      document.title = 'Tapcodex';
      setMode('landing');
    }
