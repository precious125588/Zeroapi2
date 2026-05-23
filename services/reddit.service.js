const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');
async function download(url) {
  const cleanUrl = url.replace(/\?.*$/, '').replace(/\/$/, '');
  const apiUrl = cleanUrl + '.json?limit=1';
  const res = await http.get(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0 ZeroAPI/2.0' }, timeout: 12000 });
  const post = res.data?.[0]?.data?.children?.[0]?.data;
  if (!post) throw new Error('Reddit: no post data');
  const media = [];
  // Video posts
  if (post.is_video && post.media?.reddit_video) {
    const rv = post.media.reddit_video;
    media.push({ type: 'video', url: rv.fallback_url?.replace('?source=fallback',''), quality: rv.height >= 1080 ? 'hd' : rv.height >= 720 ? '720p' : 'sd', container: 'mp4' });
    if (rv.fallback_url) {
      const audioUrl = rv.fallback_url.replace(/DASH_\d+\.mp4/, 'DASH_audio.mp4').replace('?source=fallback','');
      media.push({ type: 'audio', url: audioUrl, quality: 'audio', container: 'mp4', note: 'Audio track — merge with video' });
    }
  }
  // Gallery
  if (post.is_gallery && post.media_metadata) {
    Object.values(post.media_metadata).forEach(m => {
      if (m.status !== 'valid') return;
      const src = m.s?.u ? m.s.u.replace(/&amp;/g,'&') : null;
      if (src) media.push({ type: 'image', url: src, quality: 'hd', container: m.m?.includes('gif') ? 'gif' : 'jpg' });
    });
  }
  // Single image/gif
  if (!media.length && post.url_overridden_by_dest) {
    const u = post.url_overridden_by_dest;
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(u)) media.push({ type: 'image', url: u, quality: 'hd', container: u.split('.').pop() });
    else if (/\.(mp4|gifv)$/i.test(u)) media.push({ type: 'video', url: u.replace('.gifv','.mp4'), quality: 'sd', container: 'mp4' });
  }
  if (!media.length) throw new Error('Reddit: no downloadable media in this post');
  return { platform: 'reddit', title: post.title, media, author: 'u/'+post.author, thumbnail: post.thumbnail?.startsWith('http') ? post.thumbnail : null };
}
module.exports = { download };
