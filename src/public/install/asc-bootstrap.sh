#!/usr/bin/env bash
# myapi-asc-bootstrap.sh — MyApi ASC (Agentic Secure Connection) installer
#
# Usage:
#   sudo bash myapi-asc-bootstrap.sh install    # first-time or idempotent re-run
#   sudo bash myapi-asc-bootstrap.sh status     # check service + approval state
#   sudo bash myapi-asc-bootstrap.sh rotate     # replace keypair (requires re-approval)
#   sudo bash myapi-asc-bootstrap.sh logs       # tail service logs
#   sudo bash myapi-asc-bootstrap.sh uninstall  # remove service, user, state dir
#
# One-liner:
#   sudo bash -c "$(curl -fsSL https://www.myapiai.com/install/asc)"

set -euo pipefail
IFS=$'\n\t'

# ── Defaults (override via env) ────────────────────────────────────────────────
MYAPI_USER="${MYAPI_USER:-myapi-asc}"
STATE_DIR="${STATE_DIR:-/var/lib/myapi-asc}"
SERVICE_NAME="${SERVICE_NAME:-myapi-asc}"
MCP_BIND="${MCP_BIND:-127.0.0.1}"
MCP_PORT="${MCP_PORT:-9587}"
MYAPI_URL="${MYAPI_URL:-https://www.myapiai.com}"
MYAPI_TOKEN="${MYAPI_TOKEN:-}"   # personal access token, consumed once at registration
MIN_NODE_MAJOR=18

UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SERVER_JS="${STATE_DIR}/server.js"
TOKEN_FILE="${STATE_DIR}/setup_token"
MCP_URL="http://${MCP_BIND}:${MCP_PORT}/mcp"

# ── Colors ─────────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD='\033[1m'; RED='\033[0;31m'; GREEN='\033[0;32m'
  YEL='\033[1;33m'; BLUE='\033[0;34m'; DIM='\033[2m'; NC='\033[0m'
else
  BOLD=''; RED=''; GREEN=''; YEL=''; BLUE=''; DIM=''; NC=''
fi

# ── Logging ────────────────────────────────────────────────────────────────────
log()  { printf "  ${BLUE}→${NC} %s\n" "$*"; }
ok()   { printf "  ${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "  ${YEL}⚠${NC} %s\n" "$*"; }
die()  { printf "  ${RED}✗${NC} %s\n" "$*" >&2; exit 1; }
step() { printf "\n${BOLD}%s${NC}\n" "$*"; }
hr()   { printf "${DIM}──────────────────────────────────────────────────────────────────${NC}\n"; }

# ── Prereq checks ──────────────────────────────────────────────────────────────
check_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root: sudo bash $0 ${CMD}"
}

check_linux_systemd() {
  [[ "$(uname -s)" == "Linux" ]] || die "This script is Linux-only."
  if ! command -v systemctl &>/dev/null; then
    warn "systemd not found. See DOCKER FALLBACK section at end of this script."
    die "systemd is required for managed daemon mode."
  fi
}

check_openssl() {
  command -v openssl &>/dev/null || die "openssl not found. Install: apt-get install openssl"
  # Verify Ed25519 support
  openssl genpkey -algorithm ed25519 -out /dev/null 2>/dev/null \
    || die "openssl does not support Ed25519. Upgrade to OpenSSL 1.1.1+."
}

_node_find_acceptable() {
  # Probe every common install location; set NODE_BIN and return 0 if found
  local candidate ver major bin
  for candidate in \
      "$(command -v node 2>/dev/null || true)" \
      /usr/bin/node /usr/local/bin/node \
      /usr/local/nodejs/bin/node \
      /opt/node/bin/node /opt/nodejs/bin/node; do
    [[ -x "${candidate}" ]] || continue
    ver=$("${candidate}" --version 2>/dev/null | tr -d 'v' || echo "0")
    major=$(echo "${ver}" | cut -d. -f1)
    if [[ "${major}" -ge "${MIN_NODE_MAJOR}" ]]; then
      NODE_BIN="${candidate}"
      ok "Node.js ${ver} found at ${candidate}"
      return 0
    fi
  done
  return 1
}

_node_install_pkg() {
  # Try distro package manager + NodeSource repo; return 0 if a good binary appears afterward
  if command -v apt-get &>/dev/null; then
    # If dpkg is in a broken state (e.g. nginx post-install failed due to port conflict),
    # apt-get will refuse to install anything. Detect and skip to binary in that case.
    if ! apt-get check 2>/dev/null; then
      warn "dpkg has unresolved issues — skipping apt, will use binary install"
      return 1
    fi
    log "Trying NodeSource apt repo..."
    DEBIAN_FRONTEND=noninteractive apt-get remove --purge -y nodejs npm 2>/dev/null || true
    DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>/dev/null || true
    curl -fsSL "https://deb.nodesource.com/setup_${MIN_NODE_MAJOR}.x" | bash - >/dev/null 2>&1 || true
    # Re-check dpkg state after NodeSource setup (it runs apt internally and may leave a broken state)
    if ! apt-get check 2>/dev/null; then
      warn "NodeSource setup left dpkg in broken state — using binary install"
      return 1
    fi
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs >/dev/null 2>&1 || true
  elif command -v dnf &>/dev/null; then
    log "Trying NodeSource dnf repo..."
    dnf remove -y nodejs npm 2>/dev/null || true
    curl -fsSL "https://rpm.nodesource.com/setup_${MIN_NODE_MAJOR}.x" | bash - >/dev/null 2>&1 || true
    dnf install -y nodejs >/dev/null 2>&1 || true
  elif command -v yum &>/dev/null; then
    log "Trying NodeSource yum repo..."
    yum remove -y nodejs npm 2>/dev/null || true
    curl -fsSL "https://rpm.nodesource.com/setup_${MIN_NODE_MAJOR}.x" | bash - >/dev/null 2>&1 || true
    yum install -y nodejs >/dev/null 2>&1 || true
  else
    return 1
  fi
  hash -r 2>/dev/null || true
  _node_find_acceptable
}

