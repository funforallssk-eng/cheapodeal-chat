# FULL STEP BY STEP GUIDE

## GitHub Repo Creation

1. Go to https://github.com/new
2. Repository name: cheapodeal-chat
3. Description: WhatsApp clone for store.cheapodeal.com.au - Nexconn 6tnym1br6idh7
4. Public
5. DO NOT check Add README
6. Create repository
7. You will see commands - keep page open

## Upload Code to GitHub (2 ways)

### Way A: Drag & Drop (Easiest, no git needed)
1. On your new repo page, click "uploading an existing file"
2. Drag all files from this folder (frontend/, backend/, README.md, render.yaml)
3. Commit

### Way B: Git Commands
```bash
cd cheapodeal-chat-github-repo
git init
git add .
git commit -m "Initial commit - CheapoDeal WhatsApp"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cheapodeal-chat.git
git push -u origin main
```

## Deploy Backend to Render (Makes chat REAL)

1. https://dashboard.render.com/ > New + > Web Service
2. Connect GitHub > Select cheapodeal-chat repo
3. Configure:
   - Name: cheapodeal-token
   - Root Directory: backend
   - Runtime: Node
   - Build: npm install
   - Start: npm start
   - Instance: Free
4. Advanced > Add Environment Variable:
   - Key: NEXCONN_APP_SECRET
   - Value: yWj2hyXUWFJ
5. Create Web Service > Wait 2-3 mins
6. Copy URL: https://cheapodeal-token.onrender.com (example)

Test: Open https://cheapodeal-token.onrender.com/ - should show "Token Server Running"

## Deploy Frontend to store.cheapodeal.com.au

Option 1 - cPanel (you already have):
1. cPanel > File Manager > public_html/store
2. Upload files from frontend/ folder
3. Edit frontend/index.html before upload: set TOKEN_SERVER_URL to your Render URL

Option 2 - Vercel (auto deploys from GitHub):
1. vercel.com/new > Import cheapodeal-chat repo
2. Root Directory: frontend
3. Deploy > You get URL, then point store.cheapodeal.com.au to it via CNAME

## Connect Both

In frontend/index.html line ~20:
```js
const TOKEN_SERVER_URL = "https://cheapodeal-token.onrender.com";
```
Update and re-upload.

## Test Real Chat

1. Phone A: store.cheapodeal.com.au > Login as sandy
2. Phone B: store.cheapodeal.com.au > Login as user2
3. Phone A sends message to user2 > Phone B receives instantly via Nexconn DirectChannel

## Next: Security

console.nexconn.ai > App 6tnym1br6idh7 > Regenerate Secret > Update in Render env vars
