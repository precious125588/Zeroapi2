const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const logger = require('./logger');

async function isAvailable() {
  try { await execFileAsync('yt-dlp', ['--version'], { timeout: 5000 }); return true; }
  catch (_) { return false; }
}

async function extractYouTube(url) {
  const args = ['--dump-json','--no-playlist','--no-warnings','--quiet',
    '-f','bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', url];
  try {
    const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 20000, maxBuffer: 5*1024*1024 });
    const info = JSON.parse(stdout.trim());
    const media = [];
    if (info.url) media.push({ type:'video', url:info.url, quality:info.height?`${info.height}p`:'hd', container:info.ext||'mp4' });
    if (info.formats) {
      for (const f of (info.formats||[]).filter(f=>f.url&&!f.url.includes('manifest')).slice(0,5)) {
        const q = f.height ? `${f.height}p` : (f.acodec!=='none'&&f.vcodec==='none'?'audio':'sd');
        media.push({ type: f.vcodec==='none'?'audio':'video', url:f.url, quality:q, container:f.ext||'mp4' });
      }
    }
    return { platform:'youtube', title:info.title||'YouTube Video', media, thumbnail:info.thumbnail, author:info.uploader };
  } catch (e) { throw new Error(`yt-dlp: ${e.message}`); }
}
module.exports = { isAvailable, extractYouTube };