_node_install_binary() {
  # Download the official pre-built binary tarball from nodejs.org — works on any
  # Linux distro / version without relying on package repos at all.
  local arch
  case "$(uname -m)" in
    x86_64)        arch="x64"    ;;
    aarch64|arm64) arch="arm64"  ;;
    armv7l)        arch="armv7l" ;;
    *) die "Unsupported CPU architecture: $(uname -m). Install Node.js manually: https://nodejs.org" ;;
  esac

  log "Downloading official Node.js ${MIN_NODE_MAJOR}.x binary from nodejs.org (${arch})..."

  # Resolve the latest patch in the required major line
  local node_ver
  node_ver=$(curl -fsSL "https://nodejs.org/dist/latest-v${MIN_NODE_MAJOR}.x/SHASUMS256.txt" 2>/dev/null \
    | awk "/node-v[0-9.]+-linux-${arch}\\.tar\\.xz/{match(\$2,/node-v([0-9.]+)/,a);print a[1];exit}")
  [[ -n "${node_ver}" ]] || node_ver="${MIN_NODE_MAJOR}.0.0"

  local tarball="node-v${node_ver}-linux-${arch}.tar.xz"
  local url="https://nodejs.org/dist/v${node_ver}/${tarball}"
  local tmp="/tmp/${tarball}"

  curl -fsSL --progress-bar "${url}" -o "${tmp}" \
    || die "Failed to download Node.js from ${url}"

  tar -xJf "${tmp}" -C /usr/local --strip-components=1 >/dev/null 2>&1 \
    || die "Failed to extract ${tmp}"
  rm -f "${tmp}"

  hash -r 2>/dev/null || true
  _node_find_acceptable
}

ensure_node() {
  # 1. Already installed and acceptable?
  local existing_ver existing_major
  if command -v node &>/dev/null; then
    existing_ver=$(node --version 2>/dev/null | tr -d 'v' || echo "0")
    existing_major=$(echo "${existing_ver}" | cut -d. -f1)
    if [[ "${existing_major}" -ge "${MIN_NODE_MAJOR}" ]]; then
      ok "Node.js ${existing_ver} already installed"
      NODE_BIN="$(command -v node)"
      return 0
    fi
    warn "Node.js ${existing_ver} is too old (need >= ${MIN_NODE_MAJOR})"
  else
    warn "Node.js not found"
  fi

  printf "\n  Install Node.js ${MIN_NODE_MAJOR}.x automatically? [Y/n] "
  read -r yn
  [[ "${yn}" =~ ^[Nn]$ ]] && die "Node.js ${MIN_NODE_MAJOR}+ is required. Install from https://nodejs.org and re-run."

  # 2. Try package manager + NodeSource
  _node_install_pkg && return 0

  # 3. Fallback: official pre-built binary (distro-independent)
  warn "Package manager install did not produce a usable node — falling back to official binary"
  _node_install_binary && return 0

  die "Could not install Node.js ${MIN_NODE_MAJOR}+. Install manually from https://nodejs.org and re-run."
}

check_port() {
  # Skip check if our own service already holds the port (idempotent re-run)
  if systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null; then
    return 0
  fi
  if ss -tlnp 2>/dev/null | grep -qE ":${MCP_PORT}\b"; then
    local info
    info=$(ss -tlnp 2>/dev/null | grep ":${MCP_PORT}" | grep -oP 'pid=\d+' | head -1 || true)
    warn "Port ${MCP_PORT} is in use (${info:-unknown})."
    die "Set MCP_PORT=XXXX before re-running, or stop the conflicting process."
  fi
}

# ── User + directory setup ─────────────────────────────────────────────────────
setup_user() {
  if id "${MYAPI_USER}" &>/dev/null; then
    ok "User ${MYAPI_USER} already exists"
  else
    log "Creating system user ${MYAPI_USER}..."
    useradd \
      --system \
      --no-create-home \
      --home-dir "${STATE_DIR}" \
      --shell /usr/sbin/nologin \
      --comment "MyApi ASC daemon" \
      "${MYAPI_USER}"
    ok "User ${MYAPI_USER} created"
  fi
}

setup_state_dir() {
  if [[ ! -d "${STATE_DIR}" ]]; then
    log "Creating state directory ${STATE_DIR}..."
    mkdir -p "${STATE_DIR}"
  fi
  chown "${MYAPI_USER}:${MYAPI_USER}" "${STATE_DIR}"
  chmod 0750 "${STATE_DIR}"
  ok "State dir ${STATE_DIR} (0750 ${MYAPI_USER}:${MYAPI_USER})"
}

# ── Keypair ────────────────────────────────────────────────────────────────────
generate_keypair() {
  local pem="${STATE_DIR}/ed25519.pem"

  if [[ -f "${pem}" ]]; then
    ok "Ed25519 keypair already exists — skipping generation"
    return 0
  fi

  log "Generating Ed25519 keypair as ${MYAPI_USER}..."
  # Generate under the dedicated user so the key is never in root's process memory
  su "${MYAPI_USER}" -s /bin/sh -c \
    "openssl genpkey -algorithm ed25519 -out '${pem}' 2>/dev/null"
  chmod 0600 "${pem}"
  chown "${MYAPI_USER}:${MYAPI_USER}" "${pem}"
  ok "Keypair generated (private key 0600 ${MYAPI_USER}:${MYAPI_USER})"
}

# Extract public key as raw 32-byte base64 — same format the backend expects
read_pubkey() {
  su "${MYAPI_USER}" -s /bin/sh -c \
    "openssl pkey -in '${STATE_DIR}/ed25519.pem' -pubout -outform DER 2>/dev/null \
     | tail -c 32 | base64 -w0"
}

