const crypto = require('crypto');
const { getDb } = require('./db');
const { createKey, updateKey } = require('./keyStore');
const logger = require('./logger');
const config = require('../config');

function hashPassword(password, salt) {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

/* ── Email OTP ─────────────────────────────────────────── */
async function sendOtp(email, purpose = 'register') {
  const db = getDb();
  const code = genCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  // Invalidate old codes
  db.prepare(`UPDATE verification_codes SET used=1 WHERE email=? AND purpose=? AND used=0`).run(email, purpose);
  db.prepare(`INSERT INTO verification_codes (email,code,purpose,expires_at) VALUES (?,?,?,?)`).run(email, code, purpose, expires);

  // Try send via SMTP if configured
  if (config.smtp.host && config.smtp.user) {
    try {
      const nodemailer = require('nodemailer');
      const t = nodemailer.createTransport({
        host: config.smtp.host, port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      });
      await t.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Zero API — Verification Code',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0d0d12;color:#f1f5f9;padding:32px;border-radius:12px">
          <h2 style="color:#8b5cf6">⚡ Zero API</h2>
          <p>Your verification code:</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#22d3ee;padding:20px 0">${code}</div>
          <p style="color:#64748b">Expires in 15 minutes. Do not share this code.</p>
        </div>`,
      });
      logger.success(`[otp] Sent to ${email}`);
      return { sent: true, dev_code: null };
    } catch (err) {
      logger.warn(`[otp] SMTP failed: ${err.message} — using dev mode`);
    }
  }
  // Dev mode — log code and return it
  logger.warn(`[otp] DEV MODE — code for ${email}: ${code}`);
  return { sent: false, dev_code: code };
}

function verifyOtp(email, code, purpose = 'register') {
  const db = getDb();
  const rec = db.prepare(`SELECT * FROM verification_codes WHERE email=? AND purpose=? AND used=0 ORDER BY id DESC LIMIT 1`).get(email, purpose);
  if (!rec) return { ok: false, error: 'No verification code found. Request a new one.' };
  if (rec.code !== String(code)) return { ok: false, error: 'Wrong verification code.' };
  if (new Date(rec.expires_at) < new Date()) return { ok: false, error: 'Code expired. Request a new one.' };
  db.prepare(`UPDATE verification_codes SET used=1 WHERE id=?`).run(rec.id);
  return { ok: true };
}

/* ── Register ─────────────────────────────────────────── */
function registerUser({ name, email, password, ip }) {
  const db = getDb();
  if (db.prepare(`SELECT id FROM users WHERE email=?`).get(email)) {
    throw new Error('Email already registered.');
  }
  const salt = genSalt();
  const hash = hashPassword(password, salt);
  const key = createKey({ name: `${name}'s Key`, role: 'user', limit: config.dailyLimit });

  // Check for IP conflicts — notify admin only (no auto-flag)
  const ipConflicts = db.prepare(`SELECT id,email FROM users WHERE primary_ip=? OR last_ip=?`).all(ip, ip);
  if (ipConflicts.length > 0) {
    const others = ipConflicts.map(u => u.email).join(', ');
    db.prepare(`INSERT INTO notifications (level,message) VALUES ('warn',?)`)
      .run(`⚠ New registration from IP ${ip} (${email}) — same IP already used by: ${others}. Review manually.`);
    logger.warn(`[auth] IP conflict on register: ${ip} — also used by ${others}`);
  }

  const result = db.prepare(
    `INSERT INTO users (name,email,password_hash,salt,api_key,primary_ip,last_ip,email_verified) VALUES (?,?,?,?,?,?,?,1)`
  ).run(name.trim(), email.toLowerCase().trim(), hash, salt, key.key, ip, ip);

  // Link API key to user
  db.prepare(`UPDATE api_keys SET owner_id=? WHERE key=?`).run(result.lastInsertRowid, key.key);
  // Notify admin of new user
  db.prepare(`INSERT INTO notifications (level,message) VALUES ('info',?)`)
    .run(`🆕 New user registered: ${name} (${email}) — IP: ${ip} — Key: ${key.key}`);

  return { user: getUser(result.lastInsertRowid), api_key: key };
}

/* ── Login ────────────────────────────────────────────── */
function loginUser({ email, password, ip }) {
  const db = getDb();
  const user = db.prepare(`SELECT * FROM users WHERE email=?`).get(email.toLowerCase().trim());
  if (!user) throw new Error('Email not found.');
  if (hashPassword(password, user.salt) !== user.password_hash) throw new Error('Wrong password.');
  if (user.banned) throw new Error(`Account banned${user.ban_reason ? ': ' + user.ban_reason : ''}. Contact admin.`);

  // Update last IP
  db.prepare(`UPDATE users SET last_ip=? WHERE id=?`).run(ip, user.id);

  const token = genToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO user_sessions (token,user_id,ip,expires_at) VALUES (?,?,?,?)`).run(token, user.id, ip, expires);

  return { user, token, api_key: user.api_key };
}

/* ── Session ──────────────────────────────────────────── */
function validateSession(token) {
  const db = getDb();
  const sess = db.prepare(`SELECT s.*, u.* FROM user_sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))`).get(token);
  if (!sess || sess.banned) return null;
  return { user: sess, token };
}

function logoutSession(token) {
  getDb().prepare(`DELETE FROM user_sessions WHERE token=?`).run(token);
}

/* ── CRUD ─────────────────────────────────────────────── */
function getUser(id) { return getDb().prepare(`SELECT id,name,email,api_key,primary_ip,last_ip,banned,ban_reason,email_verified,created_at FROM users WHERE id=?`).get(id) || null; }
function getAllUsers() { return getDb().prepare(`SELECT id,name,email,api_key,primary_ip,last_ip,banned,ban_reason,email_verified,created_at FROM users ORDER BY id DESC`).all(); }
function getFlaggedUsers() {
  const db = getDb();
  // Users sharing IPs
  return db.prepare(`SELECT u1.id,u1.name,u1.email,u1.primary_ip,u1.banned FROM users u1 WHERE EXISTS (SELECT 1 FROM users u2 WHERE u2.id!=u1.id AND (u2.primary_ip=u1.primary_ip OR u2.last_ip=u1.last_ip))`).all();
}

function banUser(id, reason = '') {
  const db = getDb();
  db.prepare(`UPDATE users SET banned=1, ban_reason=? WHERE id=?`).run(reason, id);
  db.prepare(`DELETE FROM user_sessions WHERE user_id=?`).run(id);
  const u = db.prepare(`SELECT * FROM users WHERE id=?`).get(id);
  if (u?.api_key) db.prepare(`UPDATE api_keys SET active=0 WHERE key=?`).run(u.api_key);
  db.prepare(`INSERT INTO notifications (level,message) VALUES ('warn',?)`).run(`🚫 User banned: ${u?.email} — ${reason}`);
}

function unbanUser(id) {
  const db = getDb();
  const u = db.prepare(`SELECT * FROM users WHERE id=?`).get(id);
  db.prepare(`UPDATE users SET banned=0, ban_reason=NULL WHERE id=?`).run(id);
  if (u?.api_key) db.prepare(`UPDATE api_keys SET active=1 WHERE key=?`).run(u.api_key);
}

function resetUserLimit(id) {
  const db = getDb();
  const u = db.prepare(`SELECT api_key FROM users WHERE id=?`).get(id);
  if (u?.api_key) db.prepare(`UPDATE api_keys SET requests_used=0 WHERE key=?`).run(u.api_key);
}

module.exports = { sendOtp, verifyOtp, registerUser, loginUser, validateSession, logoutSession, getUser, getAllUsers, getFlaggedUsers, banUser, unbanUser, resetUserLimit };
