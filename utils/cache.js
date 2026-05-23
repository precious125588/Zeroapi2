const NodeCache = require('node-cache');
const config = require('../config');
const store = new NodeCache({ stdTTL: config.cache.shortTTL, checkperiod: 120 });
const cache = {
  get: k => store.get(k) || null,
  set: (k, v, ttl = config.cache.shortTTL) => store.set(k, v, ttl),
  del: k => store.del(k),
  flush: () => store.flushAll(),
  stats: () => store.getStats(),
};
module.exports = cache;
