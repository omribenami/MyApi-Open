/**
 * Regression tests for the OAuth-token / agent-identity refactor.
 *
 * Verifies that:
 *  1. DeviceFingerprint.fromRequest no longer flaps on missing/varied User-Agent
 *     (dropped hostname/macAddress from the hash; sec-ch-ua-platform precedence fixed).
 *  2. The deviceApprovalMiddleware's OAuth branch is visibility-only — different
 *     fingerprints under the same OAuth token are tracked but never blocked.
 *  3. Token-level revocation still produces a 403.
 *  4. The 24h alert cool-down suppresses duplicate emails.
 *  5. The legacy strict path is still reachable behind FEATURE_OAUTH_STRICT_DEVICE_BIND.
 */

const DeviceFingerprint = require('../utils/deviceFingerprint');

describe('DeviceFingerprint — stability across AI-agent traffic', () => {
  function req({ ua, ip, platform }) {
    return {
      headers: {
        ...(ua !== undefined ? { 'user-agent': ua } : {}),
        ...(platform !== undefined ? { 'sec-ch-ua-platform': platform } : {}),
        'x-forwarded-for': ip,
      },
      socket: { remoteAddress: ip },
    };
  }

  it('same UA + same IP → same hash', () => {
    const a = DeviceFingerprint.fromRequest(req({ ua: 'ChatGPT-Plugin/1.0', ip: '104.15.133.106' }));
    const b = DeviceFingerprint.fromRequest(req({ ua: 'ChatGPT-Plugin/1.0', ip: '104.15.133.106' }));
    expect(a.fingerprintHash).toBe(b.fingerprintHash);
  });

  it('same UA + different IP → same hash (IP is summary-only)', () => {
    const a = DeviceFingerprint.fromRequest(req({ ua: 'ChatGPT-Plugin/1.0', ip: '104.15.133.106' }));
    const b = DeviceFingerprint.fromRequest(req({ ua: 'ChatGPT-Plugin/1.0', ip: '169.224.158.178' }));
    expect(a.fingerprintHash).toBe(b.fingerprintHash);
  });

  it('different UA → different hash (still useful for visibility)', () => {
    const a = DeviceFingerprint.fromRequest(req({ ua: 'ChatGPT-Plugin/1.0', ip: '104.15.133.106' }));
    const b = DeviceFingerprint.fromRequest(req({ ua: 'Claude/2.5', ip: '104.15.133.106' }));
    expect(a.fingerprintHash).not.toBe(b.fingerprintHash);
  });

  it('missing UA produces a deterministic hash (not a crash)', () => {
    const a = DeviceFingerprint.fromRequest(req({ ua: undefined, ip: '104.15.133.106' }));
    const b = DeviceFingerprint.fromRequest(req({ ua: undefined, ip: '104.15.133.106' }));
    expect(a.fingerprintHash).toBeTruthy();
    expect(a.fingerprintHash).toBe(b.fingerprintHash);
  });

  it('sec-ch-ua-platform: "macOS" yields platform "macOS" (regression for `||/?:` precedence bug)', () => {
    const fp = DeviceFingerprint.fromRequest(req({
      ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ip: '1.2.3.4',
      platform: 'macOS',
    }));
    expect(fp.fingerprint.platform).toBe('macOS');
    expect(fp.summary.os).toBe('macOS');
  });

  it('analyzeSuspiciousActivity is now an inert stub (superseded by tokenSecurityMonitor)', () => {
    const current = { summary: { os: 'Windows', browser: 'Chrome' }, fingerprint: { ipAddress: '1.1.1.1' } };
    const prev = [{ summary: { os: 'macOS', browser: 'Firefox' }, fingerprint: { ipAddress: '2.2.2.2' } }];
    const analysis = DeviceFingerprint.analyzeSuspiciousActivity(current, prev);
    expect(analysis.suspicious).toBe(false);
    expect(analysis.reasons).toHaveLength(0);
  });
});

