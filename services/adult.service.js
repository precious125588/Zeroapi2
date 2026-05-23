const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');

async function fromXnxx(url) {
  const res = await http.get(url, { timeout: 12000 });
  const html = res.data;
  const media = [];
  const hls = html.match(/html5player\.setVideoHLS\('([^']+)'\)/)?.[1];
  if (hls) media.push({ type: 'video', url: hls, quality: 'hls', container: 'm3u8' });
  const hdUrl = html.match(/html5player\.setVideoUrlHigh\('([^']+)'\)/)?.[1];
  const sdUrl = html.match(/html5player\.setVideoUrlLow\('([^']+)'\)/)?.[1];
  if (hdUrl) media.push({ type: 'video', url: hdUrl, quality: 'hd', container: 'mp4' });
  if (sdUrl) media.push({ type: 'video', url: sdUrl, quality: 'sd', container: 'mp4' });
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(' - XNXX.COM','').trim() || 'XNXX Video';
  if (!media.length) throw new Error('xnxx: no media found');
  return { title, media };
}

async function fromEporner(url) {
  const res = await http.get(url, { timeout: 12000 });
  const html = res.data;
  const media = [];
  const matches = html.matchAll(/"file":"([^"]+\.mp4[^"]*)"/g);
  for (const m of matches) {
    const u = m[1].replace(/\\/g,'');
    if (u.startsWith('http')) media.push({ type:'video', url:u, quality:u.includes('1080')?'1080p':u.includes('720')?'720p':'sd', container:'mp4' });
  }
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.split('|')[0]?.trim() || 'ePorner Video';
  if (!media.length) throw new Error('eporner: no media');
  return { title, media };
}

async function fromXhamster(url) {
  const res = await http.get(url, { timeout: 12000 });
  const html = res.data;
  const jsonMatch = html.match(/window\.initials\s*=\s*({.+?});/s);
  if (!jsonMatch) throw new Error('xhamster: no initials');
  const data = JSON.parse(jsonMatch[1]);
  const sources = data?.xplayerSettings?.sources?.standard || {};
  const media = [];
  for (const [q, arr] of Object.entries(sources)) {
    if (arr?.[0]?.url) media.push({ type:'video', url:arr[0].url, quality:q, container:'mp4' });
  }
  const title = data?.pageTitle || 'xHamster Video';
  if (!media.length) throw new Error('xhamster: no media');
  return { title, media };
}

async function download(url) {
  const providers = url.includes('xnxx') ? [fromXnxx] : url.includes('eporner') ? [fromEporner] : url.includes('xhamster') ? [fromXhamster] : [fromXnxx, fromEporner, fromXhamster];
  let last;
  for (const fn of providers) {
    try { logger.info(`[adult] ${fn.name}`); const r = await fn(url); logger.success(`[adult] ✓ ${fn.name}`); return { platform:'adult', ...r }; }
    catch (e) { logger.warn(`[adult] ${fn.name}: ${e.message}`); last = e; }
  }
  throw new Error(`Adult: all providers failed. ${last?.message}`);
}
module.exports = { download };
