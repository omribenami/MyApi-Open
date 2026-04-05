const DISMISSED_KEY = 'myapi_onboarding_dismissed';

export function wasOnboardingDismissed() {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}