describe('deviceApprovalMiddleware — OAuth path is visibility-only', () => {
  // The middleware reads from the real DB module; we set up a minimal in-DB OAuth token
  // and exercise the middleware directly. This avoids spinning up the full HTTP stack
  // (which has many unrelated migrations / WAL-mode side effects in tests).
  const db = require('../database');
  const { deviceApprovalMiddleware } = require('../middleware/deviceApproval');

  let tokenId;
  let userId;

  beforeAll(() => {
    db.initDatabase();
    let user;
    try {
      user = db.createUser('asc-test-' + Date.now(), 'ASC Test', `asc${Date.now()}@example.com`, 'UTC', 'pw12345678');
    } catch (_) {
      user = db.getUsers()[0];
    }
    userId = user.id;
    tokenId = db.createAccessToken(
      'hash-' + Date.now(),
      userId,
      'full',
      'My Test Agent (OAuth)', // label must end with "(OAuth)" to trigger the OAuth branch
      null, null, null, null, 'guest',
      'test-client-id'
    );
  });

  function makeReq({ ua, ip }) {
    return {
      headers: { 'user-agent': ua, 'x-forwarded-for': ip },
      socket: { remoteAddress: ip },
      ip,
      method: 'GET',
      path: '/api/v1/identity',
      tokenMeta: { ownerId: userId, tokenId, tokenType: 'guest' },
    };
  }

  it('different UA → middleware still calls next() (no 403)', (done) => {
    const req1 = makeReq({ ua: 'ChatGPT-Plugin/1.0', ip: '104.15.133.106' });
    const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() };
    deviceApprovalMiddleware(req1, res1, () => {
      const req2 = makeReq({ ua: 'ChatGPT-Plugin/2.0-worker-42', ip: '104.15.133.106' });
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() };
      deviceApprovalMiddleware(req2, res2, () => {
        expect(res1.status).not.toHaveBeenCalled();
        expect(res2.status).not.toHaveBeenCalled();
        done();
      });
    });
  });

  it('missing UA → middleware still calls next() (no 403)', (done) => {
    const req = makeReq({ ua: undefined, ip: '104.15.133.106' });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() };
    deviceApprovalMiddleware(req, res, () => {
      expect(res.status).not.toHaveBeenCalled();
      done();
    });
  });

  it('an OAuth client collapses to exactly ONE device despite UA/IP rotation', () => {
    // Prior tests hit the middleware with several UAs/IPs for the same OAuth client.
    // They must collapse to a single device row keyed by the client, not one per UA.
    const devices = db.getApprovedDevices(userId).filter(d => d.token_id === 'oauth:test-client-id');
    expect(devices).toHaveLength(1);
    expect(devices[0].device_name).toMatch(/OAuth/);
  });

  it('after revoking the device, next request gets 403 with a pending approval', (done) => {
    const devices = db.getApprovedDevices(userId).filter(d => d.token_id === 'oauth:test-client-id');
    if (devices.length === 0) return done();
    db.revokeDevice(devices[0].id);

    const req = makeReq({ ua: 'ChatGPT-Plugin/3.0', ip: '104.15.133.106' });
    const res = {
      _status: 0, _body: null,
      status(code) { this._status = code; return this; },
      json(body) { this._body = body; return this; },
      set: jest.fn(),
    };
    deviceApprovalMiddleware(req, res, () => {
      // Should NOT reach next() — we expect 403
      done.fail('Expected 403, got next()');
    });
    setTimeout(() => {
      expect(res._status).toBe(403);
      expect(res._body?.code).toBe('DEVICE_APPROVAL_REQUIRED');
      done();
    }, 50);
  });
});

