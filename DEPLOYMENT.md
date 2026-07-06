# Deploying Resume Decoded (free tiers, beginner-friendly)

You will deploy three things:

| Piece | Where | Cost |
|---|---|---|
| Database | MongoDB Atlas | Free (M0) |
| Backend (FastAPI) | Render | Free web service |
| Frontend (React) | Vercel | Free hobby plan |

Total time: ~20 minutes.

---

## Step 1 - MongoDB Atlas (database)

1. Sign up at https://www.mongodb.com/cloud/atlas/register
2. Create a **free M0 cluster** (pick any region close to you)
3. Under **Database Access** → Add New Database User → username + password (save these)
4. Under **Network Access** → Add IP Address → **Allow access from anywhere** (`0.0.0.0/0`)
5. Click **Connect → Drivers** and copy the connection string, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

---

## Step 2 - Render (backend)

> Why Render? Easiest Python deployment for beginners, free tier, scales up with one click later.

1. Push this repository to your GitHub account
2. Sign up at https://render.com with GitHub
3. Click **New → Web Service** and pick your repo
4. Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements-deploy.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Add **Environment Variables**:
   - `MONGO_URL` = your Atlas connection string
   - `DB_NAME` = `resume_decoded`
   - `JWT_SECRET` = run locally: `python -c "import secrets;print(secrets.token_hex(32))"`
   - `ENCRYPTION_KEY` = run locally: `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"`
   - `CORS_ORIGINS` = `*` for now (tighten to your Vercel URL after Step 3)
   - `PYTHON_VERSION` = `3.11.9`
6. Click **Create Web Service** and wait for the build
7. Copy your backend URL, e.g. `https://resume-decoded-api.onrender.com`
8. Verify: open `https://YOUR-BACKEND.onrender.com/api/health` → should show `{"status":"ok"}`

**Notes on the free tier**
- Free services sleep after 15 min idle; first request after sleep takes ~50s. Normal and fine for a portfolio app.
- The **deep mode** embeddings model needs ~1 GB RAM. On the 512 MB free instance it may fail to load - the app **gracefully falls back to quick mode**. Upgrade to the Starter instance ($7/mo) if you want deep mode in production, or self-host.

Alternatively, you can use the included `render.yaml` blueprint: Render → New → Blueprint → select the repo, then just fill in the env var values.

---

## Step 3 - Vercel (frontend)

1. Sign up at https://vercel.com with GitHub
2. Click **Add New → Project** and import your repo
3. Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - **Build Command**: `yarn build`  |  **Output Directory**: `build`
4. Add Environment Variable:
   - `REACT_APP_BACKEND_URL` = your Render backend URL (no trailing slash), e.g. `https://resume-decoded-api.onrender.com`
5. Click **Deploy**
6. Open your Vercel URL and register an account - you're live!

The included `frontend/vercel.json` already handles SPA routing (all paths → index.html).

---

## Step 4 - Lock down CORS (recommended)

Back in Render → Environment → set:

```
CORS_ORIGINS=https://your-app.vercel.app
```

Save (service restarts automatically).

---

## Optional - Google sign-in

1. https://console.cloud.google.com/apis/credentials → Create OAuth Client ID (Web application)
2. Authorized JavaScript origins: `https://your-app.vercel.app`
3. In Render, add env var `GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com`
4. Redeploy - the Google button appears on login/register automatically

## Optional - Ollama (local AI)

Ollama runs on *your* machine, so it works when you run the app locally (`http://localhost:11434`). A cloud-deployed backend cannot reach your laptop; for cloud use, prefer OpenAI/Claude/Gemini keys.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frontend loads but API calls fail | Check `REACT_APP_BACKEND_URL` has no trailing slash; check CORS_ORIGINS |
| `/api/health` 502 on Render | Check build logs; make sure Start Command uses `$PORT` |
| Deep mode always behaves like quick | Instance ran out of RAM loading the model - upgrade instance or use quick/AI modes |
| First request very slow | Free tier cold start - the service was asleep |

---

## SEO after deployment (important)

The SEO files ship with the development URL baked in. After you deploy, replace it with your real domain in these 3 files:

1. `frontend/public/index.html` - `<link rel="canonical">`, `og:url`, and the JSON-LD `url`
2. `frontend/public/robots.txt` - the `Sitemap:` line
3. `frontend/public/sitemap.xml` - all `<loc>` URLs

Then submit your sitemap in [Google Search Console](https://search.google.com/search-console) (Add property -> URL prefix -> your Vercel URL -> Sitemaps -> submit `sitemap.xml`). Google usually indexes within a few days.
