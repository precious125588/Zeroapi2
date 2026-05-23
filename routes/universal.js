const express = require('express');
const { detect } = require('../utils/platformDetector');
const { handleDownload } = require('../controllers/download.controller');
const ALL_PLATFORMS = ['tiktok','youtube','instagram','facebook','twitter','snapchat','pinterest','spotify','reddit','threads','mediafire','gdrive','dropbox','mega','pixeldrain','streamtape'];
const r = express.Router();
async function handleUniversal(req, res) {
  const url = (req.query.url || req.body?.url || '').trim();
  if (!url) return res.status(400).json({ success:false, error:'Missing url', retry_after:0 });
  const platform = detect(url);
  if (!platform) return res.status(422).json({ success:false, error:`Cannot detect platform. Supported: ${ALL_PLATFORMS.join(', ')}` });
  req.query.url = url;
  return handleDownload(platform, req, res);
}
r.get('/', handleUniversal);
r.post('/', handleUniversal);
module.exports = r;