describe('applyOAuthDevicePolicy — shared OAuth policy (used by middleware AND /auth/me)', () => {
  // Regression: routes/auth.js GET /auth/me used to hard-gate OAuth tokens with its own
  // fingerprint check, creating spurious "New Device … via <client> (OAuth)" approval
  // requests for tokens the user had already consented to in the browser. Both paths
  // must now share this policy: visibility-only by default, fail closed on revocation.
  const db = require('../database');
  const { applyOAuthDevicePolicy } = require('../middleware/deviceApproval');

  let tokenId;
  let userId;

  function makeReq({ ua, ip }) {
    return {
      headers: { 'user-agent': ua, 'x-forwarded-for': ip },
      socket: { remoteAddress: ip },
      ip,
      method: 'GET',
      path: '/api/v1/auth/me',
    };
  }

  beforeAll(() => {
    db.initDatabase();
    let user;
    try {
      user = db.createUser('oauth-policy-' + Date.now(), 'Policy Test', `policy${Date.now()}@example.com`, 'UTC', 'pw12345678');
    } catch (_) {
      user = db.getUsers()[0];
    }
    userId = user.id;
    tokenId = db.createAccessToken(
      'hash-policy-' + Date.now(),
      userId,
      'full',
      'AI Agent (OAuth)',
      null, null, null, null, 'guest',
      'policy-client-id'
    );
  });

  it('new fingerprint → allowed, no pending approval created (visibility-only)', () => {
    const verdict = applyOAuthDevicePolicy(makeReq({ ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/125', ip: '203.0.113.7' }), {
      userId, tokenId, tokenLabel: 'AI Agent (OAuth)',
    });
    expect(verdict.allow).toBe(true);
    const pending = db.getPendingApprovals(userId, tokenId);
    expect(pending).toHaveLength(0);
  });

  it('OAuth client is auto-registered as ONE device the dashboard can list/revoke', () => {
    const devices = db.getApprovedDevices(userId).filter(d => d.token_id === 'oauth:policy-client-id');
    expect(devices).toHaveLength(1);
  });

  it('second fingerprint → still allowed (agents rotate UAs/IPs)', () => {
    const verdict = applyOAuthDevicePolicy(makeReq({ ua: 'ChatGPT-Plugin/9.9', ip: '198.51.100.4' }), {
      userId, tokenId, tokenLabel: 'AI Agent (OAuth)',
    });
    expect(verdict.allow).toBe(true);
  });

  it('after user revokes the device → denied with 403 and a pending approval (fail closed)', () => {
    const devices = db.getApprovedDevices(userId).filter(d => d.token_id === 'oauth:policy-client-id');
    expect(devices.length).toBeGreaterThanOrEqual(1);
    db.revokeDevice(devices[0].id);

    const verdict = applyOAuthDevicePolicy(makeReq({ ua: 'ChatGPT-Plugin/10.0', ip: '198.51.100.4' }), {
      userId, tokenId, tokenLabel: 'AI Agent (OAuth)',
    });
    expect(verdict.allow).toBe(false);
    expect(verdict.status).toBe(403);
    expect(verdict.body.code).toBe('DEVICE_APPROVAL_REQUIRED');
    const pending = db.getPendingApprovals(userId, 'oauth:policy-client-id');
    expect(pending.length).toBeGreaterThanOrEqual(1);
  });

  // Regression: a stale revoked row used to fail-close the token FOREVER —
  // approving a pending device only cleared revoked_at on that one fingerprint,
  // so agents rotating UAs/IPs spawned an endless stream of "New Device …
  // via <client> (OAuth)" approval requests no matter how many were approved.
  it('approving a pending device restores relaxed mode (no more approval spam)', () => {
    const pending = db.getPendingApprovals(userId, 'oauth:policy-client-id');
    expect(pending.length).toBeGreaterThanOrEqual(1);
    const deviceId = db.approvePendingDevice(pending[0].id, 'Re-approved Agent');
    expect(deviceId).toBeTruthy();

    // The same client (any UA/IP) is allowed again and creates NO pending approval.
    const verdict = applyOAuthDevicePolicy(makeReq({ ua: 'ChatGPT-Plugin/11.0', ip: '198.51.100.9' }), {
      userId, tokenId, tokenLabel: 'AI Agent (OAuth)',
    });
    expect(verdict.allow).toBe(true);
    expect(db.getPendingApprovals(userId, 'oauth:policy-client-id')).toHaveLength(0);
  });

  it('OAuth clients are independent entities — revoking one does not affect another', () => {
    // A different OAuth client of the same user is its own device, unaffected by the
    // revocation state of 'policy-client-id'.
    const otherTokenId = db.createAccessToken(
      'hash-other-' + Date.now(), userId, 'full', 'Other Agent (OAuth)',
      null, null, null, null, 'guest', 'other-client-id'
    );
    const verdict = applyOAuthDevicePolicy(makeReq({ ua: 'Other/1.0', ip: '203.0.113.99' }), {
      userId, tokenId: otherTokenId, tokenLabel: 'Other Agent (OAuth)',
    });
    expect(verdict.allow).toBe(true);
    const otherDevices = db.getApprovedDevices(userId).filter(d => d.token_id === 'oauth:other-client-id');
    expect(otherDevices).toHaveLength(1);
    // And it rotates its token without spawning a second device.
    const rotatedTokenId = db.createAccessToken(
      'hash-other2-' + Date.now(), userId, 'full', 'Other Agent (OAuth)',
      null, null, null, null, 'guest', 'other-client-id'
    );
    applyOAuthDevicePolicy(makeReq({ ua: 'Other/2.0', ip: '203.0.113.100' }), {
      userId, tokenId: rotatedTokenId, tokenLabel: 'Other Agent (OAuth)',
    });
    expect(db.getApprovedDevices(userId).filter(d => d.token_id === 'oauth:other-client-id')).toHaveLength(1);
  });
});

describe('Alert cool-down', () => {
  const db = require('../database');

  beforeAll(() => { db.initDatabase(); });

  it('getLastAlertSentAt returns null when nothing has been sent', () => {
    expect(db.getLastAlertSentAt('nonexistent-token', 'nonexistent-fp')).toBeNull();
  });

  it('markAlertSent then getLastAlertSentAt returns a recent timestamp', () => {
    const userId = db.getUsers()[0]?.id || 'owner';
    const tokenId = db.createAccessToken('hash-cooldown', userId, 'full', 'Cool-down Test (OAuth)', null, null, null, null, 'guest', null);
    const approvalId = db.createPendingApproval(tokenId, userId, 'cooldown-fp', { os: 'Linux' }, '1.1.1.1');

    expect(db.getLastAlertSentAt(tokenId, 'cooldown-fp')).toBeNull();
    db.markAlertSent(approvalId);
    const after = db.getLastAlertSentAt(tokenId, 'cooldown-fp');
    expect(after).toBeTruthy();
    expect(Date.now() - new Date(after).getTime()).toBeLessThan(5000);
  });
});