# Fingerprint = sha256(raw_bytes).hex[:32]  — matches auth.js
read_fingerprint() {
  local pub="$1"
  printf '%s' "${pub}" | base64 -d | sha256sum | cut -c1-32
}

# Write the one-time setup token to a 0600 file the daemon reads on startup.
# The daemon uses it ONCE to call /agentic/asc/register, then the file can be
# deleted (the Ed25519 key becomes the permanent credential after approval).
write_setup_token() {
  if [[ -z "${MYAPI_TOKEN}" ]]; then
    if [[ -f "${TOKEN_FILE}" ]]; then
      ok "Reusing existing setup token at ${TOKEN_FILE}"
    else
      warn "MYAPI_TOKEN not provided — the daemon will not be able to auto-register."
      warn "Either re-run with MYAPI_TOKEN=... or write a token to ${TOKEN_FILE} (mode 0600) later."
    fi
    return 0
  fi
  log "Writing setup token to ${TOKEN_FILE}..."
  printf '%s' "${MYAPI_TOKEN}" > "${TOKEN_FILE}"
  chown "${MYAPI_USER}:${MYAPI_USER}" "${TOKEN_FILE}"
  chmod 0600 "${TOKEN_FILE}"
  ok "Setup token written (0600 ${MYAPI_USER}:${MYAPI_USER})"
}

