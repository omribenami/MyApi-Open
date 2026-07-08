# myapi-asc

Ed25519 per-request signing for AI agents talking to MyApi. The agent's identity is its
public key, not its IP or User-Agent — so workers can rotate freely without tripping the
"suspicious device" alert.

## Why

OAuth tokens identify the *client*, not the *device*. AI agents legitimately run from
load-balanced workers with rotating IPs, missing User-Agent headers, and short-lived
hosts. Binding a token to a device fingerprint produced false-positive alerts.

ASC fixes this: every request carries a fresh Ed25519 signature over `<timestamp>:<tokenId>`.
The server verifies the signature against a registered public key. The key fingerprint is
the agent's identity.

## Install

In-repo for now — copy the `packages/myapi-asc` directory or symlink it. npm publish later.

```bash
npm install ./packages/myapi-asc
```

## Use

### Generate a keypair (once per agent)

```js
const { generateKeypair } = require('myapi-asc');
const { publicKey, privateKey } = generateKeypair();
// Save privateKey securely on the agent host.
// Register publicKey in the MyApi dashboard → Connect an AI Agent.
```

### Sign each request

```js
const { sign } = require('myapi-asc');
const headers = sign({ privateKey, tokenId: 'tok_abcd...' });
// headers = { 'X-Agent-PublicKey': '...', 'X-Agent-Signature': '...', 'X-Agent-Timestamp': '...' }

await fetch('https://api.myapi.com/api/v1/identity', {
  headers: {
    Authorization: `Bearer ${rawToken}`,
    ...headers,
  },
});
```

### Drop-in fetch wrapper

```js
const { wrapFetch } = require('myapi-asc');
const myFetch = wrapFetch(fetch, {
  tokenId: 'tok_abcd...',
  privateKey,
  bearer: rawToken,
});

await myFetch('https://api.myapi.com/api/v1/identity');
```

## Curl (no SDK)

```bash
TS=$(date +%s)
SIG=$(printf "$TS:$TOKEN_ID" | openssl pkeyutl -sign -inkey ed25519.pem -rawin | base64 -w0)
PUB=$(openssl pkey -in ed25519.pem -pubout -outform DER | tail -c 32 | base64 -w0)

curl -H "Authorization: Bearer $TOKEN" \
     -H "X-Agent-PublicKey: $PUB" \
     -H "X-Agent-Signature: $SIG" \
     -H "X-Agent-Timestamp: $TS" \
     https://api.myapi.com/api/v1/identity
```

## First-time approval

The first signed request from an unregistered public key returns `403 DEVICE_APPROVAL_REQUIRED`
and surfaces a pending approval in the dashboard. Once the user clicks **Approve**, that
public key is permanently associated with the token. Subsequent signed requests pass.

## Replay protection

The server rejects requests whose `X-Agent-Timestamp` is more than 60s out of sync.
Sign every request fresh — do not cache headers.
