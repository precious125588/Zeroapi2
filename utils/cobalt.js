const { http } = require('./httpClient');
const logger = require('./logger');
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.tools',
];
async function fetchCobalt(url) {
  for (const base of COBALT_INSTANCES) {
    try {
      const res = await http.post(`${base}/api/json`, { url }, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      const d = res.data;
      if (d?.status === 'error') continue;
      const media = [];
      if (d?.url) media.push({ type: 'video', url: d.url, quality: 'hd', container: 'mp4' });
      if (d?.audio) media.push({ type: 'audio', url: d.audio, quality: 'audio', container: 'mp3' });
      if (!media.length) continue;
      return { platform: 'cobalt', title: d.filename || 'Media', media };
    } catch (e) { logger.warn(`[cobalt] ${base}: ${e.message}`); }
  }
  throw new Error('Cobalt: all instances failed');
}
module.exports = { fetchCobalt };
