const { http } = require('../utils/httpClient');
async function download(url) {
  const res = await http.get(url, { timeout: 12000, headers: { Referer: 'https://streamtape.com/' } });
  const html = res.data;
  let dlUrl = html.match(/robotlink\)[^"]*"([^"]+)"/)?.[1];
  if (!dlUrl) {
    const m1 = html.match(/id="robotlink"[^>]*>([^<]+)</)?.[1];
    const m2 = html.match(/'\/\/(streamtape\.com\/get_video[^']+)'/)?.[1];
    dlUrl = m1 || (m2 ? 'https://' + m2 : null);
  }
  if (!dlUrl) throw new Error('StreamTape: cannot extract download link');
  if (!dlUrl.startsWith('http')) dlUrl = 'https:' + (dlUrl.startsWith('//') ? '' : '//streamtape.com') + dlUrl;
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(' - Streamtape','').trim() || 'StreamTape Video';
  return { platform: 'streamtape', title, media: [{ type: 'video', url: dlUrl, quality: 'hd', container: 'mp4' }] };
}
module.exports = { download };
