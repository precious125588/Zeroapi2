async function download(url) {
  const dlUrl = url.replace(/[?&]dl=0/, '').replace(/www\.dropbox\.com/, 'dl.dropboxusercontent.com');
  const finalUrl = dlUrl.includes('dl=1') ? dlUrl : dlUrl + (dlUrl.includes('?') ? '&dl=1' : '?dl=1');
  const filename = url.split('/').pop().split('?')[0];
  const ext = filename.split('.').pop().toLowerCase();
  const isVid = ['mp4','mkv','avi','mov','webm'].includes(ext);
  return { platform: 'dropbox', title: filename, media: [{ type: isVid?'video':'file', url: finalUrl, quality: 'original', container: ext || 'file', note: 'Direct download link' }] };
}
module.exports = { download };
