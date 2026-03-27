# Cloudflare Pages Functions Migration Guide

## Overview

Your CPQ backend has been converted from Express.js to Cloudflare Pages Functions. The Pages Functions act as a proxy to your existing Express backend (which continues to handle all SQL Server database operations).

### Architecture
```
Cloudflare Pages (Frontend) → Cloudflare Pages Functions → Express Backend
                                                              ↓
                                                          SQL Server
```

This approach keeps your existing SQL Server connection in Express while leveraging Cloudflare's global performance for frontend and API request routing.

## Quick Deploy Checklist

### Local Testing (Before Deploying)

```bash
# Terminal 1: Start Express Backend
cd backend
node server.js
# → http://localhost:5000

# Terminal 2: Start Cloudflare Functions (new terminal)
wrangler pages dev
# → http://localhost:8788

# Terminal 3: Start Frontend (another new terminal)
cd frontend
npm run dev
# → http://localhost:5173
```

Then test in browser: `http://localhost:5173`

### Deploy Express Backend

1. Choose hosting: Railway, Render, or Heroku
2. Push to GitHub (uses ci/cd) or manual deploy
3. Set environment variables:
   ```
   DB_USER, DB_PASSWORD, DB_SERVER, DB_DATABASE,
   DB_TRUSTED_CONNECTION, DB_ENCRYPT, ADMIN_API_KEY
   ```
4. Note the public URL (e.g., `https://cpq-backend.railway.app`)

### Deploy to Cloudflare Pages

1. Go to Cloudflare dashboard → Pages
2. Create project → Connect GitHub (`jamuskr21/ai-cpq`)
3. Build settings:
   - Command: `cd frontend && npm install && npm run build`
   - Output: `frontend/dist`
4. Set environment variables:
   ```
   BACKEND_URL = https://cpq-backend.railway.app  (from step above)
   ```
5. Set secret:
   ```
   ADMIN_API_KEY = your-secret-key-123
   ```
6. Deploy → Get your Pages URL (e.g., `https://cpqlite.pages.dev`)

### Verify Deployment

```bash
# Test API endpoint through Cloudflare
curl https://cpqlite.pages.dev/api/config

# Test frontend
open https://cpqlite.pages.dev
```

✅ Done! Your app is live on Cloudflare Pages with SQL Server backend

### What Changed in `functions/db.js`

Your `backend/db.js` connects directly to SQL Server using the `mssql` package. However, Cloudflare Pages Functions can't directly use the `mssql` driver (not supported in edge environment).

**Solution:** `functions/db.js` is now a **wrapper** that calls your Express backend via HTTP:

```javascript
// OLD (backend/db.js) - Direct SQL Server
const config = { user, password, server, database, ... };
const pool = await sql.connect(config);

// NEW (functions/db.js) - HTTP Wrapper
const BACKEND_URL = process.env.BACKEND_URL;
const response = await fetch(`${BACKEND_URL}/api/config?productId=${productId}`);
const config = await response.json();
```

### How It Works Step-by-Step

1. **API Request arrives** at Cloudflare Pages
   ```
   GET https://cpqlite.pages.dev/api/config
   ```

2. **Cloudflare Function** routes to `functions/api/config.js`
   ```javascript
   import * as db from '../db.js';
   const config = await db.getConfig(productId);
   ```

3. **Wrapper function** makes HTTP call
   ```javascript
   const response = await fetch('http://backend:5000/api/config?productId=car');
   const config = await response.json();
   ```

4. **Express backend** handles the request using your original `backend/db.js`
   ```javascript
   // backend/server.js
   app.get('/api/config', async (req, res) => {
     const config = await getConfig(productId);  // Uses backend/db.js
     res.json(config);
   });
   ```

5. **Response flows back** through the chain
   ```
   SQL Server → backend/db.js → Express → Cloudflare Function → Frontend
   ```

### Key Points

- **Your existing code stays the same:** `backend/db.js` and `backend/server.js` are unchanged
- **Cloudflare Functions are wrappers:** They just forward requests to backend
- **Database remains SQL Server:** No schema changes needed
- **Fallback config:** If backend is down, Cloudflare Functions return fallback config
- **Performance:** Slight latency from HTTP hop, but acceptable for most use cases
```
Old:
backend/server.js (single Express app with all routes)
backend/db.js (database layer)

New:
functions/api/config.js (GET /api/config)
functions/api/validate.js (POST /api/validate)
functions/api/price.js (POST /api/price)
functions/api/products.js (GET /api/products)
functions/api/quotes.js (POST/GET /api/quotes)
functions/api/quotes/[id].js (GET /api/quotes/:id)
functions/api/admin/[[path]].js (all /api/admin/* routes)
functions/utils.js (shared utilities)
wrangler.toml (Cloudflare configuration)
```

