const sent = { payload: null };

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: async (payload) => {
      sent.payload = payload;
      return { messageId: 'msg_test_123' };
    },
    verify: async () => true,
  }),
}));

jest.mock('../database', () => ({
  markEmailAsSent: () => true,
  markEmailAsFailed: () => true,
  getPendingEmails: () => [],
}));

function loadServiceFresh() {
  jest.resetModules();
  return require('../services/emailService');
}

describe('email outbound', () => {
  const prev = {};

  beforeAll(() => {
    prev.EMAIL_FROM = process.env.EMAIL_FROM;
    prev.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER;
    prev.EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME;
  });

  afterAll(() => {
    process.env.EMAIL_FROM = prev.EMAIL_FROM;
    process.env.EMAIL_PROVIDER = prev.EMAIL_PROVIDER;
    process.env.EMAIL_FROM_NAME = prev.EMAIL_FROM_NAME;
  });

  test('fails when EMAIL_FROM is missing', async () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    delete process.env.EMAIL_FROM;

    const service = loadServiceFresh();
    await expect(service.sendTestEmail('test@example.com')).rejects.toThrow(/EMAIL_FROM is not configured/);
  });

  test('sends with configured EMAIL_FROM', async () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.EMAIL_FROM = 'noreply@myapiai.com';
    process.env.EMAIL_FROM_NAME = 'MyApi';

    sent.payload = null;
    const service = loadServiceFresh();
    const result = await service.sendTestEmail('test@example.com');

    expect(result.success).toBe(true);
    expect(sent.payload.from).toBe('MyApi <noreply@myapiai.com>');
    expect(sent.payload.to).toBe('test@example.com');
  });
});
