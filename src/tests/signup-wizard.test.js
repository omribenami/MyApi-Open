const { canProceedSignupStep, nextWizardStep } = require('../signupWizard');

describe('signup wizard helpers', () => {
  test('enforces required data per step', () => {
    expect(canProceedSignupStep(1, { oauthConnected: false })).toBe(false);
    expect(canProceedSignupStep(1, { oauthConnected: true })).toBe(true);

    expect(canProceedSignupStep(2, { displayName: '' })).toBe(false);
    expect(canProceedSignupStep(2, { preferredName: 'Omri' })).toBe(true);

    expect(canProceedSignupStep(3, { userMdContent: '' })).toBe(false);
    expect(canProceedSignupStep(3, { userMdContent: 'text' })).toBe(true);

    expect(canProceedSignupStep(4, { soulMdContent: '' })).toBe(false);
    expect(canProceedSignupStep(4, { soulMdContent: 'text' })).toBe(true);
  });

  test('wizard transition increments and caps at 5', () => {
    expect(nextWizardStep(1)).toBe(2);
    expect(nextWizardStep(4)).toBe(5);
    expect(nextWizardStep(5)).toBe(5);
  });
});
