import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import https from 'https';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === YOUR APP CREDENTIALS - RECHECKED ===
const APP_NAME = 'whisper';
const APP_KEY = '6tnym1br6idh7';
const APP_SECRET = process.env.NEXCONN_APP_SECRET || 'yWj2hyXUWFJ';
const ACCESS_KEY = process.env.NEXCONN_ACCESS_KEY || 'FJ7EULQ5I633OZJZPEJR3UEEPN4AJLIJLJQLHB7343BGJLZFBLJFWJQXIJNK3GI5NHML5MFMQQ3GZC7BYKZHNAT3MFBHC6D5ZFZ242A';

console.log('=== CheapoDeal Token Server ===');
console.log('App Name:', APP_NAME);
console.log('App Key:', APP_KEY);
console.log('App Secret:', APP_SECRET ? APP_SECRET.substring(0,2) + '***' + APP_SECRET.slice(-2) : 'MISSING');
console.log('Access Key:', ACCESS_KEY ? ACCESS_KEY.substring(0,10) + '...' : 'MISSING');
console.log('Registered users: 0 (fresh app)');

function getSignature(nonce, timestamp) {
  return crypto.createHash('sha1').update(APP_SECRET + nonce + timestamp).digest('hex');
}

function httpsPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      timeout: 15000
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d), raw: d }); }
        catch { resolve({ status: res.statusCode, data: { raw: d }, raw: d }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Timeout to ' + urlStr)));
    req.write(body);
    req.end();
  });
}

app.get('/', (req, res) => {
  res.json({
    status: 'CheapoDeal Token Server Running',
    app: APP_NAME,
    appKey: APP_KEY,
    tokenEndpoint: '/api/token',
    test: '/api/token?userId=sandy',
    accessKeySet: !!ACCESS_KEY
  });
});

app.get('/api/token', async (req, res) => {
  return handleToken(req.query.userId || 'sandy', res);
});

app.post('/api/token', async (req, res) => {
  return handleToken(req.body?.userId || req.query?.userId || 'sandy', res);
});

async function handleToken(userId, res) {
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const name = userId;
  const portrait = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userId)}`;

  const nonce = Math.floor(Math.random()*1000000).toString();
  const timestamp = Date.now().toString();
  const signature = getSignature(nonce, timestamp);
  const formBody = new URLSearchParams({ userId, name, portraitUri: portrait }).toString();

  const baseHeaders = {
    'App-Key': APP_KEY,
    'Nonce': nonce,
    'Timestamp': timestamp,
    'Signature': signature,
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  // Try all known RongCloud / Nexconn endpoints
  const tries = [
    { url: 'https://api.rongcloud.cn/user/getToken.json', headers: baseHeaders, body: formBody, desc: 'RongCloud CN' },
    { url: 'https://api.rongcloud.com.cn/user/getToken.json', headers: baseHeaders, body: formBody, desc: 'RongCloud CN2' },
    { url: 'https://api-us.ronghub.com/user/getToken.json', headers: baseHeaders, body: formBody, desc: 'RongHub US' },
    { url: 'https://api.nexconn.ai/user/getToken.json', headers: baseHeaders, body: formBody, desc: 'Nexconn API' },
    { url: 'https://api-us.nexconn.ai/user/getToken.json', headers: baseHeaders, body: formBody, desc: 'Nexconn US' },
    // Try Platform API with Access Key
    { 
      url: 'https://api.nexconn.ai/v1/users/token', 
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ACCESS_KEY, 'X-Access-Key': ACCESS_KEY, 'App-Key': APP_KEY },
      body: JSON.stringify({ userId, name, portraitUri: portrait, appKey: APP_KEY }),
      desc: 'Nexconn Platform API with AccessKey'
    }
  ];

  let lastErr = null;
  for (const t of tries) {
    try {
      console.log(`[${new Date().toISOString()}] Trying ${t.desc}: ${t.url} for ${userId}`);
      const result = await httpsPost(t.url, t.headers, t.body);
      console.log(` -> Status ${result.status}:`, JSON.stringify(result.data).substring(0, 500));
      
      // RongCloud format
      if (result.data.code === 200 && result.data.token) {
        console.log(`SUCCESS via ${t.desc}`);
        return res.json({ accessToken: result.data.token, token: result.data.token, userId: result.data.userId || userId, source: t.desc });
      }
      // Nexconn format
      if (result.data.token || result.data.accessToken || result.data.data?.token) {
        const tok = result.data.token || result.data.accessToken || result.data.data.token;
        console.log(`SUCCESS via ${t.desc}`);
        return res.json({ accessToken: tok, token: tok, userId, source: t.desc, raw: result.data });
      }
      lastErr = result.data;
    } catch (e) {
      console.log(` -> Failed ${t.desc}: ${e.message}`);
      lastErr = { message: e.message, endpoint: t.desc };
    }
  }

  res.status(500).json({
    error: 'All token endpoints failed',
    details: lastErr,
    recheck: {
      appName: APP_NAME,
      appKey: APP_KEY,
      appSecret: APP_SECRET ? 'set (' + APP_SECRET.length + ' chars)' : 'MISSING',
      accessKey: ACCESS_KEY ? 'set (' + ACCESS_KEY.length + ' chars)' : 'MISSING',
      hint: 'App is fresh (0 users). First token generation may need to be done via Nexconn Console > Users > Create User. If Render blocks CN domains, deploy this same server on Vercel or use manual tokens.'
    },
    triedEndpoints: tries.map(x => x.desc + ': ' + x.url)
  });
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Whisper token server v4 running on ${PORT}`));
