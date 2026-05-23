const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');

const CONSUMET_INSTANCES = [
  'https://consumet-api-one.vercel.app',
  'https://api.consumet.org',
  'https://consumet.vercel.app',
];

async function tryConsumet(path) {
  for (const base of CONSUMET_INSTANCES) {
    try {
      const res = await http.get(`${base}${path}`, { timeout: 12000 });
      if (res.data) return res.data;
    } catch (e) { logger.warn(`[anime] consumet ${base}: ${e.message}`); }
  }
  throw new Error('All Consumet instances failed');
}

async function download(url, opts = {}) {
  const animeId = opts.episode ? url : (url.split('/').pop() || url);
  const ep = opts.episode || '1';
  const episodeId = `${animeId}-episode-${ep}`;
  const data = await tryConsumet(`/anime/gogoanime/watch/${episodeId}`);
  if (!data?.sources?.length) throw new Error(`Anime: no sources for episode ${ep}`);
  const media = [];
  for (const src of data.sources) {
    if (!src.url) continue;
    media.push({ type: 'video', url: src.url, quality: src.quality || 'hd', container: src.url.includes('.m3u8') ? 'm3u8' : 'mp4', note: src.url.includes('.m3u8') ? 'HLS stream — use m3u8 player or HLS.js' : undefined });
  }
  const subs = (data.subtitles || []).map(s => ({ lang: s.lang, url: s.url }));
  return { platform: 'anime', title: `${animeId} Episode ${ep}`, media, subtitles: subs, note: 'HLS streams — use HLS.js, VLC, or m3u8 player' };
}

async function search(query) {
  const data = await tryConsumet(`/anime/gogoanime/${encodeURIComponent(query)}`);
  return data?.results || [];
}

async function info(animeId) {
  const data = await tryConsumet(`/anime/gogoanime/info/${encodeURIComponent(animeId)}`);
  return data;
}
module.exports = { download, search, info };
