const { http } = require('../utils/httpClient');
const { fetchCobalt } = require('../utils/cobalt');
const logger = require('../utils/logger');

function extractTweetId(url) {
  const m = url.match(/(?:twitter|x)\.com\/\w+\/status\/(\d+)/);
  return m ? m[1] : null;
}

async function fromSyndication(url) {
  const tweetId = extractTweetId(url);
  if (!tweetId) throw new Error('Cannot extract tweet ID');
  const res = await http.get(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&features=tfw_timeline_list%3A%3Btfw_follower_count_sunset%3Atrue`, { timeout: 10000 });
  const tweet = res.data;
  const media = [];
  const vids = tweet?.mediaDetails?.filter(m => m.type === 'video' || m.type === 'animated_gif');
  const imgs = tweet?.mediaDetails?.filter(m => m.type === 'photo');
  if (vids?.length) {
    for (const v of vids) {
      const variants = (v.video_info?.variants || []).filter(x => x.content_type === 'video/mp4').sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));
      for (const vv of variants) {
        const q = vv.bitrate > 2000000 ? 'hd' : vv.bitrate > 800000 ? '720p' : 'sd';
        media.push({ type: 'video', url: vv.url, quality: q, container: 'mp4' });
      }
    }
  }
  if (imgs?.length) imgs.forEach(i => media.push({ type: 'image', url: i.media_url_https + '?format=jpg&name=orig', quality: 'hd', container: 'jpg' }));
  if (!media.length) throw new Error('syndication: no media in tweet');
  return { title: tweet.full_text?.slice(0, 80) || 'Twitter/X Media', media, author: tweet.user?.screen_name, thumbnail: media[0]?.url };
}

async function download(url) {
  const providers = [
    { name: 'syndication', fn: () => fromSyndication(url) },
    { name: 'cobalt',      fn: () => fetchCobalt(url) },
  ];
  let last;
  for (const p of providers) {
    try { logger.info(`[twitter] ${p.name}`); const r = await p.fn(); logger.success(`[twitter] ✓ ${p.name}`); return { platform: 'twitter', ...r }; }
    catch (e) { logger.warn(`[twitter] ${p.name}: ${e.message}`); last = e; }
  }
  throw new Error(`Twitter: all providers failed. ${last?.message}`);
}
module.exports = { download };
