-- Migration: Seed scope_definitions with all required guest token scopes
-- Created: 2026-04-12
-- Ensures scope validation doesn't reject valid scope names

INSERT OR IGNORE INTO scope_definitions (scope_name, description, category, created_at)
VALUES
  ('basic',          'Name, role, company',                          'profile',  datetime('now')),
  ('professional',   'Skills, education, experience',                'profile',  datetime('now')),
  ('availability',   'Calendar, timezone',                           'profile',  datetime('now')),
  ('personas',       'Public persona profiles',                      'personas', datetime('now')),
  ('knowledge',      'Knowledge base read access',                   'brain',    datetime('now')),
  ('chat',           'Conversation and messaging',                   'brain',    datetime('now')),
  ('memory',         'Read and write memory entries',                'brain',    datetime('now')),
  ('skills:read',    'Read skills and metadata',                     'skills',   datetime('now')),
  ('skills:write',   'Create and manage skills',                     'skills',   datetime('now')),
  ('services:read',  'Proxy GET requests to OAuth services',         'services', datetime('now')),
  ('services:write', 'Proxy POST/PUT/DELETE to OAuth services',      'services', datetime('now')),
  ('admin:*',        'Full admin access',                            'admin',    datetime('now'));
