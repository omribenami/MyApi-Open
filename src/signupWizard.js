function canProceedSignupStep(step, state = {}) {
  if (step === 1) return Boolean(state.oauthConnected);
  if (step === 2) return Boolean((state.displayName || state.preferredName || '').trim());
  if (step === 3) return Boolean((state.userMdContent || '').trim());
  if (step === 4) return Boolean((state.soulMdContent || '').trim());
  return true;
}

function nextWizardStep(step) {
  return Math.min(5, Number(step || 1) + 1);
}

module.exports = { canProceedSignupStep, nextWizardStep };
