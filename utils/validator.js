const BLOCKED_HOSTS = ['localhost','127.0.0.1','0.0.0.0','::1'];
function filterMedia(media) {
  if (!Array.isArray(media)) return [];
  return media.filter(m => {
    if (!m?.url) return false;
    try { const u = new URL(m.url); return !BLOCKED_HOSTS.includes(u.hostname); } catch (_) { return m.url.startsWith('http'); }
  });
}
function isValidUrl(url) {
  try { new URL(url); return true; } catch (_) { return false; }
}
module.exports = { filterMedia, isValidUrl };
