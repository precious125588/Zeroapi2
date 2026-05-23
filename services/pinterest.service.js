const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');
async function download(url) {
  const pinId = url.match(/\/pin\/(\d+)/)?.[1];
  if (!pinId) throw new Error('Pinterest: cannot extract pin ID');
  const res = await http.get(`https://www.pinterest.com/resource/PinResource/get/?data={"options":{"id":"${pinId}","field_set_key":"unauth_react_main_pin"},"context":{}}`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://www.pinterest.com/', 'X-Pinterest-AppState': 'active' }, timeout: 10000
  });
  const pin = res.data?.resource_response?.data;
  if (!pin) throw new Error('Pinterest: no data returned');
  const media = [];
  if (pin.videos?.video_list) {
    const vids = Object.values(pin.videos.video_list).sort((a,b) => (b.width||0)-(a.width||0));
    for (const v of vids) {
      if (!v.url) continue;
      const q = (v.width||0) >= 1080 ? 'hd' : (v.width||0) >= 720 ? '720p' : 'sd';
      media.push({ type: 'video', url: v.url, quality: q, container: 'mp4' });
    }
  }
  if (pin.images?.orig) media.push({ type: 'image', url: pin.images.orig.url, quality: 'hd', container: 'jpg' });
  if (!media.length) throw new Error('Pinterest: no media');
  return { platform: 'pinterest', title: pin.title || pin.description?.slice(0,80) || 'Pinterest', media, thumbnail: pin.images?.orig?.url };
}
module.exports = { download };
