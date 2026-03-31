/**
 * Google service proxy routes
 * Proxies Gmail (and future Google) API calls using the stored OAuth token.
 */
const express = require('express');
const https = require('https');
const { getOAuthToken, isTokenExpired, refreshOAuthToken } = require('../database');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function createGoogleRoutes() {
  const router = express.Router();

  // ── helpers ──────────────────────────────────────────────────────────────────

  function resolveUserId(req) {
    return String(
      req.session?.user?.id ||
      req.user?.id ||
      req.tokenMeta?.ownerId ||
      req.tokenMeta?.userId ||
      'owner'
    );
  }

  async function getGoogleAccessToken(userId) {
    const token = getOAuthToken('google', userId);
    if (!token || token.revokedAt) throw Object.assign(new Error('Google not connected'), { status: 401 });

    if (isTokenExpired(token)) {
      if (!token.refreshToken) throw Object.assign(new Error('Google token expired and no refresh token'), { status: 401 });
      const result = await refreshOAuthToken(
        'google', userId, GOOGLE_TOKEN_URL,
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET
      );
      if (!result?.ok) throw Object.assign(new Error('Failed to refresh Google token'), { status: 401 });
      return result.token.accessToken;
    }

    return token.accessToken;
  }

  function googleGet(path, accessToken) {
    return new Promise((resolve, reject) => {
      const url = new URL(path.startsWith('https://') ? path : `https://gmail.googleapis.com${path}`);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 400) return reject(Object.assign(new Error(parsed?.error?.message || 'Google API error'), { status: res.statusCode, googleError: parsed?.error }));
            resolve(parsed);
          } catch {
            reject(Object.assign(new Error('Invalid JSON from Google'), { status: 502 }));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  // ── Gmail routes ──────────────────────────────────────────────────────────────

  // GET /api/v1/google/gmail/messages
  // Query params: limit (default 10), q (Gmail search query), pageToken
  router.get('/gmail/messages', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const accessToken = await getGoogleAccessToken(userId);

      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const q = req.query.q || '';
      const pageToken = req.query.pageToken || '';

      const listUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      listUrl.searchParams.set('maxResults', String(limit));
      if (q) listUrl.searchParams.set('q', q);
      if (pageToken) listUrl.searchParams.set('pageToken', pageToken);

      const listResult = await googleGet(listUrl.toString(), accessToken);
      const messageIds = (listResult.messages || []).map((m) => m.id);

      if (messageIds.length === 0) {
        return res.json({ success: true, data: { messages: [], nextPageToken: null, resultSizeEstimate: 0 } });
      }

      // Fetch metadata for each message in parallel
      const messages = await Promise.all(
        messageIds.map(async (id) => {
          try {
            const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`;
            const msg = await googleGet(msgUrl, accessToken);

            const headers = {};
            for (const h of msg.payload?.headers || []) {
              headers[h.name.toLowerCase()] = h.value;
            }

            return {
              id: msg.id,
              threadId: msg.threadId,
              subject: headers.subject || '(no subject)',
              from: headers.from || '',
              to: headers.to || '',
              date: headers.date || '',
              snippet: msg.snippet || '',
              labelIds: msg.labelIds || [],
            };
          } catch {
            return { id, error: 'Failed to fetch message details' };
          }
        })
      );

      res.json({
        success: true,
        data: {
          messages,
          nextPageToken: listResult.nextPageToken || null,
          resultSizeEstimate: listResult.resultSizeEstimate || messages.length,
        },
      });
    } catch (err) {
      const status = err.status || 500;
      console.error('[Google/Gmail] listMessages error:', err.message);
      res.status(status).json({ error: err.message, ...(err.googleError ? { googleError: err.googleError } : {}) });
    }
  });

  // GET /api/v1/google/gmail/messages/:id
  // Returns full message body (plain text preferred, falls back to HTML stripped)
  router.get('/gmail/messages/:id', async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const accessToken = await getGoogleAccessToken(userId);
      const { id } = req.params;

      const msg = await googleGet(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        accessToken
      );

      const headers = {};
      for (const h of msg.payload?.headers || []) {
        headers[h.name.toLowerCase()] = h.value;
      }

      // Extract body text
      function extractBody(payload) {
        if (!payload) return '';
        if (payload.body?.data) {
          return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        if (payload.parts) {
          // Prefer text/plain
          const plain = payload.parts.find((p) => p.mimeType === 'text/plain');
          if (plain?.body?.data) return Buffer.from(plain.body.data, 'base64').toString('utf-8');
          // Fall back to HTML (basic strip)
          const html = payload.parts.find((p) => p.mimeType === 'text/html');
          if (html?.body?.data) {
            const raw = Buffer.from(html.body.data, 'base64').toString('utf-8');
            return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
          // Recurse into multipart parts
          for (const part of payload.parts) {
            const body = extractBody(part);
            if (body) return body;
          }
        }
        return '';
      }

      res.json({
        success: true,
        data: {
          id: msg.id,
          threadId: msg.threadId,
          subject: headers.subject || '(no subject)',
          from: headers.from || '',
          to: headers.to || '',
          date: headers.date || '',
          snippet: msg.snippet || '',
          body: extractBody(msg.payload),
          labelIds: msg.labelIds || [],
        },
      });
    } catch (err) {
      const status = err.status || 500;
      console.error('[Google/Gmail] getMessage error:', err.message);
      res.status(status).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createGoogleRoutes;
