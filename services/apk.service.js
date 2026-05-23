const { http } = require('../utils/httpClient');
const logger = require('../utils/logger');

function extractPackageId(input) {
  if (/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(input)) return input;
  const m = input.match(/id=([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)/i) || input.match(/\/([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)/i);
  return m?.[1] || null;
}

async function download(url) {
  const packageId = extractPackageId(url);
  if (!packageId) throw new Error('APK: provide a valid package ID (e.g. com.whatsapp)');
  const dlUrl = `https://d.apkpure.com/b/APK/${packageId}?version=latest`;
  const infoRes = await http.get(`https://apkpure.com/${packageId.replace(/\./g,'-')}/${packageId}`, { timeout: 12000 }).catch(() => null);
  let title = packageId, version = 'latest', size = '';
  if (infoRes?.data) {
    const $ = require('cheerio').load(infoRes.data);
    title = $('h1.title-like').text().trim() || packageId;
    version = $('.version-container .ver-wrap .ver code').first().text().trim() || 'latest';
    size = $('.version-container .ver-wrap .ver p').first().text().trim() || '';
  }
  return { platform: 'apk', title: `${title} v${version}`, size,
    media: [{ type: 'file', url: dlUrl, quality: 'latest', container: 'apk', note: `Direct CDN download from APKPure · ${packageId}` }] };
}

async function search(query, limit = 10) {
  const res = await http.get(`https://apkpure.com/search?q=${encodeURIComponent(query)}`, { timeout: 10000 });
  const $ = require('cheerio').load(res.data);
  const results = [];
  $('div.search-dl dl').each((i, el) => {
    if (i >= limit) return;
    const a = $(el).find('dt a').first();
    const name = a.text().trim();
    const href = a.attr('href') || '';
    const pkg = href.match(/\/([^/]+)$/)?.[1] || '';
    const icon = $(el).find('img').attr('src') || '';
    const desc = $(el).find('dd').text().trim();
    if (name) results.push({ name, package_id: pkg, href: 'https://apkpure.com'+href, icon, description: desc });
  });
  return results;
}

async function getInfo(packageId) {
  const res = await http.get(`https://apkpure.com/${packageId}/${packageId}`, { timeout: 10000 });
  const $ = require('cheerio').load(res.data);
  return {
    name: $('h1.title-like').text().trim(),
    package_id: packageId,
    version: $('.version-container .ver-wrap .ver code').first().text().trim(),
    size: $('.file-size').first().text().trim(),
    icon: $('div.title-icon img').attr('src'),
    download_url: `https://d.apkpure.com/b/APK/${packageId}?version=latest`,
  };
}

async function getVersions(packageId) {
  const res = await http.get(`https://apkpure.com/${packageId}/${packageId}/versions`, { timeout: 10000 });
  const $ = require('cheerio').load(res.data);
  const versions = [];
  $('.ver-item').each((i, el) => {
    if (i >= 20) return;
    const ver = $(el).find('span.ver-item-n').text().trim();
    const date = $(el).find('p.date').text().trim();
    if (ver) versions.push({ version: ver, date, download_url: `https://d.apkpure.com/b/APK/${packageId}?version=${ver}` });
  });
  return versions;
}
module.exports = { download, search, getInfo, getVersions };