### Key Differences

1. **Request/Response Handling**
   - Uses Fetch API instead of Express middleware
   - Each function exports an `onRequest` handler
   - Response headers must be set manually (CORS, Content-Type)

2. **Routing**
   - File-based routing (files in `/functions` map to routes)
   - Dynamic routes use `[param]` and `[[wildcard]]` syntax
   - No need for explicit route definitions

3. **Environment Variables**
   - Set via Cloudflare dashboard (Secrets) or `wrangler secret put`
   - Accessed via `process.env.VARIABLE_NAME`

4. **Database Connections**
   - SQL Server connections need to work in Cloudflare's environment
   - Some database drivers may have limitations in edge functions
   - Consider using Cloudflare's D1 (SQLite) or connecting to external databases

## Migration Checklist

### ✅ Already Done
- [x] Functions folder created with all endpoints
- [x] `functions/db.js` configured to wrap Express backend
- [x] All functions updated to use wrapper
- [x] `wrangler.toml` configured with environment variables
- [x] CORS headers added to all responses

### 🔄 Still To Do

#### 1. Deploy Express Backend (Required First)
Choose your hosting:
- [ ] Railway, Render, or Heroku account created
- [ ] `backend/server.js` and `backend/db.js` deployed
- [ ] Backend URL noted (e.g., `https://cpq-backend.railway.app`)
- [ ] SQL Server connection tested on backend
- [ ] Environment variables set on hosting platform

#### 2. Update Cloudflare Configuration
- [ ] Cloudflare Pages project created
- [ ] Set `BACKEND_URL` environment variable in Cloudflare
- [ ] Set `ADMIN_API_KEY` secret in Cloudflare
- [ ] Frontend (`frontend/dist`) deployed to Pages

#### 3. Test Integration
- [ ] Backend running and accessible
- [ ] Cloudflare Functions can reach backend
- [ ] Frontend API calls working through Functions
- [ ] Admin endpoints authenticated properly

### Example Configuration

**For Railway Backend:**
```
BACKEND_URL = https://cpq-backend-production.up.railway.app
ADMIN_API_KEY = your-secret-key-123
```

**For Render Backend:**
```
BACKEND_URL = https://cpq-backend.onrender.com
ADMIN_API_KEY = your-secret-key-123
```

## Deployment Steps

### Phase 1: Set Up Express Backend

First, deploy your existing Express backend (`backend/server.js` + `backend/db.js`) to a hosting service:

#### Option A: Deploy to Railway (Recommended - Easiest)

1. Go to https://railway.app and sign up
2. Create a new project → Deploy from GitHub
3. Select your repository (`jamuskr21/ai-cpq`)
4. Railway auto-detects Node.js project
5. Add environment variables in Railway dashboard:
   ```
   DB_USER = your-sql-user
   DB_PASSWORD = your-password
   DB_SERVER = your-sql-server
   DB_DATABASE = CPQLite
   DB_TRUSTED_CONNECTION = false
   DB_ENCRYPT = true
   ADMIN_API_KEY = your-secret-key-123
   PORT = 5000
   ```
6. Railway generates a public URL → save this as `BACKEND_URL`

#### Option B: Deploy to Render

1. Go to https://render.com and sign up
2. Create New → Web Service
3. Connect GitHub repository
4. Set environment variables in Render dashboard
5. Deploy and note the service URL

### Phase 2: Set Up Cloudflare Pages

1. Go to Cloudflare dashboard → Pages
2. Create project → Connect Git → Select `jamuskr21/ai-cpq`
3. Build command: `cd frontend && npm install && npm run build`
4. Build output directory: `frontend/dist`
5. Set environment variables:
   ```
   BACKEND_URL = https://your-railway-app.up.railway.app  (from Phase 1)
   ADMIN_API_KEY = your-secret-key-123
   ```
6. Deploy

### Phase 3: Test Deployment

Once both are deployed:

```bash
# Test frontend
curl https://your-cpqlite.pages.dev/

# Test API through Cloudflare Functions
curl https://your-cpqlite.pages.dev/api/config

# Test admin endpoint
curl -X POST https://your-cpqlite.pages.dev/api/admin/products \
  -H "x-api-key: your-secret-key-123" \
  -H "Content-Type: application/json" \
  -d '{"productId":"test","name":"Test","basePrice":1000}'
```

