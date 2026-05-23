const express = require('express');
const { sendOtp, verifyOtp, registerUser, loginUser, validateSession, logoutSession, getUser } = require('../utils/userStore');
const { getKey } = require('../utils/keyStore');
const { notifications } = require('../utils/adminStore');
const router = express.Router();

function clientIp(req) { return (req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress||'unknown'; }

// Send OTP
router.post('/send-otp', async (req, res) => {
  const { email, purpose = 'register' } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success:false, error:'Valid email required.' });
  try {
    const result = await sendOtp(email.toLowerCase().trim(), purpose);
    res.json({ success:true, message:`Verification code sent to ${email}`, smtp_enabled: result.sent, ...(result.dev_code && process.env.NODE_ENV !== 'production' ? { dev_code: result.dev_code, dev_note: 'SMTP not configured — code shown for development only' } : {}) });
  } catch (e) { res.status(500).json({ success:false, error:e.message }); }
});

// Register (requires OTP verification)
router.post('/register', async (req, res) => {
  const { name, email, password, code } = req.body;
  if (!name?.trim()) return res.status(400).json({ success:false, error:'Name is required.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success:false, error:'Valid email required.' });
  if (!password || password.length < 6) return res.status(400).json({ success:false, error:'Password must be at least 6 characters.' });
  if (!code) return res.status(400).json({ success:false, error:'Verification code required. Call /auth/send-otp first.' });

  const otpResult = verifyOtp(email.toLowerCase().trim(), code, 'register');
  if (!otpResult.ok) return res.status(400).json({ success:false, error:otpResult.error });

  try {
    const { user, api_key } = registerUser({ name, email: email.toLowerCase().trim(), password, ip: clientIp(req) });
    // Login immediately
    const { token } = loginUser({ email: email.toLowerCase().trim(), password, ip: clientIp(req) });
    res.json({ success:true, message:'Account created!', data: { api_key: api_key.key, limit: `${api_key.request_limit} requests/day`, token, user: { id: user.id, name: user.name, email: user.email } } });
  } catch (e) { res.status(400).json({ success:false, error:e.message }); }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success:false, error:'Email and password required.' });
  try {
    const { user, token, api_key } = loginUser({ email, password, ip: clientIp(req) });
    const keyRecord = api_key ? getKey(api_key) : null;
    res.json({ success:true, data: { token, api_key, used: keyRecord?.requests_used||0, limit: keyRecord?.request_limit||40, user: { id: user.id, name: user.name, email: user.email } } });
  } catch (e) { res.status(401).json({ success:false, error:e.message }); }
});

// Me
router.get('/me', (req, res) => {
  const token = req.headers['x-session-token'];
  if (!token) return res.status(401).json({ success:false, error:'X-Session-Token header required' });
  const sess = validateSession(token);
  if (!sess) return res.status(401).json({ success:false, error:'Invalid or expired session' });
  const k = sess.user.api_key ? getKey(sess.user.api_key) : null;
  res.json({ success:true, data: { user: { id: sess.user.id, name: sess.user.name, email: sess.user.email }, api_key: sess.user.api_key, used: k?.requests_used||0, limit: k?.request_limit||0 } });
});

// Logout
router.post('/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) logoutSession(token);
  res.json({ success:true, message:'Logged out.' });
});
module.exports = router;
