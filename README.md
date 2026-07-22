# StockPilot Frontend

Standalone frontend for the StockPilot FastAPI backend. It provides:

- Registration and JWT login
- Background agent-analysis progress
- Plain-English signal, risk, strengths and warnings
- Market metrics, calculation proof and attributable news
- Backtesting comparison
- Watchlist and saved research history
- Responsive desktop and mobile layouts

## Run locally

Start the backend first at `http://127.0.0.1:8000`, then run:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

The default backend URL is `http://127.0.0.1:8000`. To use another API, copy
`.env.example` to `.env.local` and set:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

## Validate

```powershell
npm test
```

The frontend and backend are deliberately separate projects and can be deployed
independently.

## Deploy

Deploy the backend first and confirm that its `/health` endpoint is healthy.
Then configure this public build-time variable on the frontend host:

```env
NEXT_PUBLIC_API_URL=https://your-deployed-backend.example.com
```

Do not include a trailing slash. This value is intentionally public because it
contains only the API address, not a secret. Never place `GEMINI_API_KEY`,
`JWT_SECRET`, database credentials, or user tokens in frontend environment
variables.

After the frontend receives its public domain, add that exact origin to the
backend's `CORS_ORIGINS` variable and redeploy the backend. For example:

```env
CORS_ORIGINS=https://your-stockpilot-frontend.example.com
```

Before pushing or deploying, run:

```powershell
npm run lint
npm test
```

Generated build output, local environment files, Wrangler state, dependencies,
and TypeScript build metadata are excluded through `.gitignore`.

### Vercel

The default scripts use standard Next.js so Vercel can deploy the application
with its native **Next.js** preset. In Vercel, set the build-time environment
variable below for Production, Preview, and Development:

```env
NEXT_PUBLIC_API_URL=https://finance-stock-analyzer.onrender.com
```

Keep the Root Directory and Output Directory at their defaults. The optional
`build:sites` and `test:sites` scripts preserve compatibility with the previous
Vinext/Cloudflare build pipeline.
