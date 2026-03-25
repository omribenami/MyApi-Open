#!/usr/bin/env bash
# =============================================================================
# MyApi SSL/TLS Setup Script
# Automates Let's Encrypt certificate issuance via certbot
# Supports HTTP-01 (standalone) and DNS-01 (Cloudflare) challenges
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CERT_DIR="${SSL_CERT_DIR:-$PROJECT_ROOT/certs}"
NGINX_CONF="$PROJECT_ROOT/config/nginx/nginx.conf"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SSL]${NC} $1"; }
warn() { echo -e "${YELLOW}[SSL]${NC} $1"; }
error() { echo -e "${RED}[SSL]${NC} $1" >&2; }

usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
  setup       Interactive SSL setup
  letsencrypt Issue Let's Encrypt certificate (HTTP-01 challenge)
  cloudflare  Issue Let's Encrypt certificate (Cloudflare DNS-01 challenge)
  self-signed Generate self-signed certificate for development
  renew       Renew existing Let's Encrypt certificates
  status      Show current certificate status
  revoke      Revoke a Let's Encrypt certificate

Options:
  -d, --domain    Domain name (e.g., api.example.com)
  -e, --email     Email for Let's Encrypt notifications
  -h, --help      Show this help message

Environment Variables:
  SSL_DOMAIN              Domain name
  SSL_EMAIL               Email for Let's Encrypt
  CLOUDFLARE_API_TOKEN    Cloudflare API token (for DNS-01)
  CLOUDFLARE_ZONE_ID      Cloudflare Zone ID (for DNS-01)
  SSL_CERT_DIR            Certificate storage directory

Examples:
  $0 letsencrypt -d api.example.com -e admin@example.com
  $0 cloudflare -d api.example.com -e admin@example.com
  $0 self-signed -d localhost
  $0 renew
  $0 status
EOF
}

# Parse arguments
DOMAIN="${SSL_DOMAIN:-}"
EMAIL="${SSL_EMAIL:-}"
COMMAND="${1:-}"

shift || true

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain) DOMAIN="$2"; shift 2 ;;
        -e|--email) EMAIL="$2"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *) error "Unknown option: $1"; usage; exit 1 ;;
    esac
done

check_certbot() {
    if ! command -v certbot &>/dev/null; then
        error "certbot is not installed."
        echo ""
        echo "Install certbot:"
        echo "  Ubuntu/Debian: sudo apt install certbot"
        echo "  macOS:         brew install certbot"
        echo "  Docker:        Use the certbot/certbot image"
        exit 1
    fi
}

check_domain() {
    if [[ -z "$DOMAIN" ]]; then
        error "Domain is required. Use -d or set SSL_DOMAIN environment variable."
        exit 1
    fi
}

# Issue certificate via HTTP-01 challenge (standalone or webroot)
cmd_letsencrypt() {
    check_certbot
    check_domain

    if [[ -z "$EMAIL" ]]; then
        error "Email is required for Let's Encrypt. Use -e or set SSL_EMAIL."
        exit 1
    fi

    log "Requesting Let's Encrypt certificate for $DOMAIN"
    log "Challenge: HTTP-01 (webroot)"

    mkdir -p "$PROJECT_ROOT/certbot/www"

    certbot certonly \
        --webroot \
        --webroot-path "$PROJECT_ROOT/certbot/www" \
        --domain "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        --keep-until-expiring \
        --cert-name "$DOMAIN"

    # Copy certs to project directory
    copy_certs

    log "Certificate issued successfully for $DOMAIN"
    log "Certificate will auto-renew via certbot timer/cron"
}

# Issue certificate via Cloudflare DNS-01 challenge
cmd_cloudflare() {
    check_certbot
    check_domain

    if [[ -z "$EMAIL" ]]; then
        error "Email is required. Use -e or set SSL_EMAIL."
        exit 1
    fi

    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        error "CLOUDFLARE_API_TOKEN is required for DNS-01 challenge."
        exit 1
    fi

    # Check for cloudflare plugin
    if ! certbot plugins 2>/dev/null | grep -q dns-cloudflare; then
        error "certbot-dns-cloudflare plugin is not installed."
        echo ""
        echo "Install it:"
        echo "  pip install certbot-dns-cloudflare"
        echo "  or: sudo apt install python3-certbot-dns-cloudflare"
        exit 1
    fi

    log "Requesting Let's Encrypt certificate for $DOMAIN"
    log "Challenge: DNS-01 (Cloudflare)"

    # Create Cloudflare credentials file
    local cf_creds
    cf_creds=$(mktemp)
    trap "rm -f '$cf_creds'" EXIT INT TERM
    echo "dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN" > "$cf_creds"
    chmod 600 "$cf_creds"

    certbot certonly \
        --dns-cloudflare \
        --dns-cloudflare-credentials "$cf_creds" \
        --domain "$DOMAIN" \
        --domain "*.$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        --keep-until-expiring \
        --cert-name "$DOMAIN"

    # Cleanup credentials file
    rm -f "$cf_creds"

    # Copy certs to project directory
    copy_certs

    log "Wildcard certificate issued for $DOMAIN and *.$DOMAIN"
}

