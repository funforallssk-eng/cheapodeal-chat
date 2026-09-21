# CheapoDeal Chat - WhatsApp Clone
Real-time chat service for store.cheapodeal.com.au
Powered by Nexconn - App Key: 6tnym1br6idh7

## Architecture
```
frontend/ -> WhatsApp Web clone (upload to store.cheapodeal.com.au)
backend/  -> Token server (deploy to Render.com - keeps App Secret safe)
```

## Live Demo
Frontend: https://store.cheapodeal.com.au
Token Server: https://cheapodeal-token.onrender.com (after deploy)

## Quick Start - 3 Steps

### 1. Create GitHub Repo
- Go to github.com/new
- Repo name: cheapodeal-chat
- Public, no README (we have one)
- Create

### 2. Push This Code
```bash
git init
git add .
git commit -m "Initial: WhatsApp clone for CheapoDeal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cheapodeal-chat.git
git push -u origin main
```

### 3. Deploy Backend (1-click)
- Go to render.com > New > Web Service > Connect your cheapodeal-chat repo
- Root Directory: backend
- Build Command: npm install
- Start Command: npm start
- Add Env: NEXCONN_APP_SECRET = yWj2hyXUWFJ (then regenerate after!)
- Deploy

Or use render.yaml - Render auto-detects it.

### 4. Deploy Frontend to store.cheapodeal.com.au
- cPanel > File Manager > public_html/store
- Upload everything from frontend/ folder
- Or connect frontend/ to Netlify/Vercel and point domain

## How Chat Works (WhatsApp style)
```js
// 1. Get token from YOUR backend
const { accessToken } = await fetch('https://your-token-server.com/api/token', {
  method: 'POST',
  body: JSON.stringify({ userId: 'sandy' })
}).then(r=>r.json());

// 2. Connect to Nexconn
NCEngine.initialize({ appKey: '6tnym1br6idh7' });
await NCEngine.connect({ token: accessToken });

// 3. Chat like WhatsApp
const channel = new DirectChannel('otherUserId'); // 1-to-1
await channel.sendMessage(new SendTextMessageParams({ text: 'Hello!' }));

const group = new GroupChannel('group_1'); // Group chat
```

## Security
App Secret yWj2hyXUWFJ is ONLY in backend/. Never put in frontend/. After deploy, regenerate secret in console.nexconn.ai

## PWA Installable
frontend/ includes manifest.json + sw.js - Chrome shows Install button automatically when HTTPS enabled.
