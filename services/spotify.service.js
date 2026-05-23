const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');
async function fromSpotifyDown(url) {
  const { createClient } = require('../utils/httpClient');
  const client = createClient();
  const page = await client.get(`https://spotifydown.com/`, { timeout: 10000 });
  const $ = require('cheerio').load(page.data);
  const trackId = url.match(/track\/([A-Za-z0-9]+)/)?.[1];
  if (!trackId) throw new Error('spotifydown: cannot extract track ID');
  const apiRes = await client.get(`https://api.spotifydown.com/download/${trackId}`, {
    headers: { Referer: 'https://spotifydown.com/', Origin: 'https://spotifydown.com' }, timeout: 12000
  });
  const d = apiRes.data;
  if (!d?.success || !d?.link) throw new Error(`spotifydown: ${d?.message || 'failed'}`);
  return { platform: 'spotify', title: `${d.metadata?.title} - ${d.metadata?.artists}`, media: [{ type: 'audio', url: d.link, quality: 'audio', container: 'mp3' }], thumbnail: d.metadata?.cover_url, author: d.metadata?.artists };
}

async function fromPreview(url) {
  const res = await http.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { timeout: 8000 });
  const data = res.data;
  if (!data?.thumbnail_url) throw new Error('Spotify: no preview available');
  return { platform: 'spotify', title: data.title || 'Spotify Track', note: 'Preview only (30s). Full download requires SMTP-enabled backend.', media: [{ type: 'audio', url: `https://p.scdn.co/mp3-preview/${url.match(/track\/([A-Za-z0-9]+)/)?.[1]}`, quality: 'preview', container: 'mp3', note: 'Preview clip (30s)' }], thumbnail: data.thumbnail_url };
}

async function download(url) {
  const providers = [{ name: 'spotifydown', fn: () => fromSpotifyDown(url) }, { name: 'preview', fn: () => fromPreview(url) }];
  let last;
  for (const p of providers) {
    try { logger.info(`[spotify] ${p.name}`); const r = await p.fn(); logger.success(`[spotify] ✓ ${p.name}`); return r; }
    catch (e) { logger.warn(`[spotify] ${p.name}: ${e.message}`); last = e; }
  }
  throw new Error(`Spotify: all providers failed. ${last?.message}`);
}
module.exports = { download };
