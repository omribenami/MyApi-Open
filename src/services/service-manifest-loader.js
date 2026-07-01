const fs = require('fs');
const path = require('path');
const { db, getServiceByName } = require('../database');

function safeJson(value, fallback = null) {
  if (value == null) return fallback;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function titleizeCategory(name) {
  return String(name || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ensureCategory(categoryName) {
  const normalized = String(categoryName || '').trim().toLowerCase();
  if (!normalized) {
    throw new Error('service.category is required');
  }

  const existing = db.prepare('SELECT id FROM service_categories WHERE name = ?').get(normalized);
  if (existing?.id) return existing.id;

  const now = new Date().toISOString();
  const label = titleizeCategory(normalized);
  const info = db.prepare(`
    INSERT INTO service_categories (name, label, icon, description, color, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(normalized, label, null, `${label} services`, '#64748B', now);
  return info.lastInsertRowid;
}

function upsertService(serviceManifest) {
  const service = serviceManifest?.service || serviceManifest;
  if (!service || typeof service !== 'object') {
    throw new Error('Manifest must include a service object');
  }

  const name = String(service.name || '').trim().toLowerCase();
  if (!name) throw new Error('service.name is required');

  const categoryId = ensureCategory(service.category);
  const label = String(service.label || name);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO services (name, label, category_id, icon, description, auth_type, api_endpoint, documentation_url, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      label = excluded.label,
      category_id = excluded.category_id,
      icon = excluded.icon,
      description = excluded.description,
      auth_type = excluded.auth_type,
      api_endpoint = excluded.api_endpoint,
      documentation_url = excluded.documentation_url,
      active = excluded.active
  `).run(
    name,
    label,
    categoryId,
    service.icon || null,
    service.description || null,
    service.auth_type || 'oauth2',
    service.api_endpoint || null,
    service.documentation_url || null,
    service.active === false ? 0 : 1,
    now,
  );

  const row = getServiceByName(name);
  if (!row?.id) {
    throw new Error(`Failed to upsert service '${name}'`);
  }
  return row;
}

function upsertMethods(serviceId, methods = []) {
  const stmt = db.prepare(`
    INSERT INTO service_api_methods (service_id, method_name, http_method, endpoint, description, parameters, response_example, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(service_id, method_name) DO UPDATE SET
      http_method = excluded.http_method,
      endpoint = excluded.endpoint,
      description = excluded.description,
      parameters = excluded.parameters,
      response_example = excluded.response_example
  `);

  const now = new Date().toISOString();
  let imported = 0;
  for (const method of methods) {
    const methodName = String(method.method_name || method.name || '').trim();
    if (!methodName) {
      throw new Error('Each method requires method_name or name');
    }
    stmt.run(
      serviceId,
      methodName,
      String(method.http_method || method.method || 'GET').toUpperCase(),
      method.endpoint,
      method.description || null,
      safeJson(method.parameters, []),
      safeJson(method.response_example ?? method.returns_example, null),
      now,
    );
    imported += 1;
  }
  return imported;
}

function upsertServiceManifest(manifest) {
  const serviceRow = upsertService(manifest);
  const methodsImported = upsertMethods(serviceRow.id, manifest.methods || []);
  return {
    service: serviceRow.name,
    serviceId: serviceRow.id,
    methodsImported,
  };
}

function importManifestFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const manifest = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return {
    file: absolutePath,
    ...upsertServiceManifest(manifest),
  };
}

function importManifestDirectory(dirPath) {
  const absoluteDir = path.resolve(dirPath);
  const files = fs.readdirSync(absoluteDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort();

  return files.map((file) => importManifestFile(path.join(absoluteDir, file)));
}

module.exports = {
  ensureCategory,
  upsertServiceManifest,
  importManifestFile,
  importManifestDirectory,
};