# ── server.js (MCP HTTP daemon, zero npm deps) ─────────────────────────────────
write_server_js() {
  log "Writing MCP daemon to ${SERVER_JS}..."
  cat > "${SERVER_JS}" <<'SERVEREOF'
'use strict';
// myapi-asc MCP HTTP daemon — zero npm dependencies
// Private key never leaves this process; no tool exposes it.
const http   = require('http');
const https  = require('https');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const STATE_DIR  = process.env.MYAPI_ASC_STATE_DIR || '/var/lib/myapi-asc';
const BIND       = process.env.MYAPI_ASC_BIND      || '127.0.0.1';
const PORT       = parseInt(process.env.MYAPI_ASC_PORT || '9587', 10);
const MYAPI_URL  = (process.env.MYAPI_URL || 'https://www.myapiai.com').replace(/\/$/, '');
const TOKEN_FILE = path.join(STATE_DIR, 'setup_token');
const VERSION    = '1.1.0';

// MYAPI_TOKEN is consumed ONCE for the initial /asc/register call. After approval,
// the Ed25519 key is the permanent credential and the token can be removed.
function loadSetupToken() {
  if (process.env.MYAPI_TOKEN) return String(process.env.MYAPI_TOKEN).trim();
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').trim() || null; } catch { return null; }
}

// ── Key loading ────────────────────────────────────────────────────────────────
let PRIV_KEY, PUB_KEY_B64, FINGERPRINT;
try {
  const pem  = fs.readFileSync(path.join(STATE_DIR, 'ed25519.pem'));
  PRIV_KEY   = crypto.createPrivateKey(pem);
  const pub  = crypto.createPublicKey(PRIV_KEY);
  const der  = pub.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI DER = 12-byte ASN.1 header + 32-byte raw key
  PUB_KEY_B64  = der.slice(der.length - 32).toString('base64');
  FINGERPRINT  = crypto.createHash('sha256').update(Buffer.from(PUB_KEY_B64, 'base64')).digest('hex').slice(0, 32);
} catch (e) {
  console.error('[myapi-asc] FATAL: cannot load private key:', e.message);
  process.exit(1);
}

console.log(`[myapi-asc] v${VERSION} starting`);
console.log(`[myapi-asc] fingerprint : ${FINGERPRINT}`);
console.log(`[myapi-asc] public key  : ${PUB_KEY_B64}`);

// ── Signing ────────────────────────────────────────────────────────────────────
function ascHeaders() {
  const ts  = Math.floor(Date.now() / 1000).toString();
  const msg = Buffer.from(`${ts}:${FINGERPRINT}`);
  const sig = crypto.sign(null, msg, PRIV_KEY);
  return {
    'X-Agent-PublicKey':  PUB_KEY_B64,
    'X-Agent-Signature':  sig.toString('base64'),
    'X-Agent-Timestamp':  ts,
  };
}

// ── MyApi HTTP client ──────────────────────────────────────────────────────────
// `signed: false` = bare request (used for register/restore/key-status; sending an
// ASC signature for an unapproved key would itself 401 and prevent registration).
function myapiCall(method, apiPath, body, extra, opts) {
  return new Promise((resolve, reject) => {
    if (!apiPath.startsWith('/')) return reject(new Error('path must start with /'));
    const signed = !opts || opts.signed !== false;
    const url     = new URL(MYAPI_URL + apiPath);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      ...(signed ? ascHeaders() : {}),
      ...(extra || {}),
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
    };
    const reqOpts = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers,
    };
    const proto = url.protocol === 'https:' ? https : http;
    const req   = proto.request(reqOpts, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Server-side approval check (single source of truth) ───────────────────────
async function checkApprovalStatus() {
  try {
    const r = await myapiCall('GET', `/api/v1/agentic/asc/key-status?fingerprint=${FINGERPRINT}`,
      null, null, { signed: false });
    if (r.status === 200 && r.body && typeof r.body.status === 'string') return r.body.status;
  } catch { /* fall through */ }
  return 'unknown';
}

// ── Self-restore (proves private-key ownership to reactivate a revoked entry) ─
async function tryRestore() {
  try {
    const ts  = Math.floor(Date.now() / 1000).toString();
    const msg = Buffer.from(`${ts}:${FINGERPRINT}`);
    const sig = crypto.sign(null, msg, PRIV_KEY).toString('base64');
    const r = await myapiCall('POST', '/api/v1/agentic/asc/restore',
      { public_key: PUB_KEY_B64, signature: sig, timestamp: ts },
      null, { signed: false });
    return r.status === 200 && r.body && r.body.status === 'restored';
  } catch { return false; }
}

// ── Auto-registration ─────────────────────────────────────────────────────────
async function autoRegister() {
  const token = loadSetupToken();
  if (!token) return { ok: false, code: 'NO_TOKEN' };
  const r = await myapiCall('POST', '/api/v1/agentic/asc/register',
    { public_key: PUB_KEY_B64, label: 'AI Agent (ASC daemon)' },
    { 'Authorization': `Bearer ${token}` },
    { signed: false });
  if (r.status === 200 && r.body && r.body.status === 'already_approved') {
    return { ok: true, alreadyApproved: true };
  }
  if (r.status === 202) return { ok: true };
  if (r.status === 401) return { ok: false, code: 'INVALID_TOKEN' };
  if (r.status === 403 && r.body && r.body.feature) {
    return { ok: false, code: 'PLAN_REQUIRED', plan: r.body.plan, upgradeHint: r.body.upgradeHint, error: r.body.error };
  }
  return { ok: false, code: 'REGISTER_FAILED', status: r.status, body: r.body };
}

// ── Tool implementations ───────────────────────────────────────────────────────
async function toolStatus() {
  let status = await checkApprovalStatus();

  // First-run path: if the key isn't registered yet and we have a setup token,
  // register it automatically. User then approves at /dashboard/devices.
  if (status === 'not_registered') {
    const reg = await autoRegister();
    if (reg.ok && reg.alreadyApproved) status = 'approved';
    else if (reg.ok)                   status = 'pending';
    else if (reg.code === 'NO_TOKEN') {
      return {
        approved:    false,
        fingerprint: FINGERPRINT,
        public_key:  PUB_KEY_B64,
        myapi_url:   MYAPI_URL,
        code:        'SETUP_REQUIRED',
        message:
          'MyApi setup required (one-time). Create a personal token at ' +
          MYAPI_URL + '/dashboard/access-tokens, then either:\n' +
          '  • set MYAPI_TOKEN env var on the systemd unit, OR\n' +
          '  • write the token to ' + TOKEN_FILE + ' (mode 0600) and restart the service.\n' +
          'After approval at ' + MYAPI_URL + '/dashboard/devices the token can be removed — the Ed25519 key is permanent.',
      };
    }
    else if (reg.code === 'INVALID_TOKEN') {
      return {
        approved:    false,
        fingerprint: FINGERPRINT,
        myapi_url:   MYAPI_URL,
        code:        'INVALID_SETUP_TOKEN',
        message:     'MYAPI_TOKEN is invalid or revoked. Generate a new one at ' + MYAPI_URL + '/dashboard/access-tokens.',
      };
    }
    else if (reg.code === 'PLAN_REQUIRED') {
      return {
        approved:    false,
        fingerprint: FINGERPRINT,
        myapi_url:   MYAPI_URL,
        code:        'PLAN_REQUIRED',
        plan:        reg.plan,
        message:     (reg.error || 'Agentic connections require Pro or Enterprise.') +
                     ' ' + (reg.upgradeHint || 'Upgrade at ' + MYAPI_URL + '/dashboard/billing.'),
      };
    }
    else {
      return {
        approved:    false,
        fingerprint: FINGERPRINT,
        myapi_url:   MYAPI_URL,
        code:        'REGISTER_FAILED',
        message:     'Auto-registration failed (HTTP ' + reg.status + '). Visit ' + MYAPI_URL + '/dashboard/devices to register manually.',
      };
    }
  }

  if (status === 'pending') {
    return {
      approved:    false,
      fingerprint: FINGERPRINT,
      myapi_url:   MYAPI_URL,
      code:        'PENDING_APPROVAL',
      message:     'Key registered — awaiting approval. Open ' + MYAPI_URL + '/dashboard/devices and click Approve, then call myapi_status again.',
    };
  }

  if (status === 'denied') {
    return {
      approved:    false,
      fingerprint: FINGERPRINT,
      myapi_url:   MYAPI_URL,
      code:        'DENIED',
      message:     'Key approval was denied. Contact the account owner, or rotate the keypair (sudo myapi-asc-bootstrap.sh rotate).',
    };
  }

  if (status === 'approved') {
    // Fetch full context so the AI knows exactly what it can do.
    const ctx = await myapiCall('GET', '/api/v1/gateway/context', null);
    if (ctx.status === 200) {
      return {
        approved:    true,
        fingerprint: FINGERPRINT,
        public_key:  PUB_KEY_B64,
        myapi_url:   MYAPI_URL,
        context:     ctx.body,
        hint:        'Context above includes identity, memory, connected services, and the full endpoint catalog. For service calls (Google, GitHub, Slack, Notion, LinkedIn, etc.) ALWAYS consult context.service_instructions[serviceName].actions FIRST — it lists exact paths and request bodies. Do NOT invent paths like /services/google/calendar/events; use the patterns shown there (typically POST /services/{name}/proxy with body {path, method, body}).',
      };
    }
    // Approved but context failed — try self-restore once (key may have been revoked then re-approved).
    if (ctx.status === 401) {
      if (await tryRestore()) {
        const retry = await myapiCall('GET', '/api/v1/gateway/context', null);
        if (retry.status === 200) {
          return { approved: true, fingerprint: FINGERPRINT, public_key: PUB_KEY_B64, myapi_url: MYAPI_URL, context: retry.body, restored: true };
        }
      }
      return {
        approved:    false,
        fingerprint: FINGERPRINT,
        myapi_url:   MYAPI_URL,
        code:        'AUTH_INCONSISTENT',
        message:     'Server reports key as approved but rejected the signed request. Ask the user to revoke and re-approve at ' + MYAPI_URL + '/dashboard/devices.',
      };
    }
    return {
      approved:    true,
      fingerprint: FINGERPRINT,
      myapi_url:   MYAPI_URL,
      message:     'Connection active but /gateway/context returned ' + ctx.status + '. Call myapi_request GET /gateway/context to retry.',
    };
  }

  return {
    approved:    false,
    fingerprint: FINGERPRINT,
    myapi_url:   MYAPI_URL,
    code:        'UNKNOWN',
    message:     'Could not determine key status. Check that ' + MYAPI_URL + ' is reachable.',
  };
}

// Endpoints that require a browser session cookie — they will 401 over ASC by design.
// Rejecting locally saves a round-trip and prevents AI agents from misreading the 401
// as "the MCP is broken".
const FORBIDDEN_PATTERNS = [
  /^\/api\/v1\/auth\/me\b/,
  /^\/api\/v1\/auth\/login\b/,
  /^\/api\/v1\/auth\/logout\b/,
  /^\/api\/v1\/auth\/2fa\//,
  /^\/api\/v1\/auth\/session-token\b/,
  /^\/api\/v1\/oauth\//,
];

async function toolRequest(args) {
  const a = args || {};
  const method = (a.method || 'GET').toUpperCase();
  const p = a.path;
  const body = a.body !== undefined ? a.body : null;
  const workspace_id = a.workspace_id;
  if (!p)                 throw new Error('path is required');
  if (p.charAt(0) !== '/') throw new Error('path must start with /');

  if (FORBIDDEN_PATTERNS.some(rx => rx.test(p))) {
    return {
      status: 400,
      body: {
        error: 'forbidden_endpoint',
        message:
          p + ' is a browser-session endpoint and is NOT callable over ASC. ' +
          'It would return 401 "Missing session / Bearer token". ' +
          'Use /api/v1/identity for user info or /api/v1/gateway/context for full user context. ' +
          'The MCP does NOT need any /auth/* endpoint — the Ed25519 key already authenticates every request.',
      },
    };
  }

  const extra = workspace_id ? { 'X-Workspace-ID': String(workspace_id) } : {};
  let r = await myapiCall(method, p, body, extra);

  // On 401: try silent self-restore and retry once.
  if (r.status === 401) {
    if (await tryRestore()) {
      r = await myapiCall(method, p, body, extra);
    } else {
      return {
        status: 401,
        body: {
          error:       'asc_key_not_approved',
          fingerprint: FINGERPRINT,
          message:
            'The signed request was rejected. Most likely the user has not approved this device yet. ' +
            'Ask them to open ' + MYAPI_URL + '/dashboard/devices and click Approve for fingerprint ' +
            FINGERPRINT + '. Then call myapi_status again.',
        },
      };
    }
  }

  // Surface plan-gating cleanly (server returns 403 with feature + upgradeHint).
  if (r.status === 403 && r.body && typeof r.body === 'object' && r.body.feature) {
    return {
      status: 403,
      body: {
        error:       r.body.error || 'plan_required',
        plan:        r.body.plan,
        upgradeHint: r.body.upgradeHint || ('Upgrade at ' + MYAPI_URL + '/dashboard/billing'),
        message:     (r.body.error || 'This feature is not available on the current plan.') +
                     ' ' + (r.body.upgradeHint || 'Upgrade at ' + MYAPI_URL + '/dashboard/billing.'),
      },
    };
  }

  return { status: r.status, body: r.body };
}

// Kept for backward compatibility — thin wrapper around /identity that surfaces
// the same actionable 401/403 messages as toolRequest.
async function toolIdentity(args) {
  return toolRequest({ method: 'GET', path: '/api/v1/identity', workspace_id: (args || {}).workspace_id });
}

// ── Tool manifest ──────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'myapi_status',
    description:
      '⚠️  CALL THIS FIRST in every new session. Returns full operational context ' +
      '(identity, connected services, memory, endpoint catalog) when the connection is live. ' +
      'On first run, if MYAPI_TOKEN was set at install time, auto-registers the key — ' +
      'the user then approves once at ' + MYAPI_URL + '/dashboard/devices. ' +
      'After approval the Ed25519 key is the permanent credential (token no longer needed).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'myapi_request',
    description:
      'Proxy a signed request to any MyApi endpoint. All requests are signed automatically ' +
      'with this machine\'s Ed25519 key (never expires; no refresh).\n\n' +
      '⚠️  Call myapi_status FIRST to confirm the connection is active. MYAPI_TOKEN (if set) ' +
      'is consumed ONCE at registration only — ongoing requests do NOT use a Bearer token.\n\n' +
      'KEY ENDPOINTS:\n' +
      '  GET  /api/v1/gateway/context          — full user context\n' +
      '  GET  /api/v1/identity                 — name, email, timezone, bio\n' +
      '  GET  /api/v1/services                 — connected services\n' +
      '  GET  /api/v1/services/{name}/proxy    — proxy to Google/GitHub/Slack/etc.\n' +
      '  POST /api/v1/memory                   — write persistent memory\n' +
      '  GET  /api/v1/brain/knowledge-base     — knowledge base documents\n\n' +
      'FORBIDDEN (rejected locally — they require a browser session cookie):\n' +
      '  /api/v1/auth/me, /api/v1/auth/login, /api/v1/auth/logout, /api/v1/auth/2fa/*,\n' +
      '  /api/v1/auth/session-token, /api/v1/oauth/*. Use /api/v1/identity instead of /auth/me.',
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        method:       { type: 'string', enum: ['GET','POST','PUT','PATCH','DELETE'], default: 'GET' },
        path:         { type: 'string', description: 'MyApi API path including /api/v1 prefix, e.g. /api/v1/identity' },
        body:         { type: 'object', description: 'Request body for POST/PUT/PATCH' },
        workspace_id: { type: 'string', description: 'Optional workspace ID for multi-tenant calls' },
      },
    },
  },
  {
    name: 'myapi_identity',
    description:
      'Shorthand for GET /api/v1/identity. Returns the MyApi identity associated with this ' +
      'machine\'s approved ASC key. If the key is not approved, returns an actionable 401 ' +
      'pointing the user to ' + MYAPI_URL + '/dashboard/devices.',
    inputSchema: {
      type: 'object',
      properties: { workspace_id: { type: 'string' } },
    },
  },
];

