const crypto = require('crypto');
const { getDb } = require('./db');
const logger = require('./logger');
const config = require('../config');

function genKey(role = 'user') {
  const rand = crypto.randomBytes(12).toString('hex');
  return role === 'root' ? `ZERO-ROOT-${rand}` :
         role === 'admin' ? `ZERO-ADMIN-${rand}` : `ZERO-${rand}`;
}

function ensureAdminKey() {
  const db = getDb();
  const existing = db.prepare(`SELECT key FROM api_keys WHERE role IN ('admin','root') AND active=1 LIMIT 1`).get();
  if (existing) { logger.info(`[keys] Admin key: ${existing.key}`); return existing.key; }
  const key = config.adminKey || genKey('admin');
  db.prepare(`INSERT OR IGNORE INTO api_keys (key,name,role,request_limit,active) VALUES (?,?,?,NULL,1)`)
    .run(key, 'Administrator', 'admin');
  logger.success(`[keys] Admin key: ${key}`);
  return key;
}

function createKey({ name, role = 'user', limit = null, ownerId = null }) {
  const db = getDb();
  const key = genKey(role);
  db.prepare(`INSERT INTO api_keys (key,name,role,request_limit,active,owner_id) VALUES (?,?,?,?,1,?)`)
    .run(key, String(name).trim(), role, limit || null, ownerId || null);
  return getKey(key);
}

function getKey(key) { return getDb().prepare(`SELECT * FROM api_keys WHERE key=?`).get(key) || null; }
function getAllKeys() { return getDb().prepare(`SELECT * FROM api_keys ORDER BY created_at DESC`).all(); }

function incrementUsage(key) {
  getDb().prepare(`UPDATE api_keys SET requests_used=requests_used+1, last_used_at=CURRENT_TIMESTAMP WHERE key=?`).run(key);
}

function updateKey(key, { name, limit, active, role, blacklisted }) {
  const fields = [], vals = [];
  if (name       !== undefined) { fields.push('name=?');          vals.push(String(name).trim()); }
  if (limit      !== undefined) { fields.push('request_limit=?'); vals.push(limit===''||limit===null?null:Number(limit)); }
  if (active     !== undefined) { fields.push('active=?');        vals.push(active?1:0); }
  if (role       !== undefined) { fields.push('role=?');          vals.push(role); }
  if (blacklisted!== undefined) { fields.push('blacklisted=?');   vals.push(blacklisted?1:0); }
  if (!fields.length) return getKey(key);
  vals.push(key);
  getDb().prepare(`UPDATE api_keys SET ${fields.join(',')} WHERE key=?`).run(...vals);
  return getKey(key);
}

function deleteKey(key) {
  const r = getDb().prepare(`DELETE FROM api_keys WHERE key=?`).run(key);
  return r.changes > 0;
}

function getStats() {
  const db = getDb();
  const keys = db.prepare(`SELECT COUNT(*) as total, SUM(active) as active, SUM(CASE WHEN role='admin' OR role='root' THEN 1 ELSE 0 END) as admins, SUM(requests_used) as total_requests FROM api_keys`).get();
  return { total: keys.total||0, active: keys.active||0, admins: keys.admins||0, total_requests: keys.total_requests||0 };
}

module.exports = { ensureAdminKey, createKey, getKey, getAllKeys, incrementUsage, updateKey, deleteKey, getStats };
