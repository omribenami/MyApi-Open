// MyApi ASC (Agentic Secure Connection) — Ed25519 per-request signing for AI agents.
//
// Identity = your Ed25519 public key. Each request signs `${timestamp}:${fingerprint}` so the
// server can prove the request came from the key-holder and was issued in the last 60s.
// No User-Agent / IP dependency — your agent can move across IPs, workers, or hosts without
// tripping false-positive "suspicious device" alerts.
//
//   const { generateKeypair, sign, wrapFetch } = require('myapi-asc');
//   const { publicKey, privateKey } = generateKeypair();
//   // 1) Register the publicKey via the MyApi dashboard (Connect-an-AI-Agent flow)
//   // 2) Sign requests:
//   const headers = sign({ privateKey });
//   await fetch(url, { headers: { Authorization: `Bearer ${rawToken}`, ...headers } });
//
//   // or, drop-in fetch wrapper:
//   const myFetch = wrapFetch(fetch, { privateKey, bearer: rawToken });

const crypto = require('crypto');

function generateKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ format: 'der', type: 'spki' });
  // SPKI Ed25519 wrapper is 12 bytes (302a300506032b6570032100), raw key follows
  const rawPub = pubDer.subarray(12);
  return {
    publicKey: rawPub.toString('base64'),
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }),
  };
}

function sign({ privateKey }) {
  if (!privateKey) throw new Error('sign() requires privateKey');
  const keyObj = typeof privateKey === 'string' || Buffer.isBuffer(privateKey)
    ? crypto.createPrivateKey(privateKey)
    : privateKey;
  const pubDer  = crypto.createPublicKey(keyObj).export({ format: 'der', type: 'spki' });
  const rawPub  = pubDer.subarray(12);
  const rawPubB64 = rawPub.toString('base64');
  const fingerprint = crypto.createHash('sha256').update(rawPub).digest('hex').substring(0, 32);
  const timestamp   = String(Math.floor(Date.now() / 1000));
  const message     = Buffer.from(`${timestamp}:${fingerprint}`);
  const signature   = crypto.sign(null, message, keyObj);

  return {
    'X-Agent-PublicKey': rawPubB64,
    'X-Agent-Signature': signature.toString('base64'),
    'X-Agent-Timestamp': timestamp,
  };
}

function wrapFetch(fetchImpl, { privateKey, bearer }) {
  if (!fetchImpl) throw new Error('wrapFetch() requires a fetch implementation');
  return async (input, init = {}) => {
    const signedHeaders = sign({ privateKey });
    const headers = {
      ...(init.headers || {}),
      ...signedHeaders,
    };
    if (bearer && !headers.Authorization && !headers.authorization) {
      headers.Authorization = `Bearer ${bearer}`;
    }
    return fetchImpl(input, { ...init, headers });
  };
}

module.exports = { generateKeypair, sign, wrapFetch };
