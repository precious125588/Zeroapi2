const logger = require('../utils/logger');

function timeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fromPlayDl(url) {
  const playDl = require('play-dl');
  const info = await playDl.video_info(url);
  const details = info.video_details;
  const media = [];
  if (info.format?.length) {
    for (const f of info.format.slice(0, 8)) {
      if (!f.url) continue;
      const isAudio = !f.qualityLabel;
      media.push({ type: isAudio ? 'audio' : 'video', url: f.url, quality: f.qualityLabel || 'audio', container: f.mimeType?.includes('mp4') ? 'mp4' : (f.mimeType?.includes('webm') ? 'webm' : 'mp4') });
    }
  }
  if (!media.length) throw new Error('play-dl: no formats');
  return { platform: 'youtube', title: details.title || 'YouTube', media, thumbnail: details.thumbnails?.[0]?.url, author: details.channel?.name };
}

async function fromYtdlCore(url) {
  const ytdl = require('@distube/ytdl-core');
  const info = await ytdl.getInfo(url, { requestOptions: { headers: { 'User-Agent': 'Mozilla/5.0' } } });
  const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
  const audioFmts = ytdl.filterFormats(info.formats, 'audioonly');
  const media = [];
  for (const f of formats.slice(0, 5)) {
    if (!f.url) continue;
    media.push({ type: 'video', url: f.url, quality: f.qualityLabel || f.quality || 'sd', container: f.container || 'mp4' });
  }
  for (const f of audioFmts.slice(0, 2)) {
    if (!f.url) continue;
    media.push({ type: 'audio', url: f.url, quality: 'audio', container: f.container || 'mp3' });
  }
  if (!media.length) throw new Error('ytdl-core: no formats');
  return { platform: 'youtube', title: info.videoDetails.title, media, thumbnail: info.videoDetails.thumbnails?.[0]?.url, author: info.videoDetails.author?.name };
}

async function fromYtdlp(url) {
  const { isAvailable, extractYouTube } = require('../utils/ytdlp');
  const ok = await isAvailable();
  if (!ok) throw new Error('yt-dlp not installed');
  return extractYouTube(url);
}

async function download(url) {
  const providers = [
    { name: 'play-dl',   fn: () => timeout(fromPlayDl(url),    13000, 'play-dl') },
    { name: 'ytdl-core', fn: () => timeout(fromYtdlCore(url),  13000, 'ytdl-core') },
    { name: 'yt-dlp',   fn: () => timeout(fromYtdlp(url),     18000, 'yt-dlp') },
  ];
  let last;
  for (const p of providers) {
    try { logger.info(`[yt] trying ${p.name}`); const r = await p.fn(); logger.success(`[yt] ✓ ${p.name}`); return r; }
    catch (e) { logger.warn(`[yt] ${p.name}: ${e.message}`); last = e; }
  }
  throw new Error(`YouTube: all providers failed. ${last?.message}`);
}
module.exports = { download };
