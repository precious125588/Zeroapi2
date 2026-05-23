const express = require('express');
const { createKey, getAllKeys, updateKey, deleteKey, getStats, getKey } = require('../utils/keyStore');
const { getAllUsers, banUser, unbanUser, resetUserLimit, getFlaggedUsers, getUser } = require('../utils/userStore');
const { endpoints, providers, logs, analytics, security, notifications, cacheCtrl, ALL_ENDPOINTS } = require('../utils/adminStore');
const logger = require('../utils/logger');
const config = require('../config');
const router = express.Router();

const ROLE_RANK = { root:4, admin:3, moderator:2, support:1, user:0 };

function getAdminRole(req) {
  const token = req.headers['x-admin-token'] || req.query.adminToken || (req.headers['authorization']||'').replace('Bearer ','');
  if (token === config.adminPassword) return 'root';
  const apiKey = (req.headers['x-api-key']||'').trim();
  if (apiKey) { try { const k=getKey(apiKey); if(k?.active && ROLE_RANK[k.role]>=1) return k.role; } catch(_){} }
  return null;
}

function requireRole(min) {
  return (req,res,next) => {
    const role = getAdminRole(req);
    if (!role || ROLE_RANK[role] < ROLE_RANK[min]) return res.status(403).json({ success:false, error:`Requires ${min} or higher.` });
    req.adminRole = role; next();
  };
}
const root = requireRole('root'), admin = requireRole('admin'), mod = requireRole('moderator'), sup = requireRole('support');

function notify(msg, level='info') { try { notifications.add(level, msg); } catch(_){} }

// Auth
router.post('/auth', (req,res) => {
  const { password } = req.body;
  if (password === config.adminPassword) return res.json({ success:true, token:password, role:'root' });
  const k = req.headers['x-api-key'] ? getKey(req.headers['x-api-key']) : null;
  if (k?.active && ROLE_RANK[k.role]>=1) return res.json({ success:true, token:req.headers['x-api-key'], role:k.role });
  res.status(401).json({ success:false, error:'Wrong password.' });
});

// Dashboard
router.get('/dashboard', mod, (req,res) => { try { res.json({ success:true, data:{ stats:getStats(), analytics:analytics.summary(), endpoints:endpoints.getAll(), notifications:notifications.getAll(true), uptime:Math.floor(process.uptime()), memory:process.memoryUsage() } }); } catch(e){ res.status(500).json({success:false,error:e.message}); } });

