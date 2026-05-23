require('dotenv').config();
process.on('uncaughtException',  e => console.error('[FATAL]', e.message));
process.on('unhandledRejection', r => console.error('[UNHANDLED]', r));

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const logger  = require('./utils/logger');
const cache   = require('./utils/cache');
const config  = require('./config');

// Bootstrap DB + admin key
let adminKey = null;
try { adminKey = require('./utils/keyStore').ensureAdminKey(); } catch(e) { logger.error(`DB init: ${e.message}`); }

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'views')));

// Auth middleware
if (adminKey) app.use(require('./middleware/auth'));

function safeRoute(p) {
  try { return require(p); }
  catch(e) { logger.error(`Route load failed: ${p}: ${e.message}`); const r=express.Router(); r.all('*',(_,s)=>s.status(503).json({success:false,error:'Route unavailable'})); return r; }
}

app.use('/auth',          safeRoute('./routes/auth'));
app.use('/admin/api',     safeRoute('./routes/admin'));
app.use('/api/tiktok',    safeRoute('./routes/tiktok'));
app.use('/api/youtube',   safeRoute('./routes/youtube'));
app.use('/api/instagram', safeRoute('./routes/instagram'));
app.use('/api/facebook',  safeRoute('./routes/facebook'));
app.use('/api/twitter',   safeRoute('./routes/twitter'));
app.use('/api/snapchat',  safeRoute('./routes/snapchat'));
app.use('/api/pinterest', safeRoute('./routes/pinterest'));
app.use('/api/spotify',   safeRoute('./routes/spotify'));
app.use('/api/reddit',    safeRoute('./routes/reddit'));
app.use('/api/threads',   safeRoute('./routes/threads'));
app.use('/api/mediafire', safeRoute('./routes/mediafire'));
app.use('/api/gdrive',    safeRoute('./routes/gdrive'));
app.use('/api/dropbox',   safeRoute('./routes/dropbox'));
app.use('/api/mega',      safeRoute('./routes/mega'));
app.use('/api/pixeldrain',safeRoute('./routes/pixeldrain'));
app.use('/api/streamtape',safeRoute('./routes/streamtape'));
app.use('/api/apk',       safeRoute('./routes/apk'));
app.use('/api/adult',     safeRoute('./routes/adult'));
app.use('/api/anime',     safeRoute('./routes/anime'));
app.use('/api/movies',    safeRoute('./routes/movies'));
app.use('/api/universal', safeRoute('./routes/universal'));

app.get('/api/health', (_,res) => res.json({ success:true, status:'alive', uptime:Math.floor(process.uptime()), timestamp:new Date().toISOString() }));
app.get('/api/status', (_,res) => {
  let stats = null; try { stats = require('./utils/keyStore').getStats(); } catch(_){}
  res.json({ success:true, name:'Zero API', version:'2.0.0', platforms:['tiktok','youtube','instagram','facebook','twitter','snapchat','pinterest','spotify','reddit','threads','mediafire','gdrive','dropbox','mega','pixeldrain','streamtape','apk','adult','anime','movies'], cache:cache.stats(), key_stats:stats, uptime:Math.floor(process.uptime()) });
});

app.get('/',         (_, res) => res.sendFile(path.join(__dirname, 'views', 'test.html')));
app.get('/admin',    (_, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/login',    (_, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register', (_, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/docs',     (_, res) => res.sendFile(path.join(__dirname, 'views', 'docs.html')));

app.use((req,res) => res.status(404).json({ success:false, error:`Not found: ${req.method} ${req.path}` }));
app.use((err,_,res,__) => { logger.error(err.message); res.status(500).json({ success:false, error:'Internal server error' }); }); // eslint-disable-line

const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  logger.success(`Zero API v2 running on port ${PORT}`);
  logger.success(`Admin: http://localhost:${PORT}/admin  |  Docs: http://localhost:${PORT}/docs`);
  if (adminKey) logger.success(`Admin key: ${adminKey}`);
});
module.exports = app;