// ── MCP JSON-RPC handler ───────────────────────────────────────────────────────
async function handleMsg(msg) {
  const id     = ('id' in msg) ? msg.id : null;
  const method = msg.method;
  const isNotification = !('id' in msg);

  const ok  = r  => ({ jsonrpc: '2.0', id, result: r });
  const err = (c, m) => ({ jsonrpc: '2.0', id, error: { code: c, message: m } });

  try {
    if (method === 'initialize') {
      // Negotiate: honour client's requested version if we support it, else use latest
      const clientVer = (msg.params || {}).protocolVersion || '2025-03-26';
      const proto = ['2025-03-26', '2024-11-05'].includes(clientVer) ? clientVer : '2025-03-26';
      return ok({ protocolVersion: proto, capabilities: { tools: {} }, serverInfo: { name: 'myapi-asc', version: VERSION } });
    }
    if (method === 'ping') return ok({});
    if (isNotification) return null;          // notifications: no response

    if (method === 'tools/list') return ok({ tools: TOOLS });

    if (method === 'tools/call') {
      const { name, arguments: args } = msg.params || {};
      let result;
      if      (name === 'myapi_status')   result = await toolStatus();
      else if (name === 'myapi_request')  result = await toolRequest(args);
      else if (name === 'myapi_identity') result = await toolIdentity(args);
      else return err(-32601, `Unknown tool: ${name}`);

      return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false });
    }

    if (isNotification) return null;
    return err(-32601, `Method not found: ${method}`);
  } catch (e) {
    if (isNotification) return null;
    return ok({ content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }], isError: true });
  }
}

