# StockPilot

> A clear, modern interface for evidence-grounded stock research and auditable backtesting.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://stockpilot-analyzer.vercel.app)

[**Open StockPilot**](https://stockpilot-analyzer.vercel.app) · [**API documentation**](https://finance-stock-analyzer.onrender.com/docs) · [**Backend repository**](https://github.com/mayank2OP/finance-stock-analyzer)

StockPilot presents quantitative stock analysis in plain language without hiding the evidence. Users can inspect every indicator, rule contribution, source, and backtest assumption behind a signal. AI agents help review and explain supplied evidence; they do not generate market values or override the rules-based result.

![StockPilot analysis workspace](https://raw.githubusercontent.com/mayank2OP/finance-stock-analyzer/main/docs/images/stockpilot-analysis.png)

## Product experience

- Secure account registration and JWT sign-in
- Guided ticker analysis with asynchronous progress
- Plain-English action, risk, strengths, and warnings
- Evidence-quality indicator with an honest definition
- Market metrics and expandable calculation proof
- Clickable, attributable news sources
- Strategy-versus-buy-and-hold backtesting
- Personal watchlist and saved research history
- Responsive layouts for desktop and mobile
- Clear loading, empty, success, and error states

## Application flow

```mermaid
flowchart LR
    U["Enter ticker"] --> J["Start analysis job"]
    J --> P["Show agent progress"]
    P --> R["Render signal and evidence"]
    R --> W["Save to watchlist"]
    R --> S["Save research"]
    U --> B["Run backtest"]
    B --> C["Compare strategy and benchmark"]
```

## Technology stack

| Technology | Purpose |
|---|---|
| Next.js 16 | Production React framework and Vercel build target |
| React 19 | Component-driven user interface |
| TypeScript | Compile-time safety for API contracts and UI state |
| CSS | Responsive StockPilot design system and motion |
| Vercel | Continuous deployment and public hosting |
| FastAPI backend | Authentication, analysis, backtesting, and persistence |

## Run locally

### Prerequisites

- Node.js 22.13+
- The [StockPilot backend](https://github.com/mayank2OP/finance-stock-analyzer) running locally

```powershell
git clone https://github.com/mayank2OP/finance-stock-analyzer-frontend.git
cd finance-stock-analyzer-frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

The default configuration connects to `http://127.0.0.1:8000`. Open `http://localhost:3000`.

To use another backend, set:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
```

This value is public by design because it contains only the API address. Never place Gemini keys, JWT secrets, database credentials, or user access tokens in frontend environment variables.

## Validate

```powershell
npm run lint
npm test
```

`npm test` runs linting and a production Next.js build, catching both code-quality and deployment errors.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. Select the **Next.js** framework preset.
3. Keep the root and output directories at their defaults.
4. Add the production environment variable:

   ```env
   NEXT_PUBLIC_API_URL=https://finance-stock-analyzer.onrender.com
   ```

5. Deploy the project.
6. Add the final Vercel origin to the backend's `CORS_ORIGINS` value and redeploy the backend.

Current production origin:

```env
CORS_ORIGINS=https://stockpilot-analyzer.vercel.app
```

## Security notes

- Authentication tokens are sent only to the configured backend.
- No private API or database secrets are included in the browser bundle.
- Protected data is requested per authenticated user.
- Financial outputs include their evidence and informational-use disclaimer.

## Disclaimer

StockPilot is an educational research project. It does not provide personalized financial advice, and its signals or backtests should not be treated as recommendations or guarantees.

## Author

Built by [Mayank Rawat](https://github.com/mayank2OP).
