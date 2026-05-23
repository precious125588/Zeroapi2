const { http } = require('../utils/httpClient');
const { fetchCobalt } = require('../utils/cobalt');
const logger = require('../utils/logger');

async function fromFdown(url) {
  const res = await http.post('https://fdown.net/download.php', new URLSearchParams({ URLz: url }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://fdown.net/', 'Origin': 'https://fdown.net' }, timeout: 12000
  });
  const $ = require('cheerio').load(res.data);
  const media = [];
  $('a#hdlink, a#sdlink, a[href*=".mp4"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href?.startsWith('http')) return;
    const isHd = $(el).attr('id') === 'hdlink';
    media.push({ type: 'video', url: href, quality: isHd ? 'hd' : 'sd', container: 'mp4' });
  });
  if (!media.length) throw new Error('fdown: no media');
  return { title: 'Facebook Video', media };
}

async function download(url) {
  const providers = [
    { name: 'fdown',  fn: () => fromFdown(url) },
    { name: 'cobalt', fn: () => fetchCobalt(url) },
  ];
  let last;
  for (const p of providers) {
    try { logger.info(`[facebook] ${p.name}`); const r = await p.fn(); logger.success(`[facebook] ✓ ${p.name}`); return { platform: 'facebook', ...r }; }
    catch (e) { logger.warn(`[facebook] ${p.name}: ${e.message}`); last = e; }
  }
  throw new Error(`Facebook: all providers failed. ${last?.message}`);
}
module.exports = { download };
