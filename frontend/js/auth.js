    let currentUser = null;

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user || null;
      } catch {
        currentUser = null;
      }
      renderAuthState();
      if (currentUser) checkAndShowProfileNudge();
    }

    async function checkAndShowProfileNudge() {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const { profile } = await res.json();
        const hasGame = profile && Array.isArray(profile.favourite_game) && profile.favourite_game.length > 0;
        if (!hasGame) {
          document.getElementById('profile-nudge').style.display = 'flex';
        }
      } catch {}
    }

    function renderAuthState() {
      const signinBtn        = document.getElementById('signin-btn');
      const userBtn          = document.getElementById('user-btn');
      const emailEl          = document.getElementById('user-menu-email');
      const landingSigninBtn = document.getElementById('landing-signin-btn');
      const landingUserBtn   = document.getElementById('landing-user-btn');
      const historyBtn        = document.getElementById('history-toggle-btn');
      const landingHistoryBtn = document.getElementById('landing-history-btn');
      const landingPrepBtn    = document.getElementById('landing-prep-btn');
      if (currentUser) {
        signinBtn.style.display         = 'none';
        userBtn.style.display           = 'flex';
        emailEl.textContent             = currentUser.email;
        landingSigninBtn.style.display  = 'none';
        landingUserBtn.style.display    = 'block';
        landingUserBtn.textContent      = currentUser.email;
        historyBtn.style.display        = 'block';
        landingHistoryBtn.style.display = 'flex';
        landingPrepBtn.style.display    = currentUser.plan === 'coach' ? 'flex' : 'none';
      } else {
        signinBtn.style.display         = 'block';
        userBtn.style.display           = 'none';
        landingSigninBtn.style.display  = 'block';
        landingUserBtn.style.display    = 'none';
        historyBtn.style.display        = 'none';
        landingHistoryBtn.style.display = 'none';
        landingPrepBtn.style.display    = 'none';
      }
    }

    function openAuthDialog() {
      const dialog = document.getElementById('auth-dialog');
      document.getElementById('auth-form-state').style.display   = 'block';
      document.getElementById('auth-success-state').style.display = 'none';
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-error').textContent = '';
      dialog.showModal();
      setTimeout(() => document.getElementById('auth-email').focus(), 50);
    }

    function closeAuthDialog() {
      document.getElementById('auth-dialog').close();
    }

    document.getElementById('auth-dialog').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeAuthDialog();
    });

    document.getElementById('auth-email').addEventListener('keydown', e => {
      if (e.key === 'Enter') submitMagicLink();
    });

    async function submitMagicLink() {
      const email   = document.getElementById('auth-email').value.trim();
      const btn     = document.getElementById('auth-submit-btn');
      const errorEl = document.getElementById('auth-error');

      if (!email) { errorEl.textContent = 'Enter your email.'; return; }

      btn.disabled    = true;
      btn.textContent = 'Sending…';
      errorEl.textContent = '';

      try {
        const res  = await fetch('/api/auth/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
          errorEl.textContent = data.error || 'Something went wrong.';
          return;
        }
        document.getElementById('auth-sent-email').textContent = email;
        document.getElementById('auth-form-state').style.display    = 'none';
        document.getElementById('auth-success-state').style.display = 'block';
      } catch {
        errorEl.textContent = 'Network error. Try again.';
      } finally {
        btn.disabled    = false;
        btn.textContent = 'Send magic link';
      }
    }

    function handleUserClick() {
      if (!currentUser) return;
      openUserMenu(document.getElementById('user-btn'));
    }

    // Handle redirect after magic link click
    (function handleAuthRedirect() {
      const params = new URLSearchParams(location.search);
      if (params.has('signed_in')) {
        history.replaceState({}, '', location.pathname);
        checkAuth();
      } else if (params.has('auth_error')) {
        history.replaceState({}, '', location.pathname);
        openAuthDialog();
        document.getElementById('auth-error').textContent =
          params.get('auth_error') === 'invalid_token'
            ? 'This link has expired or already been used. Request a new one.'
            : 'Invalid sign-in link.';
      }
    })();

    // ── URL routing ──────────────────────────────────────────
