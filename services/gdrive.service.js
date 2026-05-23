const { http } = require('../utils/httpClient');
async function download(url) {
  const fileId = url.match(/\/d\/([A-Za-z0-9_-]+)/)?.[1] || url.match(/id=([A-Za-z0-9_-]+)/)?.[1];
  if (!fileId) throw new Error('Google Drive: cannot extract file ID');
  const infoUrl = `https://drive.google.com/file/d/${fileId}/view`;
  const res = await http.get(infoUrl, { timeout: 10000 });
  const $ = require('cheerio').load(res.data);
  const title = $('title').text().replace(' - Google Drive','').trim() || 'Google Drive File';
  const dlUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
  return { platform: 'gdrive', title, media: [{ type: 'file', url: dlUrl, quality: 'original', container: title.split('.').pop() || 'file', note: 'Direct download — file must be publicly shared' }] };
}
module.exports = { download };
