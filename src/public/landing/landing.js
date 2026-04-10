var _modalReturn = '/dashboard/';
var overlay = document.getElementById('auth-modal');

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
