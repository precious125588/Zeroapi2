const logger = require('./logger');
async function retry(fn, times = 2, delay = 500, label = '') {
  let err;
  for (let i = 0; i < times; i++) {
    try { return await fn(); }
    catch (e) { err = e; if (i < times-1) { logger.warn(`[retry] ${label} attempt ${i+1} failed: ${e.message}`); await new Promise(r=>setTimeout(r,delay)); } }
  }
  throw err;
}
module.exports = retry;
