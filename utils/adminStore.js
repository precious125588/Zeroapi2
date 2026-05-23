const { getDb } = require('./db');
const cache = require('./cache');

const ALL_ENDPOINTS = ['tiktok','youtube','instagram','facebook','twitter','snapchat','pinterest',
  'spotify','reddit','threads','mediafire','gdrive','dropbox','mega','pixeldrain','streamtape','apk','adult','anime','movies'];

/* ── Notifications ──────────────────────────────────── */
const notifications = {
  add(level, message) {
    try { getDb().prepare(`INSERT INTO notifications (level,message) VALUES (?,?)`).run(level, message); } catch(_) {}
  },
  getAll(unreadOnly = false) {
    const q = unreadOnly ? `SELECT * FROM notifications WHERE read=0 ORDER BY id DESC LIMIT 100`
                         : `SELECT * FROM notifications ORDER BY id DESC LIMIT 200`;
    try { return getDb().prepare(q).all(); } catch(_) { return []; }
  },
  count() {
    try { return getDb().prepare(`SELECT COUNT(*) as c FROM notifications WHERE read=0`).get()?.c || 0; } catch(_) { return 0; }
  },
  markRead(id) {
    try {
      if (id === 'all') getDb().prepare(`UPDATE notifications SET read=1`).run();
      else getDb().prepare(`UPDATE notifications SET read=1 WHERE id=?`).run(id);
    } catch(_) {}
  },
};

/* ── Request Logs ───────────────────────────────────── */
const logs = {
  add(entry) {
    try {
      getDb().prepare(`INSERT INTO request_logs (method,path,status,ms,platform,api_key,ip,error) VALUES (?,?,?,?,?,?,?,?)`)
        .run(entry.method,entry.path,entry.status,entry.ms,entry.platform||null,entry.apiKey||null,entry.ip||null,entry.error||null);
      // Prune old logs (keep last 5000)
      getDb().prepare(`DELETE FROM request_logs WHERE id NOT IN (SELECT id FROM request_logs ORDER BY id DESC LIMIT 5000)`).run();
    } catch(_) {}
  },
  get({ limit=100, offset=0, status, platform, error_only } = {}) {
    let q = `SELECT * FROM request_logs WHERE 1=1`;
    const p = [];
    if (status)    { q += ` AND status=?`; p.push(status); }
    if (platform)  { q += ` AND platform=?`; p.push(platform); }
    if (error_only){ q += ` AND error IS NOT NULL`; }
    q += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    p.push(limit, offset);
    try { return getDb().prepare(q).all(...p); } catch(_) { return []; }
  },
  clear() { try { getDb().prepare(`DELETE FROM request_logs`).run(); } catch(_) {} },
};

/* ── Analytics ──────────────────────────────────────── */
const analytics = {
  summary() {
    try {
      const db = getDb();
      const total   = db.prepare(`SELECT COUNT(*) as c FROM request_logs`).get()?.c || 0;
      const success = db.prepare(`SELECT COUNT(*) as c FROM request_logs WHERE status < 400`).get()?.c || 0;
      const errors  = db.prepare(`SELECT COUNT(*) as c FROM request_logs WHERE status >= 400`).get()?.c || 0;
      const avgMs   = db.prepare(`SELECT AVG(ms) as a FROM request_logs WHERE ms IS NOT NULL`).get()?.a || 0;
      const last24h = db.prepare(`SELECT COUNT(*) as c FROM request_logs WHERE created_at > datetime('now','-1 day')`).get()?.c || 0;
      const topPlatforms = db.prepare(`SELECT platform, COUNT(*) as count FROM request_logs WHERE platform IS NOT NULL GROUP BY platform ORDER BY count DESC LIMIT 10`).all();
      return {
        total_requests: total,
        success_count: success,
        error_count: errors,
        success_rate: total ? Math.round(success/total*100)+'%' : '0%',
        avg_response_ms: Math.round(avgMs),
        requests_last_24h: last24h,
        top_platforms: topPlatforms,
      };
    } catch(_) { return { total_requests:0, success_count:0, error_count:0, success_rate:'0%', avg_response_ms:0, requests_last_24h:0, top_platforms:[] }; }
  },
};

/* ── Endpoints ──────────────────────────────────────── */
const _epState = {};
ALL_ENDPOINTS.forEach(ep => { _epState[ep] = { enabled:true, maintenance:false }; });
const endpoints = {
  getAll: () => ({..._epState}),
  get: p => _epState[p] || { enabled:true, maintenance:false },
  isEnabled: p => { const s=_epState[p]; return s ? s.enabled && !s.maintenance : true; },
  setEnabled: (p,v) => { if(_epState[p]) _epState[p].enabled = !!v; },
  setMaintenance: (p,v) => { if(_epState[p]) _epState[p].maintenance = !!v; },
};

/* ── Providers ──────────────────────────────────────── */
const _providers = {
  tiktok:    { tikwm:{enabled:true,priority:1}, cobalt:{enabled:true,priority:2}, musicaldown:{enabled:true,priority:3} },
  youtube:   { 'play-dl':{enabled:true,priority:1}, ytdlcore:{enabled:true,priority:2}, 'yt-dlp':{enabled:true,priority:3} },
  instagram: { saveinsta:{enabled:true,priority:1}, cobalt:{enabled:true,priority:2} },
  movies:    { consumet:{enabled:true,priority:1}, vidsrc:{enabled:true,priority:2}, embed:{enabled:true,priority:3} },
  anime:     { consumet:{enabled:true,priority:1}, gogoanime:{enabled:true,priority:2} },
};
const providers = {
  getAll: () => ({..._providers}),
  get: p => _providers[p] || {},
  setEnabled: (pl,prov,v) => { if(_providers[pl]?.[prov]) _providers[pl][prov].enabled = !!v; },
  setPriority: (pl,prov,n) => { if(_providers[pl]?.[prov]) _providers[pl][prov].priority = n; },
};

/* ── Security ───────────────────────────────────────── */
const security = {
  isBlocked(ip) { try { return !!getDb().prepare(`SELECT 1 FROM blocked_ips WHERE ip=?`).get(ip); } catch(_) { return false; } },
  block(ip, reason='') { try { getDb().prepare(`INSERT OR REPLACE INTO blocked_ips (ip,reason) VALUES (?,?)`).run(ip,reason); } catch(_) {} },
  unblock(ip) { try { const r=getDb().prepare(`DELETE FROM blocked_ips WHERE ip=?`).run(ip); return r.changes>0; } catch(_) { return false; } },
  getBlocked() { try { return getDb().prepare(`SELECT * FROM blocked_ips ORDER BY created_at DESC`).all(); } catch(_) { return []; } },
  getAbuse(threshold=100) {
    try {
      return getDb().prepare(`SELECT ip, COUNT(*) as count FROM request_logs WHERE created_at > datetime('now','-1 hour') AND ip IS NOT NULL GROUP BY ip HAVING count >= ? ORDER BY count DESC LIMIT 20`).all(threshold);
    } catch(_) { return []; }
  },
};

/* ── Cache control ──────────────────────────────────── */
const cacheCtrl = {
  getStats() { try { return cache.stats(); } catch(_) { return {}; } },
  clear() { cache.flush(); notifications.add('info','🗄 Cache cleared by admin'); },
};

module.exports = { ALL_ENDPOINTS, notifications, logs, analytics, endpoints, providers, security, cacheCtrl };