// ── SSE session store (for older MCP clients that use SSE transport) ───────────
const sseSessions = new Map();
let sseSeq = 0;

function sseWrite(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── HTTP server ────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];
  const accept   = req.headers['accept'] || '';

  // ── GET /health ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', version: VERSION, fingerprint: FINGERPRINT }));
  }

  // ── GET /status ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/status') {
    try {
      const s = await toolStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(s, null, 2));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // ── GET /sse  (MCP 2024-11-05 SSE transport) ─────────────────────────────────
  // Older clients (Claude Desktop pre-2025, some SDKs) open a persistent SSE
  // stream here and send their JSON-RPC messages via POST /message.
  if (req.method === 'GET' && (pathname === '/sse' || pathname === '/mcp') && accept.includes('text/event-stream')) {
    const sessionId = `s${++sseSeq}`;
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    // Tell the client where to POST messages
    sseWrite(res, 'endpoint', `http://${BIND}:${PORT}/message?sessionId=${sessionId}`);
    sseSessions.set(sessionId, res);
    req.on('close', () => sseSessions.delete(sessionId));
    return;
  }

  // ── POST /message  (MCP 2024-11-05 SSE transport — client→server messages) ──
  if (req.method === 'POST' && pathname === '/message') {
    const sessionId = new URL(req.url, `http://${BIND}`).searchParams.get('sessionId');
    const sseRes    = sessionId ? sseSessions.get(sessionId) : null;
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', async () => {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end('{}');
      try {
        const msg  = JSON.parse(raw);
        const msgs = Array.isArray(msg) ? msg : [msg];
        const outs = (await Promise.all(msgs.map(handleMsg))).filter(r => r !== null);
        if (sseRes) {
          outs.forEach(o => sseWrite(sseRes, 'message', o));
        }
      } catch { /* malformed — ignored; client will time out */ }
    });
    return;
  }

  // ── POST /mcp  (MCP 2025-03-26 Streamable HTTP transport) ───────────────────
  // Modern clients (Claude Code CLI, agents using @modelcontextprotocol/sdk ≥ 1.6)
  // POST directly here and read the JSON response (or SSE stream if they send Accept: text/event-stream).
  if (req.method === 'POST' && pathname === '/mcp') {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', async () => {
      try {
        const msg  = JSON.parse(raw);
        const msgs = Array.isArray(msg) ? msg : [msg];
        const outs = (await Promise.all(msgs.map(handleMsg))).filter(r => r !== null);
        const body = Array.isArray(msg) ? outs : (outs[0] !== undefined ? outs[0] : '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(body ? JSON.stringify(body) : '');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      }
    });
    return;
  }

  // ── GET /mcp  — helpful 405 so clients know the method ──────────────────────
  if (req.method === 'GET' && pathname === '/mcp') {
    res.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'POST' });
    return res.end(JSON.stringify({
      error: 'Method Not Allowed',
      hint:  'This is an MCP endpoint. POST JSON-RPC here, or GET /sse for SSE transport.',
      endpoints: { streamable_http: `POST http://${BIND}:${PORT}/mcp`, sse: `GET http://${BIND}:${PORT}/sse`, health: `GET http://${BIND}:${PORT}/health` },
    }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, BIND, () => {
  console.log(`[myapi-asc] v${VERSION} ready`);
  console.log(`[myapi-asc] streamable HTTP : POST http://${BIND}:${PORT}/mcp`);
  console.log(`[myapi-asc] SSE transport   : GET  http://${BIND}:${PORT}/sse`);
  console.log(`[myapi-asc] health/status   : GET  http://${BIND}:${PORT}/health`);
});
server.on('error', e => { console.error('[myapi-asc]', e.message); process.exit(1); });

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
SERVEREOF

  chown "${MYAPI_USER}:${MYAPI_USER}" "${SERVER_JS}"
  chmod 0640 "${SERVER_JS}"
  ok "server.js written (${SERVER_JS})"
}

