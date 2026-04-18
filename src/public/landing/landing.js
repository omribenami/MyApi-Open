var _modalReturn = '/dashboard/';
var overlay = document.getElementById('auth-modal');
var modalEl = overlay.querySelector('.modal');
var _betaFull = false; // set once /config/public resolves

function openModal(mode, returnTo) {
  _modalReturn = returnTo || '/dashboard/';
  setModalMode(mode || 'login');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function setModalMode(mode) {
  var isSignup = (mode === 'signup');
  // New signups are blocked when the beta is full — swap the signup view for
  // the waitlist form. Sign-in (login mode) always shows OAuth buttons so
  // existing users can still log in.
  var showWaitlist = isSignup && _betaFull;
  if (modalEl) modalEl.classList.toggle('waitlist-mode', showWaitlist);
  if (showWaitlist) return;
  document.getElementById('modal-title').textContent    = isSignup ? 'Create your account'              : 'Welcome back';
  document.getElementById('modal-subtitle').textContent = isSignup ? 'Start free — no credit card required.' : 'Sign in to continue to MyApi.';
  var verb = isSignup ? 'Sign up with' : 'Continue with';
  document.getElementById('google-label').textContent   = verb + ' Google';
  document.getElementById('github-label').textContent   = verb + ' GitHub';
  document.getElementById('facebook-label').textContent = verb + ' Facebook';
  var switchRow = document.getElementById('modal-switch-row');
  switchRow.querySelector('.switch-text').textContent = isSignup ? 'Already have an account? ' : "Don't have an account? ";
  var switchBtn = switchRow.querySelector('.switch-btn');
  switchBtn.textContent       = isSignup ? 'Sign in' : 'Create one free';
  switchBtn.dataset.mode      = isSignup ? 'login'   : 'signup';
}

function oauthSignIn(service) {
  var params = new URLSearchParams({ mode: 'login', forcePrompt: '1', returnTo: _modalReturn, redirect: '1' });
  window.location.href = '/api/v1/oauth/authorize/' + service + '?' + params.toString();
}

// Single event-delegation listener — no inline handlers (CSP: script-src-attr 'none')
document.addEventListener('click', function(e) {
  // Backdrop click closes modal
  if (e.target === overlay) { closeModal(); return; }

  var el = e.target.closest('[data-action]');
  if (!el) return;

  var action  = el.dataset.action;
  var mode    = el.dataset.mode    || 'login';
  var returnTo = el.dataset.return || null;

  if (action === 'open-modal') {
    openModal(mode, returnTo);
  } else if (action === 'close-modal') {
    closeModal();
  } else if (action === 'set-mode') {
    setModalMode(mode);
  } else if (action === 'oauth') {
    oauthSignIn(el.dataset.service);
  }
});

// Close on Escape
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
});

// Wire close button (simpler than data-action since it's always present)
document.getElementById('modal-close-btn').addEventListener('click', closeModal);

// BETA mode: fetch runtime config and flip body classes.
// Full-beta behaviour (swap signup → waitlist) is driven per-modal-open, not
// globally, so existing users can still sign in when the beta is at capacity.
function applyBetaConfig(cfg) {
  var beta = !!cfg && cfg.beta !== false;
  var full = !!cfg && !!cfg.betaFull;
  document.body.classList.toggle('beta-active', beta);
  document.body.classList.toggle('beta-off', !beta);
  var forcedFull = new URLSearchParams(window.location.search).get('beta') === 'full';
  _betaFull = beta && (full || forcedFull);
}

// Pre-fill email if the callback forwarded it, then open the modal in waitlist mode.
(function consumeBetaFullQuery() {
  var params = new URLSearchParams(window.location.search);
  if (params.get('beta') !== 'full') return;
  var email = params.get('email') || '';
  var input = document.getElementById('waitlist-email');
  if (input && email) input.value = email;
  // Force waitlist view without waiting for /config/public — the OAuth callback
  // already confirmed the cap was hit.
  _betaFull = true;
  setTimeout(function () { openModal('signup'); }, 0);
  try {
    var url = new URL(window.location.href);
    url.searchParams.delete('beta');
    url.searchParams.delete('email');
    window.history.replaceState({}, document.title, url.pathname + (url.search || ''));
  } catch (_) { /* noop */ }
})();

fetch('/api/v1/config/public', { credentials: 'same-origin' })
  .then(function (r) { return r.ok ? r.json() : null; })
  .then(function (payload) { applyBetaConfig((payload && payload.data) || null); })
  .catch(function () { applyBetaConfig({ beta: true, betaFull: false }); });

// Waitlist submission
var waitlistForm = document.getElementById('waitlist-form');
if (waitlistForm) {
  waitlistForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var emailInput = document.getElementById('waitlist-email');
    var submitBtn = document.getElementById('waitlist-submit');
    var status = document.getElementById('waitlist-status');
    var email = (emailInput.value || '').trim().toLowerCase();
    status.className = 'waitlist-status';
    status.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.classList.add('error');
      status.textContent = 'Please enter a valid email address.';
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Joining...';
    fetch('/api/v1/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email }),
    })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.body && res.body.error) || 'Unable to join the waitlist');
        status.classList.add('success');
        status.textContent = "You're on the list. We'll email " + email + " when a spot opens.";
        emailInput.disabled = true;
        submitBtn.style.display = 'none';
      })
      .catch(function (err) {
        status.classList.add('error');
        status.textContent = err.message || 'Unable to join the waitlist';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join the waitlist';
      });
  });
}
