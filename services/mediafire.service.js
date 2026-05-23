const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');
async function download(url) {
  const res = await http.get(url, { timeout: 12000, headers: { Referer: 'https://www.mediafire.com/' } });
  const $ = require('cheerio').load(res.data);
  let dlUrl = $('a#downloadButton[href], a.popsok[href], a[aria-label="Download file"]').attr('href');
  if (!dlUrl) dlUrl = res.data.match(/"(https:\/\/download\d+\.mediafire\.com\/[^"]+)"/)?.[1];
  if (!dlUrl?.startsWith('http')) throw new Error('MediaFire: cannot find download link');
  const fname = $('div.filename').text().trim() || dlUrl.split('/').pop().split('?')[0];
  const ext = fname.split('.').pop().toLowerCase();
  const isVid = ['mp4','mkv','avi','mov','wmv','webm'].includes(ext);
  return { platform: 'mediafire', title: fname, media: [{ type: isVid?'video':'file', url: dlUrl, quality: 'original', container: ext, size: $('ul.details li:last').text().trim() }] };
}
module.exports = { download };
