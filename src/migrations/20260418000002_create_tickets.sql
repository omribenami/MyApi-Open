CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  date INTEGER,
  complainer TEXT,
  complaint TEXT,
  repro_steps TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'inprogress', 'closed')),
  fix_commit TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('discord', 'manual', 'api')),
  source_message_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
