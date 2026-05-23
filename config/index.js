require('dotenv').config();
module.exports = {
  port: parseInt(process.env.PORT || '3000'),
  adminPassword: process.env.ADMIN_PASSWORD || '080205',
  adminKey: process.env.ADMIN_KEY || '',
  dailyLimit: parseInt(process.env.DAILY_REQUEST_LIMIT || '40'),
  sessionSecret: process.env.SESSION_SECRET || 'zero-api-secret',
  dbPath: process.env.DB_PATH || './data/zero_api.db',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Zero API <noreply@zeroapi.dev>',
  },
  cache: { shortTTL: parseInt(process.env.CACHE_TTL || '300'), longTTL: 86400 },
};
