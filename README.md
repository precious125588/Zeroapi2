# Zero API

Multi-platform media downloader engine. Railway-ready.

## Platforms

| Platform  | Endpoint                        |
|-----------|---------------------------------|
| TikTok    | `/api/tiktok/download?url=`     |
| YouTube   | `/api/youtube/download?url=`    |
| Instagram | `/api/instagram/download?url=`  |
| Facebook  | `/api/facebook/download?url=`   |
| Twitter/X | `/api/twitter/download?url=`    |
| Snapchat  | `/api/snapchat/download?url=`   |
| Pinterest | `/api/pinterest/download?url=`  |
| Spotify   | `/api/spotify/download?url=`    |
| Universal | `/api/universal?url=`           |

## System Endpoints

- `GET /api/health` — liveness check
- `GET /api/status` — full status + cache stats
- `GET /` — interactive test dashboard

## Response Format

```json
{
  "success": true,
  "data": {
    "platform": "tiktok",
    "title": "Video title",
    "quality": "hd",
    "media": [
      { "type": "video", "url": "https://...", "quality": "hd", "container": "mp4" }
    ]
  }
}
```

Error:
```json
{
  "success": false,
  "error": "Reason",
  "retry_after": 10
}
```

## Deploy to Railway

1. Push this folder (`ZeroApi/`) as your repo root to GitHub
2. Create a new Railway project → connect your repo
3. Railway auto-detects `npm start` from `package.json`
4. Set `PORT` is handled automatically by Railway via `process.env.PORT`
5. No environment variables required to get started

## Local Development

```bash
npm install
npm start          # production
npm run dev        # with nodemon (auto-reload)
```

## Architecture

```
ZeroApi/
├── index.js              # Express server entry point
├── package.json
├── config/index.js       # Port, cache TTL, retry config
├── utils/
│   ├── logger.js         # Coloured request/app logger
│   ├── cache.js          # node-cache wrapper (5–30 min TTL)
│   ├── retry.js          # Exponential-backoff retry helper
│   ├── httpClient.js     # Axios factory with rotating User-Agents
│   └── platformDetector.js  # URL → platform name
├── services/             # Per-platform extraction logic (primary + fallback)
├── controllers/
│   └── download.controller.js  # Shared request handler + caching
├── routes/               # Express routers (GET + POST for each platform)
└── views/test.html       # Browser-based API test dashboard
```
