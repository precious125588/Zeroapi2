const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');
async function download(url) {
  const res = await http.get(`https://story.snapchat.com/s/${url.split('/s/')[1] || ''}`, { timeout: 10000 });
  const $ = require('cheerio').load(res.data);
  const media = [];
  $('video source[src], meta[property="og:video"]').each((_,el) => {
    const src = $(el).attr('src') || $(el).attr('content');
    if (src?.startsWith('http')) media.push({ type: 'video', url: src, quality: 'hd', container: 'mp4' });
  });
  $('meta[property="og:image"]').each((_,el) => {
    const src = $(el).attr('content');
    if (src?.startsWith('http')) media.push({ type: 'image', url: src, quality: 'hd', container: 'jpg' });
  });
  if (!media.length) throw new Error('Snapchat: no media found. Try a public story link.');
  const title = $('meta[property="og:title"]').attr('content') || 'Snapchat';
  return { platform: 'snapchat', title, media };
}
module.exports = { download };
