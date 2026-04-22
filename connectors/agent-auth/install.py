#!/usr/bin/env python3
"""
MyApi Agent Auth — myapiai.com
Python 3 fallback installer (no Node.js required).
Compatible with Python 3.6+.

Usage:
  python3 install.py
  curl -sL https://www.myapiai.com/api/v1/agent-auth/install.py | python3
"""

import sys
import os
import json
import hashlib
import base64
import secrets
import threading
import webbrowser
import urllib.request
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

MYAPI_URL = os.environ.get("MYAPI_URL", "https://www.myapiai.com").rstrip("/")
CLIENT_ID = "myapi-agent"
SCOPE = "full"

# ─── Base64url ────────────────────────────────────────────────────────────────

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

# ─── PKCE ─────────────────────────────────────────────────────────────────────

def pkce():
    verifier = b64url(secrets.token_bytes(96))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge

# ─── HTML pages ───────────────────────────────────────────────────────────────

SUCCESS_HTML = b"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>MyApi \xe2\x80\x94 Authorized</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#020817;color:#f8fafc;
font-family:-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;
justify-content:center}.card{background:#0f172a;border:1px solid #1e293b;border-radius:16px;
padding:40px;max-width:400px;width:100%;text-align:center}.icon{font-size:40px;margin-bottom:16px}
h1{color:#f1f5f9;font-size:22px}p{color:#94a3b8;font-size:14px;margin-top:8px}</style></head>
<body><div class="card"><div class="icon">\xe2\x9c\x93</div><h1>Authorized!</h1>
<p>Your AI agent now has a dedicated MyApi access token.</p>
<p style="margin-top:16px;font-size:13px;color:#475569">You can close this window.</p>
</div></body></html>"""

DENIED_HTML = b"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>MyApi \xe2\x80\x94 Denied</title>
<style>body{background:#020817;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;
justify-content:center;min-height:100vh}.card{background:#0f172a;border:1px solid #7f1d1d;
border-radius:16px;padding:40px;max-width:400px;text-align:center}</style></head>
<body><div class="card"><h1 style="color:#fca5a5">Authorization Denied</h1>
<p style="color:#94a3b8;margin-top:8px">You can close this window.</p></div></body></html>"""

# ─── Callback server ──────────────────────────────────────────────────────────

_result = {}

def make_handler(expected_state, done_event):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a): pass  # silence access logs

        def do_GET(self):
            if not self.path.startswith("/callback"):
                self.send_response(404); self.end_headers(); return

            parsed = urllib.parse.urlparse(self.path)
            qs = urllib.parse.parse_qs(parsed.query)

            code  = qs.get("code",  [None])[0]
            state = qs.get("state", [None])[0]
            error = qs.get("error", [None])[0]

            if error or not code or state != expected_state:
                self.send_response(400)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(DENIED_HTML)
                _result["error"] = error or "state_mismatch"
            else:
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(SUCCESS_HTML)
                _result["code"] = code

            done_event.set()

    return Handler

# ─── Token exchange ───────────────────────────────────────────────────────────

def exchange_code(code, redirect_uri, verifier):
    data = urllib.parse.urlencode({
        "grant_type":    "authorization_code",
        "code":          code,
        "redirect_uri":  redirect_uri,
        "client_id":     CLIENT_ID,
        "code_verifier": verifier,
    }).encode()
    req = urllib.request.Request(
        MYAPI_URL + "/api/v1/oauth-server/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if sys.version_info < (3, 6):
        print("Error: Python 3.6+ required", file=sys.stderr)
        sys.exit(1)

    verifier, challenge = pkce()
    state = b64url(secrets.token_bytes(16))

    # Find a free port
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]

    redirect_uri = f"http://localhost:{port}/callback"

    params = urllib.parse.urlencode({
        "response_type":        "code",
        "client_id":            CLIENT_ID,
        "redirect_uri":         redirect_uri,
        "scope":                SCOPE,
        "state":                state,
        "code_challenge":       challenge,
        "code_challenge_method": "S256",
    })
    auth_url = f"{MYAPI_URL}/api/v1/oauth-server/authorize?{params}"

    done = threading.Event()
    handler = make_handler(state, done)
    server = HTTPServer(("127.0.0.1", port), handler)
    t = threading.Thread(target=server.serve_forever)
    t.daemon = True
    t.start()

    opened = webbrowser.open(auth_url)
    if opened:
        print("\n✓ Browser opened — sign in to MyApi and click Authorize.", file=sys.stderr)
        print("  If the browser did not open, copy this URL manually:\n", file=sys.stderr)
    else:
        print("\n  Open this URL in your browser to authorize:\n", file=sys.stderr)
    print(f"  {auth_url}\n", file=sys.stderr)
    print("  Waiting for authorization (timeout: 5 min)...", file=sys.stderr)

    if not done.wait(timeout=300):
        server.shutdown()
        print("\nError: Timeout — no browser response within 5 minutes", file=sys.stderr)
        sys.exit(1)

    server.shutdown()

    if "error" in _result:
        print(f"\nError: Authorization denied ({_result['error']})", file=sys.stderr)
        sys.exit(1)

    print("\n✓ Authorization received — exchanging for token...", file=sys.stderr)

    try:
        resp = exchange_code(_result["code"], redirect_uri, verifier)
    except Exception as e:
        print(f"\nError: Token exchange failed: {e}", file=sys.stderr)
        sys.exit(1)

    token = resp.get("access_token")
    if not token:
        print(f"\nError: No access_token in response: {resp}", file=sys.stderr)
        sys.exit(1)

    print("\n" + "═" * 64, file=sys.stderr)
    print("  Your MyApi Agent Token", file=sys.stderr)
    print("═" * 64 + "\n", file=sys.stderr)
    print(f"  {token}\n", file=sys.stderr)
    print("  Use it as:  Authorization: Bearer <token>", file=sys.stderr)
    print("  Tip: set MYAPI_TOKEN=" + token + " in your environment\n", file=sys.stderr)

    # Also print token on stdout for scripting
    print(token)

if __name__ == "__main__":
    main()