# ── systemd unit ───────────────────────────────────────────────────────────────
write_unit() {
  local node_bin
  node_bin=$(command -v node)

  log "Writing systemd unit ${UNIT_FILE}..."
  cat > "${UNIT_FILE}" <<UNITEOF
[Unit]
Description=MyApi ASC MCP Daemon
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=10

[Service]
Type=simple
User=${MYAPI_USER}
Group=${MYAPI_USER}

Environment=MYAPI_ASC_STATE_DIR=${STATE_DIR}
Environment=MYAPI_ASC_BIND=${MCP_BIND}
Environment=MYAPI_ASC_PORT=${MCP_PORT}
Environment=MYAPI_URL=${MYAPI_URL}
Environment=NODE_ENV=production
# The daemon also reads MYAPI_TOKEN from ${TOKEN_FILE} (mode 0600) if no env var is set —
# that file is the canonical place to put the one-time registration token.

ExecStart=${node_bin} ${SERVER_JS}

Restart=always
RestartSec=5
TimeoutStopSec=10

# Hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=${STATE_DIR}
ProtectHome=yes
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
UNITEOF

  ok "Unit file written"
}

# ── Service management ─────────────────────────────────────────────────────────
start_service() {
  log "Reloading systemd and enabling service..."
  systemctl daemon-reload
  systemctl enable --quiet "${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
  ok "Service started"
}

wait_healthy() {
  log "Waiting for daemon to become healthy..."
  local url="http://${MCP_BIND}:${MCP_PORT}/health"
  local i
  for i in $(seq 1 20); do
    if curl -sf "${url}" >/dev/null 2>&1; then
      ok "Daemon healthy at ${url}"
      return 0
    fi
    sleep 0.5
  done
  warn "Health check timed out after 10s. Showing logs:"
  journalctl -u "${SERVICE_NAME}" --no-pager -n 30 >&2 || true
  die "Daemon did not start. Check: journalctl -u ${SERVICE_NAME} -n 50"
}

# ── Summary output ─────────────────────────────────────────────────────────────
print_summary() {
  local pub fp svc_status has_token
  pub=$(read_pubkey 2>/dev/null) || { warn "Could not read public key"; return; }
  fp=$(read_fingerprint "${pub}")
  svc_status=$(systemctl is-active "${SERVICE_NAME}" 2>/dev/null || echo "inactive")
  has_token="no"
  [[ -s "${TOKEN_FILE}" ]] && has_token="yes"

  echo ""
  hr
  printf "${BOLD}  MyApi ASC — Bootstrap Complete${NC}\n"
  hr
  echo ""
  printf "  SERVICE STATUS   ${GREEN}%s${NC}\n" "${svc_status}"
  printf "  MCP ENDPOINT     %s\n" "${MCP_URL}"
  printf "  HEALTH CHECK     http://%s:%s/health\n" "${MCP_BIND}" "${MCP_PORT}"
  printf "  FINGERPRINT      %s\n" "${fp}"
  printf "  STATE DIR        %s\n" "${STATE_DIR}"
  printf "  RUN AS USER      %s  (system account, no login shell)\n" "${MYAPI_USER}"
  printf "  SETUP TOKEN      %s\n" "${has_token}"
  echo ""
  hr
  printf "${BOLD}  NEXT STEPS${NC}\n"
  hr
  echo ""
  if [[ "${has_token}" == "yes" ]]; then
    printf "  1. The daemon will auto-register on first AI agent call (myapi_status).\n"
    printf "  2. Approve this device at:\n"
    printf "     ${BLUE}%s/dashboard/devices${NC}\n" "${MYAPI_URL}"
    printf "  3. After approval, the setup token is no longer needed — the Ed25519\n"
    printf "     key is the permanent credential. You may delete %s\n" "${TOKEN_FILE}"
  else
    printf "  1. Provide a one-time setup token so the daemon can register itself:\n"
    printf "     ${DIM}sudo bash -c 'echo YOUR_MYAPI_TOKEN > %s && chmod 600 %s && chown %s:%s %s'${NC}\n" \
      "${TOKEN_FILE}" "${TOKEN_FILE}" "${MYAPI_USER}" "${MYAPI_USER}" "${TOKEN_FILE}"
    printf "     Generate the token at ${BLUE}%s/dashboard/access-tokens${NC}\n" "${MYAPI_URL}"
    printf "     Then: ${DIM}sudo systemctl restart %s${NC}\n" "${SERVICE_NAME}"
    echo ""
    printf "     OR re-run the installer with MYAPI_TOKEN set:\n"
    printf "     ${DIM}sudo MYAPI_TOKEN=myapi_xxx bash -c \"\$(curl -fsSL %s/install/asc)\"${NC}\n" "${MYAPI_URL}"
    echo ""
    printf "  2. Approve this device at ${BLUE}%s/dashboard/devices${NC} after registration.\n" "${MYAPI_URL}"
  fi
  echo ""
  printf "  Verify with: ${DIM}curl -s http://%s:%s/status${NC}\n" "${MCP_BIND}" "${MCP_PORT}"
  echo ""
  printf "  Point any MCP-capable agent at:\n"
  printf '    {\n'
  printf '      "mcpServers": {\n'
  printf '        "myapi": { "url": "%s" }\n' "${MCP_URL}"
  printf '      }\n'
  printf '    }\n'
  echo ""
  printf "  PUBLIC KEY (for reference):\n"
  printf "  ${GREEN}%s${NC}\n" "${pub}"
  echo ""
  hr
  echo ""
}