# Generate self-signed certificate for development
cmd_self_signed() {
    check_domain

    log "Generating self-signed certificate for $DOMAIN"

    mkdir -p "$CERT_DIR/live"

    openssl req -x509 \
        -newkey rsa:2048 \
        -keyout "$CERT_DIR/live/${DOMAIN}-privkey.pem" \
        -out "$CERT_DIR/live/${DOMAIN}-fullchain.pem" \
        -days 365 \
        -nodes \
        -subj "/CN=$DOMAIN/O=MyApi/C=US" \
        -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1" \
        2>/dev/null

    chmod 600 "$CERT_DIR/live/${DOMAIN}-privkey.pem"
    chmod 644 "$CERT_DIR/live/${DOMAIN}-fullchain.pem"

    log "Self-signed certificate generated:"
    log "  Key:  $CERT_DIR/live/${DOMAIN}-privkey.pem"
    log "  Cert: $CERT_DIR/live/${DOMAIN}-fullchain.pem"
    warn "This certificate is for development only. Browsers will show a warning."
}

# Renew certificates
cmd_renew() {
    check_certbot

    log "Renewing Let's Encrypt certificates..."

    certbot renew --quiet

    # Copy renewed certs
    if [[ -n "$DOMAIN" ]]; then
        copy_certs
    fi

    log "Certificate renewal complete"
}

# Show certificate status
cmd_status() {
    log "SSL Certificate Status"
    echo ""

    if [[ -n "$DOMAIN" ]]; then
        local cert_file="$CERT_DIR/live/${DOMAIN}-fullchain.pem"
        local key_file="$CERT_DIR/live/${DOMAIN}-privkey.pem"

        if [[ -f "$cert_file" ]]; then
            echo "Domain: $DOMAIN"
            echo "Certificate: $cert_file"
            echo "Private Key: $key_file"
            echo ""

            # Show certificate details
            openssl x509 -in "$cert_file" -noout \
                -subject -issuer -dates -fingerprint 2>/dev/null || \
                echo "  (Could not parse certificate details)"
        else
            warn "No certificate found for $DOMAIN"
            echo "  Expected: $cert_file"
        fi
    fi

    echo ""

    # Show certbot certificates if available
    if command -v certbot &>/dev/null; then
        echo "Certbot managed certificates:"
        certbot certificates 2>/dev/null || echo "  (No certbot certificates found)"
    fi
}

# Copy Let's Encrypt certs to project directory
copy_certs() {
    local le_dir="/etc/letsencrypt/live/$DOMAIN"

    if [[ -d "$le_dir" ]]; then
        mkdir -p "$CERT_DIR/live"

        cp "$le_dir/fullchain.pem" "$CERT_DIR/live/${DOMAIN}-fullchain.pem"
        cp "$le_dir/privkey.pem" "$CERT_DIR/live/${DOMAIN}-privkey.pem"
        cp "$le_dir/chain.pem" "$CERT_DIR/live/${DOMAIN}-chain.pem" 2>/dev/null || true

        chmod 600 "$CERT_DIR/live/${DOMAIN}-privkey.pem"
        chmod 644 "$CERT_DIR/live/${DOMAIN}-fullchain.pem"

        log "Certificates copied to $CERT_DIR/live/"
    fi
}

# Revoke certificate
cmd_revoke() {
    check_certbot
    check_domain

    warn "This will revoke the certificate for $DOMAIN"
    read -r -p "Are you sure? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log "Revocation cancelled"
        exit 0
    fi

    certbot revoke \
        --cert-name "$DOMAIN" \
        --non-interactive

    log "Certificate revoked for $DOMAIN"
}

# Interactive setup
cmd_setup() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           MyApi SSL/TLS Setup Wizard                     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    if [[ -z "$DOMAIN" ]]; then
        read -r -p "Enter your domain (e.g., api.example.com): " DOMAIN
    fi

    echo ""
    echo "Select certificate type:"
    echo "  1) Let's Encrypt (HTTP-01 challenge) - requires port 80"
    echo "  2) Let's Encrypt (Cloudflare DNS) - supports wildcards"
    echo "  3) Self-signed (development only)"
    echo ""
    read -r -p "Choice [1-3]: " choice

    case "$choice" in
        1)
            read -r -p "Enter email for Let's Encrypt: " EMAIL
            cmd_letsencrypt
            ;;
        2)
            read -r -p "Enter email for Let's Encrypt: " EMAIL
            if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
                read -r -p "Enter Cloudflare API token: " CLOUDFLARE_API_TOKEN
                export CLOUDFLARE_API_TOKEN
            fi
            cmd_cloudflare
            ;;
        3) cmd_self_signed ;;
        *) error "Invalid choice"; exit 1 ;;
    esac

    echo ""
    log "SSL setup complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Update your .env file:"
    echo "     SSL_ENABLED=true"
    echo "     SSL_DOMAIN=$DOMAIN"
    echo "  2. Restart the server: npm start"
    echo ""
}

# Main
case "${COMMAND}" in
    setup) cmd_setup ;;
    letsencrypt) cmd_letsencrypt ;;
    cloudflare) cmd_cloudflare ;;
    self-signed) cmd_self_signed ;;
    renew) cmd_renew ;;
    status) cmd_status ;;
    revoke) cmd_revoke ;;
    -h|--help) usage ;;
    "") usage; exit 1 ;;
    *) error "Unknown command: $COMMAND"; usage; exit 1 ;;
esac
