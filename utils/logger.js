const ts = () => new Date().toISOString().slice(11,23);
const logger = {
  info:    (...a) => console.log(`\x1b[36m[${ts()}] INFO\x1b[0m`, ...a),
  warn:    (...a) => console.warn(`\x1b[33m[${ts()}] WARN\x1b[0m`, ...a),
  error:   (...a) => console.error(`\x1b[31m[${ts()}] ERR \x1b[0m`, ...a),
  success: (...a) => console.log(`\x1b[32m[${ts()}] OK  \x1b[0m`, ...a),
};
module.exports = logger;
