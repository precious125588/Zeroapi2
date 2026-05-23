const cache = require('../utils/cache');
const logger = require('../utils/logger');
const { filterMedia } = require('../utils/validator');

const SERVICES = {
  tiktok:     () => require('../services/tiktok.service'),
  youtube:    () => require('../services/youtube.service'),
  instagram:  () => require('../services/instagram.service'),
  facebook:   () => require('../services/facebook.service'),
  twitter:    () => require('../services/twitter.service'),
  snapchat:   () => require('../services/snapchat.service'),
  pinterest:  () => require('../services/pinterest.service'),
  spotify:    () => require('../services/spotify.service'),
  reddit:     () => require('../services/reddit.service'),
  threads:    () => require('../services/threads.service'),
  mediafire:  () => require('../services/mediafire.service'),
  gdrive:     () => require('../services/gdrive.service'),
  dropbox:    () => require('../services/dropbox.service'),
  mega:       () => require('../services/mega.service'),
  pixeldrain: () => require('../services/pixeldrain.service'),
  streamtape: () => require('../services/streamtape.service'),
  apk:        () => require('../services/apk.service'),
  adult:      () => require('../services/adult.service'),
  anime:      () => require('../services/anime.service'),
  movies:     () => require('../services/movies.service'),
};

function cacheKey(platform, url, opts) {
  return `${platform}:${Buffer.from(url + JSON.stringify(opts)).toString('base64').slice(0, 64)}`;
}

function bestQuality(media) {
  const vid = media.find(m => m.type === 'video');
  const q = vid?.quality || media[0]?.quality || '';
  if (/4k|2160/i.test(q)) return '4k';
  if (/1440/i.test(q)) return '1440p';
  if (/1080/i.test(q)) return '1080p';
  if (/720/i.test(q)) return '720p';
  if (/hd/i.test(q)) return 'hd';
  if (/audio/i.test(q)) return 'audio';
  return 'sd';
}

async function handleDownload(platform, req, res) {
  const url = (req.query.url || req.body?.url || '').trim();
  if (!url) return res.status(400).json({ success:false, error:'Missing url parameter', retry_after:0 });

  const opts = {};
  ['episode','season','quality','type'].forEach(k => { const v = req.query[k] || req.body?.[k]; if (v) opts[k] = v; });

  const key = cacheKey(platform, url, opts);
  const cached = cache.get(key);
  if (cached) { logger.info(`[cache] ${platform}`); return res.json({ success:true, cached:true, data:cached }); }

  const svcFn = SERVICES[platform];
  if (!svcFn) return res.status(400).json({ success:false, error:`Unknown platform: ${platform}` });

  try {
    logger.info(`[dl] ${platform} → ${url.slice(0,60)}`);
    const result = await svcFn().download(url, opts);
    const filtered = filterMedia(result.media || []);
    const media = filtered.length ? filtered : (result.media || []);
    if (!media.length) return res.status(422).json({ success:false, error:'No downloadable media found' });

    const data = { platform: result.platform||platform, title: result.title||`${platform} Media`, quality: bestQuality(media), media };
    if (result.author)    data.author    = result.author;
    if (result.thumbnail) data.thumbnail = result.thumbnail;
    if (result.note)      data.note      = result.note;
    if (result.overview)  data.overview  = result.overview;
    if (result.subtitles?.length) data.subtitles = result.subtitles;
    if (result.size)      data.size      = result.size;

    cache.set(key, data);
    return res.json({ success:true, data });
  } catch (err) {
    logger.error(`[${platform}] ${err.message}`);
    return res.status(502).json({ success:false, error:err.message, retry_after:10 });
  }
}
module.exports = { handleDownload };
