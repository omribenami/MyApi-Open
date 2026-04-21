const http = require('http');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DATACENTER_RE = /amazon|aws|google|microsoft|azure|digitalocean|linode|vultr|hetzner|ovh|cloudflare|fastly|akamai|rackspace|packet|equinix|leaseweb|serverius|choopa|quadranet|psychz|colocrossing/i;
const VPN_RE = /nordvpn|expressvpn|surfshark|protonvpn|mullvad|ipvanish|cyberghost|privateinternetaccess|hidemyass|torguard|windscribe|purevpn/i;
const RESIDENTIAL_RE = /comcast|spectrum|verizon|at&t|t-mobile|orange|deutsche telekom|bt group|sky|virgin|cox|charter|centurylink|frontier|consolidated|windstream/i;

function classifyOrg(org, isHosting) {
  if (!org) return 'unknown';
  if (isHosting) return 'datacenter';
  if (DATACENTER_RE.test(org)) return 'datacenter';
  if (VPN_RE.test(org)) return 'vpn';
  if (/\btor\b|exit node/i.test(org)) return 'tor';
  if (RESIDENTIAL_RE.test(org)) return 'residential';
  return 'unknown';
}

function getIpPrefix(ip) {
  if (!ip || ip === 'unknown') return null;
  // Skip private/loopback addresses
  if (ip === '::1' || ip === '127.0.0.1') return null;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return null;

  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return v4[1];
  const v6 = ip.match(/^([0-9a-f]+:[0-9a-f]+:[0-9a-f]+):/i);
  if (v6) return v6[1].toLowerCase();
  return ip.slice(0, 20);
}

async function lookupASN(ip) {
  const prefix = getIpPrefix(ip);
  if (!prefix) return { asn: 'private', asnOrg: 'Private/Local', orgType: 'private' };

  let db;
  try { db = getDatabase(); } catch (_) {
    return { asn: 'unknown', asnOrg: 'Unknown', orgType: 'unknown' };
  }

  // Check cache
  try {
    const now = new Date().toISOString();
    const cached = db.prepare('SELECT asn, asn_org, org_type FROM asn_cache WHERE ip_prefix = ? AND expires_at > ?').get(prefix, now);
    if (cached) return { asn: cached.asn, asnOrg: cached.asn_org, orgType: cached.org_type };
  } catch (_) {}

  return new Promise((resolve) => {
    const req = http.get(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,org,as,hosting`,
      { timeout: 3000 },
      (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.status !== 'success') {
              resolve({ asn: 'unknown', asnOrg: 'Unknown', orgType: 'unknown' });
              return;
            }
            const orgType = classifyOrg(parsed.org, parsed.hosting);
            const result = { asn: parsed.as || 'unknown', asnOrg: parsed.org || 'Unknown', orgType };
            try {
              const now = new Date();
              const expires = new Date(now.getTime() + CACHE_TTL_MS).toISOString();
              db.prepare(`INSERT OR REPLACE INTO asn_cache (ip_prefix, asn, asn_org, org_type, cached_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
                .run(prefix, result.asn, result.asnOrg, result.orgType, now.toISOString(), expires);
            } catch (_) {}
            resolve(result);
          } catch (_) {
            resolve({ asn: 'unknown', asnOrg: 'Unknown', orgType: 'unknown' });
          }
        });
      }
    );
    req.on('error', () => resolve({ asn: 'unknown', asnOrg: 'Unknown', orgType: 'unknown' }));
    req.on('timeout', () => { req.destroy(); resolve({ asn: 'unknown', asnOrg: 'Unknown', orgType: 'unknown' }); });
  });
}

module.exports = { lookupASN };
