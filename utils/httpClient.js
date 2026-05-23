const axios = require('axios');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const http = axios.create({
  timeout: 15000,
  headers: HEADERS,
});

function createClient(baseConfig = {}) {
  return axios.create({ timeout: 12000, headers: HEADERS, ...baseConfig });
}

module.exports = { http, createClient, HEADERS };
