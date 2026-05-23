const { http } = require('../utils/httpClient');
const { fetchCobalt } = require('../utils/cobalt');
const logger = require('../utils/logger');

async function fromSaveinsta(url) {
  const res = await http.post('https://saveinsta.app/api/ajaxSearch', new URLSearchParams({ q: url, t: 'media', lang: 'en' }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://saveinsta.app/' }, timeout: 12000
  });
  const $ = require('cheerio').load(res.data?.data || '');
  const media = [];
  $('a.abutton[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href?.startsWith('http')) return;
    const isVid = href.includes('.mp4') || $(el).text().toLowerCase().includes('video');
    media.push({ type: isVid ? 'video' : 'image', url: href, quality: 'hd', container: isVid ? 'mp4' : 'jpg' });
  });
  if (!media.length) throw new Error('saveinsta: no media');
  return { title: 'Instagram Media', media };
}

async function fromSnapInsta(url) {
  const client = require('../utils/httpClient').createClient();
  const page = await client.get('https://snapinsta.app/', { headers: { Referer: 'https://snapinsta.app/' } });
  const $ = require('cheerio').load(page.data);
  const token = $('input[name="_token"]').val();
  if (!token) throw new Error('snapinsta: no token');
  const res = await client.post('https://snapinsta.app/action.php', new URLSearchParams({ url, token }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: 'https://snapinsta.app/', 'X-Requested-With': 'XMLHttpRequest' }
  });
  const $2 = require('cheerio').load(res.data?.data || '');
  const media = [];
  $2('a[href*=".mp4"], a[href*=".jpg"], a[href*="cdninstagram"], a[href*="fbcdn"]').each((_, el) => {
    const href = $2(el).attr('href');
    if (!href?.startsWith('http')) return;
    const isVid = href.includes('.mp4') || $2(el).attr('download')?.includes('mp4');
    media.push({ type: isVid ? 'video' : 'image', url: href, quality: 'hd', container: isVid ? 'mp4' : 'jpg' });
  });
  if (!media.length) throw new Error('snapinsta: no media');
  return { title: 'Instagram Media', media };
}

async function download(url) {
  const providers = [
    { name: 'saveinsta', fn: () => fromSaveinsta(url) },
    { name: 'snapinsta', fn: () => fromSnapInsta(url) },
    { name: 'cobalt',    fn: () => fetchCobalt(url) },
  ];
  let last;
  for (const p of providers) {
    try { logger.info(`[instagram] ${p.name}`); const r = await p.fn(); logger.success(`[instagram] ✓ ${p.name}`); return { platform: 'instagram', ...r }; }
    catch (e) { logger.warn(`[instagram] ${p.name}: ${e.message}`); last = e; }
  }
  throw new Error(`Instagram: all providers failed. ${last?.message}`);
}
module.exports = { download };