## Database Strategy: Wrapper Approach (Recommended for Your Setup)

Your Cloudflare Pages Functions **wrap your existing Express backend**. This approach:

### ✅ Advantages
- **Keeps SQL Server intact**: No schema migration needed
- **Leverages existing db.js**: All your database logic stays unchanged
- **Easy deployment**: Express backend can run anywhere
  - Heroku, Railway, Render, AWS, Azure, or your own server
- **SQL Server compatibility**: No need to rewrite queries for different database
- **Fallback support**: Functions use fallback config if backend is unreachable

### How It Works
1. Cloudflare Pages Functions receive API requests
2. Functions call your Express backend via HTTP (`BACKEND_URL`)
3. Express backend handles SQL Server queries using your existing `db.js`
4. Results flow back through Functions to frontend

### Deployment Configuration

**Environment Variables Needed:**

```bash
# In wrangler.toml (vars section):
BACKEND_URL = "https://your-backend.com"      # Production
BACKEND_URL = "http://localhost:5000"         # Development

# As secret (wrangler secret put):
ADMIN_API_KEY = "your-secret-key-123"
```

### Where to Deploy Express Backend

Express backend (`backend/server.js` + `backend/db.js`) can run on:
- **Heroku** (free tier available)
- **Railway** (simple Node.js deployment)
- **Render** (free tier available, auto-deploys from GitHub)
- **AWS EC2** or **Lambda** (with wrapper)
- **Azure App Service**
- **Your own server** (VPS, on-premises)
- **DigitalOcean** (affordable hosting)

Recommended: **Railway** or **Render** for simplicity and free tier

## Local Development

### Running Everything Locally

1. **Start Express Backend** (Terminal 1)
```bash
cd c:\RenTech\CPQLite\backend
npm install  # if needed
node server.js
# Backend runs on http://localhost:5000
```

2. **Start Cloudflare Pages Functions Locally** (Terminal 2)
```bash
cd c:\RenTech\CPQLite
npm install -g wrangler  # if needed
wrangler pages dev
# Functions run on http://localhost:8788
```

3. **Update Frontend Dev Server** (Terminal 3)
Ensure `frontend/vite.config.js` has proxy:
```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
}
```

4. **Start Frontend** (Terminal 4)
```bash
cd c:\RenTech\CPQLite\frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### Architecture in Local Dev
```
Frontend (5173) → Vite Proxy → Cloudflare Functions (8788) → Express Backend (5000) → SQL Server
```

### Environment Variables for Local Dev

**wrangler.toml** (already configured):
```toml
[env.development]
vars = { 
  ENVIRONMENT = "development",
  BACKEND_URL = "http://localhost:5000"
}
```

**Set secret locally:**
```bash
wrangler secret put ADMIN_API_KEY
# Enter: your-secret-key-123
```

## Troubleshooting

### Backend Not Reachable
**Error:** "Failed to fetch" or timeout
**Solution:**
1. Verify Express backend is running: `curl http://localhost:5000/api/config`
2. Check `BACKEND_URL` environment variable is correct
3. Ensure backend is publicly accessible (if deployed)
4. Check firewall/network settings

### API Returns Empty Data
**Problem:** Functions return data but configuration is empty
**Solution:**
1. Functions have fallback—if backend fails, it returns static config
2. Check backend logs for errors
3. Verify SQL Server is accessible from backend server
4. Check database credentials

### 401 Unauthorized on Admin Routes
**Problem:** Admin endpoints return 401
**Solution:**
1. Verify `ADMIN_API_KEY` environment variable matches in both:
   - Cloudflare Pages (setting)
   - Express backend (environment variable)
2. Check `x-api-key` header is being sent by frontend

### CORS Errors
**Problem:** Frontend can't reach Functions
**Solution:**
- CORS headers are automatically included in all Function responses
- If still blocked, check browser console for specific error
- Verify Cloudflare Pages domain is correct

### Performance Issues
**Possible causes:**
- Backend server is slow → upgrade hosting
- Geographic distance → use CDN or closer server
- Database is slow → optimize SQL queries or add indexes

**Improvements:**
- Cache frequently accessed data (e.g., products list)
- Use database connection pooling in backend (already configured)
- Monitor cold starts with Cloudflare Analytics
