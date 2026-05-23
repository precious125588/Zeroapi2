const { http } = require('../utils/httpClient');
const { fetchCobalt } = require('../utils/cobalt');
const retry = require('../utils/retry');
const logger = require('../utils/logger');

async function fromTikwm(url) {
  const res = await http.post('https://www.tikwm.com/api/', new URLSearchParams({ url, hd: '1' }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000,
  });
  const d = res.data;
  if (!d || d.code !== 0) throw new Error(`tikwm: ${d?.msg || 'failed'}`);
  const item = d.data;
  const media = [];
  if (item.hdplay) media.push({ type: 'video', url: item.hdplay, quality: 'hd', container: 'mp4', note: 'no watermark' });
  if (item.play)   media.push({ type: 'video', url: item.play,   quality: 'sd', container: 'mp4', note: 'no watermark' });
  if (item.music)  media.push({ type: 'audio', url: item.music,  quality: 'audio', container: 'mp3' });
  if (item.images?.length) item.images.forEach(u => media.push({ type: 'image', url: u, quality: 'hd', container: 'jpg' }));
  if (!media.length) throw new Error('tikwm: no media');
  return { title: item.title || 'TikTok', media, author: item.author?.nickname, thumbnail: item.cover };
}

async function download(url) {
  const providers = [
    { name: 'tikwm',  fn: () => retry(() => fromTikwm(url), 2, 800, 'tikwm') },
    { name: 'cobalt', fn: () => fetchCobalt(url) },
  ];
  let last;
  for (const p of providers) {
    try { logger.info(`[tiktok] ${p.name}`); const r = await p.fn(); logger.success(`[tiktok] ✓ ${p.name}`); return { platform: 'tiktok', ...r }; }
    catch (e) { logger.warn(`[tiktok] ${p.name}: ${e.message}`); last = e; }
  }
  throw new Error(`TikTok: all providers failed. ${last?.message}`);
}
module.exports = { download };
