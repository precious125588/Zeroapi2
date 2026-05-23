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
      const res = await http.get(`${base}${path}`, { timeout: 14000 });
      if (res.data) return res.data;
    } catch (e) { logger.warn(`[movies] consumet ${base}: ${e.message}`); }
  }
  throw new Error('Consumet unavailable');
}

function extractTmdbId(url) {
  if (/^\d+$/.test(url)) return { id: url, type: null };
  const tmdb = url.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
  if (tmdb) return { id: tmdb[2], type: tmdb[1] };
  const imdb = url.match(/tt\d{7,}/);
  if (imdb) return { id: imdb[0], type: null };
  return { id: url, type: null };
}

function embedUrls(tmdbId, type = 'movie', season = null, episode = null) {
  const urls = [];
  if (type === 'tv' && season && episode) {
    urls.push({ provider: 'vidsrc.xyz',  url: `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}` });
    urls.push({ provider: 'vidsrc.me',   url: `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}` });
    urls.push({ provider: '2embed',      url: `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}` });
    urls.push({ provider: 'superembed',  url: `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}` });
  } else {
    urls.push({ provider: 'vidsrc.xyz',  url: `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}` });
    urls.push({ provider: 'vidsrc.me',   url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` });
    urls.push({ provider: '2embed',      url: `https://www.2embed.cc/embed/${tmdbId}` });
    urls.push({ provider: 'superembed',  url: `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1` });
    urls.push({ provider: 'embedsu',     url: `https://embed.su/embed/movie/${tmdbId}` });
  }
  return urls;
}

async function download(url, opts = {}) {
  const { id: tmdbId, type: urlType } = extractTmdbId(url);
  const mediaType = opts.type || urlType || 'movie';
  const season  = opts.season  || null;
  const episode = opts.episode || null;

  // Try Consumet for HLS streams
  let consumetData = null;
  try {
    const path = mediaType === 'tv'
      ? `/movies/flixhq/watch-tv?id=${tmdbId}&season=${season||1}&episode=${episode||1}`
      : `/movies/flixhq/watch-movie?id=${tmdbId}`;
    consumetData = await tryConsumet(path);
  } catch (e) { logger.warn(`[movies] consumet: ${e.message}`); }

  const media = [];
  if (consumetData?.sources?.length) {
    for (const src of consumetData.sources) {
      if (!src.url) continue;
      media.push({ type: 'video', url: src.url, quality: src.quality || 'auto', container: src.url.includes('.m3u8') ? 'm3u8' : 'mp4', note: src.url.includes('.m3u8') ? 'HLS stream' : undefined });
    }
  }

  // Add embed URLs as fallback/alternative
  const embeds = embedUrls(tmdbId, mediaType, season, episode);
  for (const e of embeds) {
    media.push({ type: 'video', url: e.url, quality: 'stream', container: 'embed', note: `${e.provider} — embed player (iframe)` });
  }

  const subs = consumetData?.subtitles?.map(s => ({ lang: s.lang, url: s.url })) || [];

  if (!media.length) throw new Error('Movies: no sources available');
  return { platform: 'movies', title: `TMDB ${tmdbId}`, media, subtitles: subs, note: 'HLS streams and embed players. Use HLS.js for m3u8, iframe for embed URLs.' };
}
module.exports = { download };
