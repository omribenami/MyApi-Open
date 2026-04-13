// Onboarding localStorage keys — modal, checklist, and active state are independent.
const ACTIVE_KEY = 'myapi_onboarding_active';
const MODAL_DISMISSED_KEY = 'myapi_onboarding_modal_dismissed';
const CHECKLIST_DISMISSED_KEY = 'myapi_onboarding_checklist_dismissed';
// Legacy key (was shared by both modal + checklist before the split)
const LEGACY_DISMISSED_KEY = 'myapi_onboarding_dismissed';

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, v) {
  try { localStorage.setItem(key, v); } catch { /* ignored */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignored */ }
}

export function isOnboardingActive() {
  return safeGet(ACTIVE_KEY) === '1';
}

export function activateOnboarding() {
  safeSet(ACTIVE_KEY, '1');
}

/** Was the onboarding modal explicitly dismissed (or completed)? */
export function wasModalDismissed() {
  return safeGet(MODAL_DISMISSED_KEY) === '1' || safeGet(LEGACY_DISMISSED_KEY) === '1';
}

/** Was the getting-started checklist explicitly dismissed? */
export function wasChecklistDismissed() {
  return safeGet(CHECKLIST_DISMISSED_KEY) === '1';
}

/** Mark the modal as dismissed (does NOT affect the checklist). */
export function dismissModal() {
  safeSet(MODAL_DISMISSED_KEY, '1');
  safeRemove(LEGACY_DISMISSED_KEY);
}

/** Mark the checklist as dismissed and end onboarding mode. */
export function dismissChecklist() {
  safeSet(CHECKLIST_DISMISSED_KEY, '1');
  safeRemove(LEGACY_DISMISSED_KEY);
  safeRemove(ACTIVE_KEY);
}

/** Clear onboarding mode because the user completed the checklist. */
export function completeOnboarding() {
  safeRemove(ACTIVE_KEY);
  safeRemove(MODAL_DISMISSED_KEY);
  safeRemove(CHECKLIST_DISMISSED_KEY);
  safeRemove(LEGACY_DISMISSED_KEY);
}

/** Clear all onboarding flags and reactivate onboarding. */
export function restartOnboarding() {
  safeSet(ACTIVE_KEY, '1');
  safeRemove(MODAL_DISMISSED_KEY);
  safeRemove(CHECKLIST_DISMISSED_KEY);
  safeRemove(LEGACY_DISMISSED_KEY);
}

/** Fire a custom event so App.jsx and Dashboard.jsx can react immediately. */
export function requestOnboardingModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('myapi:open-onboarding'));
  }
}
