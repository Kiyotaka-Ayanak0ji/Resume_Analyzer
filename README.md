# Resume Decoded

A **free, open-source** web app that shows how well your resume matches any job description - with a match score, matched/missing skills, and plain-language suggestions.

No subscriptions. No paywalls. The in-house matching engine is free forever and gets smarter from user feedback. Optionally, plug in your own AI key (ChatGPT, Claude, Gemini, or a local Ollama) for a written AI review.

## Features

- **Match score (0-100)** with a clear "Strong match / Decent match / Needs work" label
- **Two free analysis modes** (no AI key needed):
  - **Quick check** - TF-IDF keyword + weighted skill matching, instant
  - **Deep check** - local sentence-transformer embeddings understand *meaning*, matching each job requirement to evidence in your resume
- **AI-powered mode (optional, bring your own key)** - OpenAI, Anthropic Claude, Google Gemini, or local Ollama
- **Resume input**: paste text or upload **PDF / DOCX / TXT** (parsed server-side)
- **Knowledge cache**: identical resumes are parsed once (SHA-256 content hash) and served from cache - never re-parsed
- **Trainable engine**: after every analysis you can confirm/correct the results. Corrections adjust global skill weights and teach the engine new skills - accuracy improves for everyone over time
- **Multi-user & secure**: JWT auth (+ optional Google sign-in), bcrypt password hashing, per-user data isolation, AI keys encrypted at rest (Fernet)
- **Resume library**: store up to 3 labeled resumes and reuse them in any analysis
- **History & dashboard**: every analysis saved, score trend chart, filters
- **Fast under load**: async FastAPI + MongoDB, CPU-bound scoring runs in a thread pool

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Tailwind CSS, shadcn/ui, Framer Motion, Recharts |
| Backend | FastAPI (Python), Motor (async MongoDB), scikit-learn, sentence-transformers |
| Database | MongoDB |
| Auth | JWT (PyJWT + passlib/bcrypt), optional Google Identity Services |

## Project structure

```
/
├─ backend/            # FastAPI app
│  ├─ server.py        # API routes (auth, resumes, analyze, feedback, settings)
│  ├─ engine.py        # In-house matching engine (TF-IDF + embeddings)
│  ├─ parsing.py       # PDF/DOCX/TXT parsing + content hashing
│  ├─ ai_providers.py  # BYO-key adapters: OpenAI / Anthropic / Gemini / Ollama
│  ├─ skills_data.py   # Seed skills + synonyms knowledge base
│  ├─ security_utils.py# JWT, bcrypt, Fernet encryption
│  └─ test_core.py     # Standalone engine test script
└─ frontend/           # React app (multi-page: landing, dashboard, analyze, results, profile, history, settings)
```

## Run locally

Prerequisites: Python 3.11+, Node 18+ with yarn, MongoDB running locally (or an Atlas URI).

**Backend**

```bash
cd backend
pip install -r requirements-deploy.txt
cp .env.example .env          # then edit values
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend**

```bash
cd frontend
yarn install
cp .env.example .env          # set REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

Open http://localhost:3000.

> First deep-mode analysis downloads the `all-MiniLM-L6-v2` model (~90 MB) once. If the model can't load (low RAM), deep mode gracefully falls back to quick mode.

## Environment variables

**backend/.env**

| Variable | Required | Description |
|---|---|---|
| `MONGO_URL` | yes | MongoDB connection string |
| `DB_NAME` | yes | Database name |
| `JWT_SECRET` | yes | Random hex string (`python -c "import secrets;print(secrets.token_hex(32))"`) |
| `ENCRYPTION_KEY` | yes | Fernet key for AI-key encryption (`python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`) |
| `CORS_ORIGINS` | yes | Comma-separated allowed origins (your frontend URL) |
| `GOOGLE_CLIENT_ID` | no | Set to enable "Sign in with Google" |

**frontend/.env**

| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | Backend base URL (no trailing slash, no /api) |

## Deployment (free tiers)

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for a beginner-friendly, step-by-step guide to deploy:

- Backend → **Render** (with `render.yaml` blueprint included)
- Frontend → **Vercel** (with `frontend/vercel.json` included)
- Database → **MongoDB Atlas** free tier

## Enabling Google sign-in (optional)

1. Create an OAuth Client ID (type: Web application) at https://console.cloud.google.com/apis/credentials
2. Add your frontend URL to "Authorized JavaScript origins"
3. Set `GOOGLE_CLIENT_ID` in `backend/.env` and restart - the Google button appears automatically

## How the feedback training works

1. Every analysis shows a validation panel: *"Was this analysis right?"*
2. Users can flag wrongly detected skills, add skills we missed, and rate overall accuracy
3. Corrections update a global `skills_kb` collection: weights move up/down (bounded 0.1-3.0), and brand-new skills are learned
4. All future analyses (for every user) use the updated weights - the engine genuinely improves with use

## Contributing

PRs welcome! Useful areas: more seed skills/synonyms for non-tech industries, better section detection, more file formats (RTF, ODT), i18n.

## License

[MIT](LICENSE) - free to use, self-host, modify and redistribute.
