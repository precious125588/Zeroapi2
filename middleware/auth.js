require('dotenv').config();
const { getKey, incrementUsage } = require('../utils/keyStore');
const { validateSession } = require('../utils/userStore');
const { endpoints, security, logs } = require('../utils/adminStore');
const logger = require('../utils/logger');
const config = require('../config');

const PUBLIC_PATHS = new Set(['/', '/docs', '/login', '/register', '/api/health', '/api/status']);
const PUBLIC_PREFIXES = ['/admin', '/auth/', '/api/apk/search', '/api/apk/info', '/api/apk/versions', '/api/anime/search', '/api/anime/info'];

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}
function extractPlatform(path) {
  const m = path.match(/^\/api\/([a-z]+)/);
  return m ? m[1] : null;
}

function authMiddleware(req, res, next) {
  const path = req.path;
  const start = Date.now();
  const platform = extractPlatform(path);
  const ip = clientIp(req);

  // Hook response to log every request
  const origJson = res.json.bind(res);
  res.json = function(body) {
    try {
      logs.add({ method: req.method, path, status: res.statusCode, ms: Date.now()-start, platform, apiKey: req.apiKey?.key||null, ip, error: body?.error||null });
    } catch (_) {}
    return origJson(body);
  };

  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p)) || req.method === 'OPTIONS') return next();

  // IP block
  if (security.isBlocked(ip)) return res.status(403).json({ success:false, error:'Your IP is blocked. Contact support.', retry_after:0 });

  // Endpoint maintenance/disabled
  if (platform && !endpoints.isEnabled(platform)) {
    const s = endpoints.get(platform);
    return res.status(503).json({ success:false, error:`${platform} is ${s?.maintenance?'under maintenance':'disabled'}.`, retry_after:60 });
  }

  // Session token (from user login)
  const sessionToken = req.headers['x-session-token'];
  if (sessionToken) {
    const sess = validateSession(sessionToken);
    if (sess?.user?.api_key) {
      try {
        const k = getKey(sess.user.api_key);
        if (k?.active && !k.blacklisted) {
          if (k.request_limit !== null && k.requests_used >= k.request_limit) return res.status(429).json({ success:false, error:`Daily limit reached (${k.request_limit}). Resets each day.`, retry_after:3600 });
          req.apiKey = k;
          req.sessionUser = sess.user;
          incrementUsage(k.key);
          return next();
        }
      } catch (_) {}
    }
  }

  // API key header/query
  const apiKey = (req.headers['x-api-key'] || req.query.apikey || '').trim();
  if (!apiKey) return res.status(401).json({ success:false, error:'API key required. Get one at /register', retry_after:0 });

  let record;
  try { record = getKey(apiKey); } catch (_) { return res.status(500).json({ success:false, error:'Auth error', retry_after:5 }); }
  if (!record)            return res.status(401).json({ success:false, error:'Invalid API key', retry_after:0 });
  if (!record.active)     return res.status(403).json({ success:false, error:'API key disabled', retry_after:0 });
  if (record.blacklisted) return res.status(403).json({ success:false, error:'API key blacklisted', retry_after:0 });
  if (record.request_limit !== null && record.requests_used >= record.request_limit) return res.status(429).json({ success:false, error:`Limit reached (${record.request_limit}/day)`, retry_after:3600 });

  req.apiKey = record;
  incrementUsage(apiKey);
  next();
}
module.exports = authMiddleware;
