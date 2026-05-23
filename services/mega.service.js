const { http } = require('../utils/httpClient');
async function download(url) {
  const m = url.match(/mega\.(?:nz|co\.nz)\/(?:file|#)!?\/([A-Za-z0-9_-]+)(?:[!#]([A-Za-z0-9_-]+))?/);
  if (!m) throw new Error('Mega: invalid URL format');
  const fileHandle = m[1];
  const fileKey = m[2];
  return {
    platform: 'mega', title: `Mega File (${fileHandle})`,
    note: 'Mega files are encrypted client-side. Use the official Mega client or MegaDownloader to download with the decryption key.',
    media: [{
      type: 'file', url: url, quality: 'original', container: 'encrypted',
      note: `Handle: ${fileHandle}${fileKey ? ' · Key: '+fileKey : ''}`,
    }],
  };
}
module.exports = { download };
