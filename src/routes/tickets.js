const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queueEmail, getTokenScopes } = require('../database');

const ALLOWED_FIELDS = ['date', 'complainer', 'complaint', 'repro_steps', 'status', 'fix_commit', 'source', 'source_message_id'];
const VALID_STATUSES = ['open', 'inprogress', 'closed'];
const VALID_SOURCES = ['discord', 'manual', 'api'];

const STATUS_LABELS = { open: 'Open', inprogress: 'In Progress', closed: 'Closed' };

function notifyAdmin(db, subject, htmlBody) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return;
  try {
    const user = db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').get(to);
    if (!user) return;
    queueEmail(user.id, to, subject, htmlBody, { htmlBody });
  } catch (err) {
    console.error('[tickets] notifyAdmin failed:', err.message);
  }
}

const STATUS_COLORS = { open: '#f59e0b', inprogress: '#3b82f6', closed: '#10b981' };
const STATUS_BG = { open: '#1c1407', inprogress: '#0d1f3c', closed: '#061c12' };

function ticketHtml(ticket, heading) {
  const base = process.env.PUBLIC_URL || 'https://www.myapiai.com';
  const ticketUrl = `${base}/dashboard/tickets`;
  const statusColor = STATUS_COLORS[ticket.status] || '#94a3b8';
  const statusBg = STATUS_BG[ticket.status] || '#1e293b';
  const statusLabel = STATUS_LABELS[ticket.status] || ticket.status;

  const fields = [
    ['Ticket ID', `<span style="font-family:monospace;font-size:12px;color:#94a3b8;">${ticket.id}</span>`],
    ['Complainer', ticket.complainer || '<span style="color:#475569;">—</span>'],
    ['Source', ticket.source],
    ticket.repro_steps ? ['Repro Steps', ticket.repro_steps] : null,
    ticket.fix_commit ? ['Fix Commit', `<code style="font-family:monospace;font-size:12px;background:#1e293b;padding:2px 6px;border-radius:4px;color:#93c5fd;">${ticket.fix_commit}</code>`] : null,
  ].filter(Boolean);

  const fieldRows = fields.map(([k, v]) => `
    <tr>
      <td style="padding:10px 16px 10px 0;font-size:13px;font-weight:600;color:#64748b;white-space:nowrap;vertical-align:top;width:110px;">${k}</td>
      <td style="padding:10px 0;font-size:13px;color:#cbd5e1;vertical-align:top;">${v}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#060d1a;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border:1px solid #312e81;border-radius:16px 16px 0 0;padding:28px 36px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="font-size:20px;font-weight:800;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;color:#60a5fa;">MyApi</span>
            </td>
            <td align="right">
              <span style="display:inline-block;background:${statusBg};border:1px solid ${statusColor};color:${statusColor};font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">${statusLabel}</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Title -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:28px 36px 0;">
        <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#f1f5f9;line-height:1.3;">${heading}</h1>
        <p style="margin:0;font-size:13px;color:#475569;">Ticket · ${new Date().toUTCString()}</p>
      </td></tr>

      <!-- Complaint -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:20px 36px;">
        <div style="background:#1e293b;border:1px solid #334155;border-left:3px solid #6366f1;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.8px;">Complaint</p>
          <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6;">${ticket.complaint}</p>
        </div>
      </td></tr>

      <!-- Fields -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;padding:8px 36px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          ${fieldRows}
        </table>
      </td></tr>

      <!-- CTA -->
      <tr><td style="background:#0f172a;border-left:1px solid #1e293b;border-right:1px solid #1e293b;border-top:1px solid #1e293b;padding:20px 36px 28px;">
        <table role="presentation" cellspacing="0" cellpadding="0">
          <tr><td>
            <a href="${ticketUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;letter-spacing:0.2px;">View Tickets →</a>
          </td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0a1120;border:1px solid #1e293b;border-top:none;border-radius:0 0 16px 16px;padding:18px 36px;">
        <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;text-align:center;">
          <a href="${base}" style="color:#3b82f6;text-decoration:none;">myapiai.com</a>
          &nbsp;·&nbsp;
          <a href="${ticketUrl}" style="color:#3b82f6;text-decoration:none;">Tickets Dashboard</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function createTicketsRoutes({ db, requirePowerUser, isMaster }) {
  const router = express.Router();

  function hasTicketScope(req, write = false) {
    const tokenId = req.tokenMeta?.tokenId;
    if (!tokenId) return false;
    const scopes = getTokenScopes(tokenId);
    return scopes.includes('admin:*') ||
      (write ? scopes.includes('tickets:write') : scopes.includes('tickets:read') || scopes.includes('tickets:write'));
  }

  function guard(req, res, write = false) {
    if (isMaster(req)) return requirePowerUser(req, res);
    if (hasTicketScope(req, write)) return true;
    res.status(403).json({ error: write ? 'tickets:write scope required' : 'tickets:read scope required' });
    return false;
  }

  // GET /api/v1/tickets
  router.get('/', (req, res) => {
    if (!guard(req, res, false)) return;
    const { status, source, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (source) { sql += ' AND source = ?'; params.push(source); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(parseInt(limit, 10) || 100, 500), parseInt(offset, 10) || 0);
    try {
      const rows = db.prepare(sql).all(...params);
      res.json({ data: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/v1/tickets/:id
  router.get('/:id', (req, res) => {
    if (!guard(req, res, false)) return;
    try {
      const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ data: row });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/tickets
  router.post('/', (req, res) => {
    if (!guard(req, res, true)) return;
    const { complaint, complainer, date, repro_steps, status = 'open', fix_commit, source = 'manual', source_message_id } = req.body || {};
    if (!complaint) return res.status(400).json({ error: 'complaint is required' });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    if (source && !VALID_SOURCES.includes(source)) return res.status(400).json({ error: `source must be one of: ${VALID_SOURCES.join(', ')}` });
    const now = Math.floor(Date.now() / 1000);
    const id = uuidv4();
    try {
      db.prepare(`
        INSERT INTO tickets (id, created_at, updated_at, date, complainer, complaint, repro_steps, status, fix_commit, source, source_message_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, now, now, date || null, complainer || null, complaint, repro_steps || null, status, fix_commit || null, source, source_message_id || null);
      const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
      notifyAdmin(
        db,
        `[MyApi] New ticket from ${row.complainer || row.source}`,
        ticketHtml(row, 'New Ticket Created')
      );
      res.status(201).json({ data: row });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/v1/tickets/:id
  router.put('/:id', (req, res) => {
    if (!guard(req, res, true)) return;
    const existing = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });
    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in (req.body || {})) updates[key] = req.body[key];
    }
    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    if (updates.source && !VALID_SOURCES.includes(updates.source)) {
      return res.status(400).json({ error: `source must be one of: ${VALID_SOURCES.join(', ')}` });
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    updates.updated_at = Math.floor(Date.now() / 1000);
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    try {
      db.prepare(`UPDATE tickets SET ${setClauses} WHERE id = ?`).run(...values);
      const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
      if (updates.status && updates.status !== existing.status) {
        notifyAdmin(
          db,
          `[MyApi] Ticket status changed → ${STATUS_LABELS[updates.status] || updates.status}`,
          ticketHtml(row, `Ticket Status Changed: ${STATUS_LABELS[existing.status] || existing.status} → ${STATUS_LABELS[updates.status] || updates.status}`)
        );
      }
      res.json({ data: row });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/v1/tickets/:id
  router.delete('/:id', (req, res) => {
    if (!guard(req, res, true)) return;
    try {
      const result = db.prepare('DELETE FROM tickets WHERE id = ?').run(req.params.id);
      if (result.changes === 0) return res.status(404).json({ error: 'Ticket not found' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createTicketsRoutes;