# ── Commands ───────────────────────────────────────────────────────────────────
cmd_install() {
  echo ""
  hr
  printf "${BOLD}  MyApi ASC — Installing${NC}\n"
  hr

  step "[1/9] Checking prerequisites..."
  check_linux_systemd
  check_openssl
  ensure_node
  ok "Prerequisites satisfied"

  step "[2/9] Checking port availability..."
  check_port

  step "[3/9] Setting up dedicated user and state directory..."
  setup_user
  setup_state_dir

  step "[4/9] Generating Ed25519 keypair..."
  generate_keypair

  step "[5/9] Writing MCP daemon (server.js)..."
  write_server_js

  step "[6/9] Writing one-time setup token..."
  write_setup_token

  step "[7/9] Writing systemd unit..."
  write_unit

  step "[8/9] Starting service..."
  start_service
  wait_healthy

  step "[9/9] Done."
  print_summary
}

cmd_status() {
  echo ""
  hr
  printf "${BOLD}  MyApi ASC — Status${NC}\n"
  hr
  echo ""

  # Service state
  local svc
  svc=$(systemctl is-active "${SERVICE_NAME}" 2>/dev/null || echo "inactive")
  printf "  SERVICE   %s\n" "${svc}"

  if [[ "${svc}" != "active" ]]; then
    warn "Service is not running. Start with: sudo systemctl start ${SERVICE_NAME}"
    echo ""
    return 0
  fi

  # Health
  local health_url="http://${MCP_BIND}:${MCP_PORT}/health"
  if curl -sf "${health_url}" >/dev/null 2>&1; then
    ok "Daemon healthy at ${health_url}"
  else
    warn "Daemon not responding at ${health_url}"
    return 0
  fi

  # Approval state from MCP daemon
  echo ""
  printf "  APPROVAL STATUS (live check):\n"
  curl -s "http://${MCP_BIND}:${MCP_PORT}/status" 2>/dev/null \
    | python3 -m json.tool 2>/dev/null \
    || curl -s "http://${MCP_BIND}:${MCP_PORT}/status"
  echo ""
  hr
  echo ""
}

cmd_rotate() {
  check_root
  local pem="${STATE_DIR}/ed25519.pem"

  [[ -f "${pem}" ]] || die "No keypair found at ${pem}. Run: sudo bash $0 install"

  echo ""
  hr
  printf "${BOLD}  MyApi ASC — Key Rotation${NC}\n"
  hr
  echo ""
  warn "This generates a NEW Ed25519 keypair."
  warn "You MUST re-register and re-approve the new public key in MyApi."
  warn "All ASC calls will fail until the new key is approved."
  echo ""
  printf "  Continue? [y/N] "
  read -r yn
  [[ "${yn}" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }

  # Backup old key
  local bak="${pem}.bak.$(date +%s)"
  cp "${pem}" "${bak}"
  chown "${MYAPI_USER}:${MYAPI_USER}" "${bak}"
  chmod 0600 "${bak}"
  ok "Old key backed up to ${bak}"

  # Stop service, remove key, regenerate, restart
  systemctl stop "${SERVICE_NAME}" || true
  rm -f "${pem}"
  generate_keypair
  systemctl start "${SERVICE_NAME}"
  wait_healthy
  print_summary
}

cmd_logs() {
  exec journalctl -u "${SERVICE_NAME}" -f --no-pager
}

cmd_uninstall() {
  check_root

  echo ""
  hr
  printf "${BOLD}  MyApi ASC — Uninstall${NC}\n"
  hr
  echo ""
  warn "This will remove the service, keypair, and all state."
  warn "The key will no longer work even if approved in MyApi."
  printf "  Continue? [y/N] "
  read -r yn
  [[ "${yn}" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }

  log "Stopping and disabling service..."
  systemctl stop    "${SERVICE_NAME}" 2>/dev/null || true
  systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
  rm -f "${UNIT_FILE}"
  systemctl daemon-reload || true
  ok "Service removed"

  log "Removing state directory ${STATE_DIR}..."
  rm -rf "${STATE_DIR}"
  ok "State directory removed"

  log "Removing user ${MYAPI_USER}..."
  userdel "${MYAPI_USER}" 2>/dev/null || true
  ok "User removed"

  hr
  printf "  ${GREEN}Uninstall complete.${NC}\n"
  printf "  Remember to revoke the key in MyApi → Connectors → Agent Connections.\n"
  hr
  echo ""
}

# ── Dispatch ───────────────────────────────────────────────────────────────────
CMD="${1:-install}"
case "${CMD}" in
  install)   check_root; cmd_install ;;
  status)    cmd_status ;;
  rotate)    cmd_rotate ;;
  logs)      cmd_logs ;;
  uninstall) cmd_uninstall ;;
  *)
    echo ""
    printf "Usage: sudo bash %s [install|status|rotate|logs|uninstall]\n" "$0"
    echo ""
    printf "  install    Install or update the ASC daemon (idempotent)\n"
    printf "  status     Check service health and approval state\n"
    printf "  rotate     Replace keypair (requires re-approval in MyApi)\n"
    printf "  logs       Tail daemon logs\n"
    printf "  uninstall  Remove service, user, and keypair\n"
    echo ""
    exit 1
    ;;
esac

# ── DOCKER FALLBACK (no systemd) ───────────────────────────────────────────────
# If systemd is unavailable, run the daemon as a Docker container:
#
#   mkdir -p /var/lib/myapi-asc
#   openssl genpkey -algorithm ed25519 -out /var/lib/myapi-asc/ed25519.pem
#   chmod 0600 /var/lib/myapi-asc/ed25519.pem
#
#   docker run -d \
#     --name myapi-asc \
#     --restart unless-stopped \
#     -v /var/lib/myapi-asc:/var/lib/myapi-asc:ro \
#     -p 127.0.0.1:9587:9587 \
#     -e MYAPI_ASC_STATE_DIR=/var/lib/myapi-asc \
#     -e MYAPI_URL=https://www.myapiai.com \
#     node:20-alpine \
#     node /var/lib/myapi-asc/server.js
#
#   # (copy server.js to /var/lib/myapi-asc/server.js first)
