const PATTERNS = [
  [/tiktok\.com|vm\.tiktok|vt\.tiktok/i, 'tiktok'],
  [/(?:youtube\.com|youtu\.be)/i, 'youtube'],
  [/instagram\.com/i, 'instagram'],
  [/facebook\.com|fb\.watch|fb\.com/i, 'facebook'],
  [/(?:twitter|x)\.com/i, 'twitter'],
  [/snapchat\.com/i, 'snapchat'],
  [/pinterest\.\w+|pin\.it/i, 'pinterest'],
  [/open\.spotify\.com/i, 'spotify'],
  [/reddit\.com|redd\.it/i, 'reddit'],
  [/threads\.net/i, 'threads'],
  [/mediafire\.com/i, 'mediafire'],
  [/drive\.google\.com/i, 'gdrive'],
  [/dropbox\.com/i, 'dropbox'],
  [/mega\.nz|mega\.co\.nz/i, 'mega'],
  [/pixeldrain\.com/i, 'pixeldrain'],
  [/streamtape\.com|streamtape\.to/i, 'streamtape'],
  [/xnxx\.com|xhamster\.com|eporner\.com/i, 'adult'],
];
function detect(url) {
  if (!url) return null;
  for (const [re, p] of PATTERNS) { if (re.test(url)) return p; }
  return null;
}
module.exports = { detect };