// Keys
router.get('/stats', mod, (req,res) => res.json({ success:true, data:getStats() }));
router.get('/keys', admin, (req,res) => res.json({ success:true, data:getAllKeys() }));
router.post('/keys', admin, (req,res) => {
  const {name,role='user',limit}=req.body;
  if (!name?.trim()) return res.status(400).json({ success:false, error:'name required' });
  if (role==='root' && req.adminRole!=='root') return res.status(403).json({ success:false, error:'Only root can create root keys.' });
  try { const k=createKey({name,role,limit:limit!=null&&limit!==''?Number(limit):null}); notify(`🔑 Key created: ${name} [${role}] by admin`,'info'); res.json({success:true,data:k}); } catch(e){ res.status(500).json({success:false,error:e.message}); }
});
router.patch('/keys/:key', admin, (req,res) => {
  try {
    const ex=getKey(req.params.key);
    if (!ex) return res.status(404).json({success:false,error:'Key not found'});
    if (ex.role==='root' && req.adminRole!=='root') return res.status(403).json({success:false,error:'Only root can modify root keys.'});
    const u=updateKey(req.params.key, req.body);
    notify(`✏ Key updated: ${ex.name}`,'info');
    res.json({success:true,data:u});
  } catch(e){ res.status(400).json({success:false,error:e.message}); }
});
router.post('/keys/:key/regenerate', admin, (req,res) => {
  try { const ex=getKey(req.params.key); if(!ex) return res.status(404).json({success:false,error:'Not found'}); const n=createKey({name:ex.name,role:ex.role,limit:ex.request_limit}); deleteKey(req.params.key); notify(`🔄 Key regenerated: ${ex.name}`,'warn'); res.json({success:true,data:n,old_key:req.params.key}); } catch(e){ res.status(400).json({success:false,error:e.message}); }
});
router.post('/keys/:key/pause',     admin, (req,res) => { try{ const u=updateKey(req.params.key,{active:false}); notify(`⏸ Key paused: ${u?.name}`,'warn'); res.json({success:true,data:u}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/keys/:key/resume',    admin, (req,res) => { try{ const u=updateKey(req.params.key,{active:true});  notify(`▶ Key resumed: ${u?.name}`,'info'); res.json({success:true,data:u}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/keys/:key/blacklist', admin, (req,res) => { try{ const u=updateKey(req.params.key,{blacklisted:true,active:false}); notify(`🚫 Key blacklisted: ${u?.name}`,'warn'); res.json({success:true,data:u}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/keys/:key/whitelist', admin, (req,res) => { try{ const u=updateKey(req.params.key,{blacklisted:false,active:true}); notify(`✅ Key whitelisted: ${u?.name}`,'info'); res.json({success:true,data:u}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.delete('/keys/:key', root, (req,res) => { try{ const ex=getKey(req.params.key); const ok=deleteKey(req.params.key); if(!ok) return res.status(404).json({success:false,error:'Not found'}); notify(`🗑 Key deleted: ${ex?.name}`,'warn'); res.json({success:true}); }catch(e){ res.status(400).json({success:false,error:e.message}); } });

// Limits
router.get('/limits', admin, (req,res) => { const keys=getAllKeys(); res.json({success:true,data:{default_daily_limit:config.dailyLimit,keys:keys.map(k=>({key:k.key,name:k.name,limit:k.request_limit,used:k.requests_used}))}}); });
router.post('/limits/:key', admin, (req,res) => { try{ const {limit}=req.body; const u=updateKey(req.params.key,{limit}); notify(`📊 Limit changed: ${u?.name} → ${limit}`,'info'); res.json({success:true,data:u}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/limits/:key/reset', admin, (req,res) => { try{ const {getDb}=require('../utils/db'); getDb().prepare('UPDATE api_keys SET requests_used=0 WHERE key=?').run(req.params.key); notify(`↺ Usage reset: ${req.params.key.slice(0,20)}…`,'info'); res.json({success:true,message:'Usage reset'}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/limits/:key/unlimited', admin, (req,res) => { try{ const u=updateKey(req.params.key,{limit:null}); notify(`♾ Unlimited set: ${u?.name}`,'info'); res.json({success:true,data:u}); }catch(e){res.status(400).json({success:false,error:e.message});} });

// Endpoints + Providers
router.get('/endpoints', mod, (req,res) => res.json({success:true,data:endpoints.getAll()}));
router.patch('/endpoints/:p', admin, (req,res) => { const {enabled,maintenance}=req.body; if(enabled!==undefined) endpoints.setEnabled(req.params.p,enabled); if(maintenance!==undefined) endpoints.setMaintenance(req.params.p,maintenance); notify(`🔌 Endpoint ${req.params.p}: enabled=${enabled} maint=${maintenance}`,'info'); res.json({success:true,data:endpoints.get(req.params.p)}); });
router.get('/providers', mod, (req,res) => res.json({success:true,data:providers.getAll()}));
router.patch('/providers/:pl/:prov', admin, (req,res) => { const {enabled,priority}=req.body; if(enabled!==undefined) providers.setEnabled(req.params.pl,req.params.prov,enabled); if(priority!==undefined) providers.setPriority(req.params.pl,req.params.prov,Number(priority)); res.json({success:true}); });

// Logs + Analytics
router.get('/logs', mod, (req,res) => { const {limit=100,offset=0,status,platform,error_only}=req.query; res.json({success:true,data:logs.get({limit:parseInt(limit),offset:parseInt(offset),status:status?parseInt(status):undefined,platform,error_only:error_only==='1'})}); });
router.delete('/logs', root, (req,res) => { logs.clear(); notify('🗑 Logs cleared','warn'); res.json({success:true,message:'Logs cleared'}); });
router.get('/analytics', mod, (req,res) => res.json({success:true,data:analytics.summary()}));

// Cache
router.get('/cache', mod, (req,res) => res.json({success:true,data:cacheCtrl.getStats()}));
router.post('/cache/clear', admin, (req,res) => { cacheCtrl.clear(); res.json({success:true,message:'Cache cleared'}); });

// Security
router.get('/security/blocked', mod, (req,res) => res.json({success:true,data:security.getBlocked()}));
router.get('/security/abuse', mod, (req,res) => res.json({success:true,data:security.getAbuse(parseInt(req.query.threshold||'100'))}));
router.post('/security/block', admin, (req,res) => { const {ip,reason}=req.body; if(!ip) return res.status(400).json({success:false,error:'ip required'}); security.block(ip,reason||''); notify(`🛡 IP blocked: ${ip} — ${reason}`,'warn'); res.json({success:true}); });
router.post('/security/unblock', admin, (req,res) => { const {ip}=req.body; if(!ip) return res.status(400).json({success:false,error:'ip required'}); security.unblock(ip); notify(`🔓 IP unblocked: ${ip}`,'info'); res.json({success:true}); });

// Server
router.get('/server', admin, (req,res) => res.json({success:true,data:{uptime:Math.floor(process.uptime()),memory:process.memoryUsage(),version:process.version,env:process.env.NODE_ENV||'dev',pid:process.pid}}));
router.post('/server/maintenance', root, (req,res) => { const {enabled}=req.body; ALL_ENDPOINTS.forEach(ep=>endpoints.setMaintenance(ep,!!enabled)); notify(`🔧 Maintenance mode ${enabled?'ON':'OFF'}`,'warn'); res.json({success:true,message:`Maintenance ${enabled?'ON':'OFF'}`}); });
router.post('/server/reload', admin, (req,res) => { Object.keys(require.cache).filter(k=>k.includes('/services/')).forEach(k=>delete require.cache[k]); notify('🔄 Services reloaded','info'); res.json({success:true,message:'Services reloaded'}); });

// Notifications
router.get('/notifications', sup, (req,res) => res.json({success:true,data:notifications.getAll(req.query.unread==='1'),count:notifications.count()}));
router.post('/notifications/read', sup, (req,res) => { notifications.markRead(req.body?.id||'all'); res.json({success:true}); });
router.post('/notifications', admin, (req,res) => { const {level='info',message}=req.body; if(!message) return res.status(400).json({success:false,error:'message required'}); notifications.add(level,message); res.json({success:true}); });

// Users
router.get('/users', sup, (req,res) => { try{res.json({success:true,data:getAllUsers()});}catch(e){res.status(500).json({success:false,error:e.message});} });
router.get('/users/flagged', sup, (req,res) => { try{res.json({success:true,data:getFlaggedUsers()});}catch(e){res.status(500).json({success:false,error:e.message});} });
router.get('/users/:id', sup, (req,res) => { const u=getUser(parseInt(req.params.id)); if(!u) return res.status(404).json({success:false,error:'Not found'}); const k=u.api_key?getKey(u.api_key):null; res.json({success:true,data:{...u,key_info:k}}); });
router.post('/users/:id/ban', admin, (req,res) => { try{ banUser(parseInt(req.params.id),req.body?.reason||''); notify(`🚫 User banned: ID ${req.params.id} — ${req.body?.reason||''}`,'warn'); res.json({success:true}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/users/:id/unban', admin, (req,res) => { try{ unbanUser(parseInt(req.params.id)); notify(`✅ User unbanned: ID ${req.params.id}`,'info'); res.json({success:true}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/users/:id/reset-limit', sup, (req,res) => { try{ resetUserLimit(parseInt(req.params.id)); notify(`↺ User limit reset: ID ${req.params.id}`,'info'); res.json({success:true}); }catch(e){res.status(400).json({success:false,error:e.message});} });
router.post('/users/:id/assign-role', admin, (req,res) => {
  const {role}=req.body;
  if (!role) return res.status(400).json({success:false,error:'role required'});
  if (role==='root' && req.adminRole!=='root') return res.status(403).json({success:false,error:'Only root can assign root role.'});
  try {
    const u=getUser(parseInt(req.params.id));
    if (!u) return res.status(404).json({success:false,error:'User not found'});
    if (u.api_key) updateKey(u.api_key,{role});
    notify(`👑 Role ${role} assigned to user ID ${req.params.id}`,'info');
    res.json({success:true,message:`Role ${role} assigned`});
  } catch(e){ res.status(400).json({success:false,error:e.message}); }
});
// Admin collect/modify user key directly
router.get('/users/:id/key', sup, (req,res) => {
  const u=getUser(parseInt(req.params.id));
  if (!u) return res.status(404).json({success:false,error:'User not found'});
  const k=u.api_key?getKey(u.api_key):null;
  res.json({success:true,data:{api_key:u.api_key,key_info:k}});
});
router.patch('/users/:id/key', admin, (req,res) => {
  const u=getUser(parseInt(req.params.id));
  if (!u?.api_key) return res.status(404).json({success:false,error:'User or key not found'});
  try { const updated=updateKey(u.api_key,req.body); notify(`✏ User ${req.params.id} key modified by admin`,'info'); res.json({success:true,data:updated}); } catch(e){ res.status(400).json({success:false,error:e.message}); }
});
module.exports = router;
