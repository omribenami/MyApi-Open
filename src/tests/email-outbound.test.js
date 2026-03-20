const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

let sentMailPayload = null;
const mockTransporter = {
  sendMail: async (payload) => {
    sentMailPayload = payload;
    return { messageId: 'msg_test_123' };
  },
  verify: async () => true,
};

const mockDb = {
  markEmailAsSent: () => true,
  markEmailAsFailed: () => true,
  getPendingEmails: () => [],
};

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'nodemailer') {
    return {
      createTransport: () => mockTransporter,
    };
  }
  if (request === '../database') {
    return mockDb;
  }
  return originalLoad(request, parent, isMain);
};

function loadServiceFresh() {
  const servicePath = require.resolve('../services/emailService');
  delete require.cache[servicePath];
  return require('../services/emailService');
}

async function run() {
  const prevEmailFrom = process.env.EMAIL_FROM;
  const prevProvider = process.env.EMAIL_PROVIDER;

  try {
    process.env.EMAIL_PROVIDER = 'smtp';

    delete process.env.EMAIL_FROM;
    let service = loadServiceFresh();
    let failed = false;
    try {
      await service.sendTestEmail('test@example.com');
    } catch (err) {
      failed = true;
      assert.match(String(err.message), /EMAIL_FROM is not configured/);
    }
    assert.equal(failed, true, 'sendTestEmail should fail when EMAIL_FROM is not set');

    process.env.EMAIL_FROM = 'noreply@myapiai.com';
    process.env.EMAIL_FROM_NAME = 'MyApi';
    service = loadServiceFresh();
    sentMailPayload = null;
    const result = await service.sendTestEmail('test@example.com');

    assert.equal(result.success, true);
    assert.equal(sentMailPayload.from, 'MyApi <noreply@myapiai.com>');
    assert.equal(sentMailPayload.to, 'test@example.com');

    console.log('email-outbound.test.js: PASS');
  } finally {
    if (prevEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = prevEmailFrom;

    if (prevProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = prevProvider;

    Module._load = originalLoad;
  }
}

run().catch((err) => {
  console.error('email-outbound.test.js: FAIL', err);
  process.exit(1);
});
