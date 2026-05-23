const { http } = require('../utils/httpClient');
const { fetchCobalt } = require('../utils/cobalt');
const logger = require('../utils/logger');
async function fromThreadsApi(url) {
  const postId = url.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1];
  if (!postId) throw new Error('Threads: cannot extract post ID');
  const res = await http.get(`https://www.threads.net/api/graphql`, {
    params: { doc_id: '7561934210586438', variables: JSON.stringify({ postID: postId }) },
    headers: { 'X-Ig-App-Id': '238260118697367', Referer: 'https://www.threads.net/' }, timeout: 10000
  });
  const media = [];
  const items = res.data?.data?.data?.edges || [];
  for (const edge of items) {
    const node = edge?.node?.thread_items?.[0]?.post;
    if (!node) continue;
    (node.carousel_media || [node]).forEach(m => {
      if (m?.video_versions?.length) {
        const best = m.video_versions[0];
        media.push({ type: 'video', url: best.url, quality: 'hd', container: 'mp4' });
      } else if (m?.image_versions2?.candidates?.length) {
        media.push({ type: 'image', url: m.image_versions2.candidates[0].url, quality: 'hd', container: 'jpg' });
      }
    });
  }
  if (!media.length) throw new Error('Threads API: no media');
  return { title: 'Threads Post', media };
}
async function download(url) {
  const providers = [{ name: 'threads-api', fn: () => fromThreadsApi(url) }, { name: 'cobalt', fn: () => fetchCobalt(url) }];
  let last;
  for (const p of providers) {
    try { logger.info(`[threads] ${p.name}`); const r = await p.fn(); logger.success(`[threads] ✓ ${p.name}`); return { platform: 'threads', ...r }; }
    catch (e) { logger.warn(`[threads] ${p.name}: ${e.message}`); last = e; }
  }
  throw new Error(`Threads: all providers failed. ${last?.message}`);
}
module.exports = { download };
