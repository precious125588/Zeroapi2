const { http } = require('../utils/httpClient');
async function download(url) {
  const fileId = url.match(/pixeldrain\.com\/(?:u|l)\/([A-Za-z0-9]+)/)?.[1];
  if (!fileId) throw new Error('Pixeldrain: cannot extract file ID');
  const infoRes = await http.get(`https://pixeldrain.com/api/file/${fileId}/info`, { timeout: 8000 });
  const info = infoRes.data;
  const ext = (info.name || '').split('.').pop().toLowerCase();
  const isVid = ['mp4','mkv','avi','mov','webm'].includes(ext);
  return {
    platform: 'pixeldrain', title: info.name || `Pixeldrain ${fileId}`,
    size: info.size ? `${Math.round(info.size/1024/1024)}MB` : undefined,
    media: [{ type: isVid?'video':'file', url: `https://pixeldrain.com/api/file/${fileId}?download`, quality: 'original', container: ext || 'file' }],
  };
}
module.exports = { download };
