const express = require('express');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_FIELDS = ['date', 'complainer', 'complaint', 'repro_steps', 'status', 'fix_commit', 'source', 'source_message_id'];
const VALID_STATUSES = ['open', 'inprogress', 'closed'];
const VALID_SOURCES = ['discord', 'manual', 'api'];

function createTicketsRoutes({ db, requirePowerUser, isMaster }) {
  const router = express.Router();

  function guard(req, res) {
    if (!isMaster(req)) {
      res.status(403).json({ error: 'Master token required' });
      return false;
    }
    return requirePowerUser(req, res);
  }

  // GET /api/v1/tickets
  router.get('/', (req, res) => {
    if (!guard(req, res)) return;
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
    if (!guard(req, res)) return;
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
    if (!guard(req, res)) return;
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
      res.status(201).json({ data: row });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/v1/tickets/:id
  router.put('/:id', (req, res) => {
    if (!guard(req, res)) return;
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
      res.json({ data: row });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/v1/tickets/:id
  router.delete('/:id', (req, res) => {
    if (!guard(req, res)) return;
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
