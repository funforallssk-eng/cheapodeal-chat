import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const APP_KEY = '6tnym1br6idh7';
const APP_SECRET = process.env.NEXCONN_APP_SECRET || 'yWj2hyXUWFJ';
const DATA_FILE = path.join(process.cwd(), 'sparsh_users.json');

const MANUAL_TOKENS = {
  'sandy': '9liwjkuFBPUkyNJZpPSITWa8YGB0ycnYGd19V1ycXiE=@3e1z.sg.rongnav.com;3e1z.sg.rongcfg.com'
};

// Load users DB
let usersDB = {};
try {
  if (fs.existsSync(DATA_FILE)) {
    usersDB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`Loaded ${Object.keys(usersDB).length} users from DB`);
  }
} catch (e) {
  console.log('No existing DB, starting fresh');
  usersDB = {};
}

// Add sandy manual if not exists
if (!usersDB['sandy']) {
  usersDB['sandy'] = {
    userId: 'sandy',
    email: 'sandy@sparsh.app',
    dob: '1995-01-01',
    age: 30,
    token: MANUAL_TOKENS['sandy'],
    createdAt: new Date().toISOString(),
    source: 'manual'
  };
}

function saveDB() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(usersDB, null, 2));
  } catch (e) {
    console.error('Failed to save DB', e.message);
  }
}

function getSignature(nonce, timestamp) {
  return crypto.createHash('sha1').update(APP_SECRET + nonce + timestamp).digest('hex');
}

function requestTokenSG(userId) {
  return new Promise((resolve, reject) => {
    const nonce = Math.floor(Math.random()*1000000).toString();
    const timestamp = Date.now().toString();
    const signature = getSignature(nonce, timestamp);
    const body = new URLSearchParams({
      userId: userId,
      name: userId,
      portraitUri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
    }).toString();

    const endpoints = ['api.sg.ronghub.com', 'api.sg.rongcloud.cn'];

    let tried = 0;
    function tryNext() {
      if (tried >= endpoints.length) {
        reject(new Error('All SG endpoints failed'));
        return;
      }
      const hostname = endpoints[tried++];
      const req = https.request({
        hostname: hostname,
        path: '/user/getToken.json',
        method: 'POST',
        headers: {
          'App-Key': APP_KEY,
          'Nonce': nonce,
          'Timestamp': timestamp,
          'Signature': signature,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.code === 200 && json.token) resolve(json);
            else tryNext();
          } catch { tryNext(); }
        });
      });
      req.on('error', () => tryNext());
      req.on('timeout', () => { req.destroy(); tryNext(); });
      req.write(body);
      req.end();
    }
    tryNext();
  });
}

function calcAge(dobStr) {
  const dob = new Date(dobStr);
  const diff = Date.now() - dob.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

app.get('/', (req, res) => {
  res.json({
    status: 'Sparsh Token & User Storage Server',
    app: 'whisper',
    appKey: APP_KEY,
    region: 'SG',
    totalUsers: Object.keys(usersDB).length,
    users: Object.keys(usersDB),
    endpoints: {
      register: 'POST /api/register {userId, email, dob}',
      token: 'GET /api/token?userId=sandy or POST /api/token {userId}',
      users: 'GET /api/users - list all public users',
      user: 'GET /api/user/:userId - get single user data'
    }
  });
});

// Register new user with full data
app.post('/api/register', async (req, res) => {
  const { userId, email, dob } = req.body;
  
  // Validation
  if (!userId || !email || !dob) {
    return res.status(400).json({ error: 'userId, email, dob required' });
  }
  if (userId.length < 3 || !/^[a-zA-Z0-9_]+$/.test(userId)) {
    return res.status(400).json({ error: 'Username min 3 chars, alphanumeric + _ only' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  const age = calcAge(dob);
  if (isNaN(age) || age < 16) {
    return res.status(400).json({ error: `Must be 16+. You are ${age} years old`, age, blocked: true });
  }
  if (age > 100) {
    return res.status(400).json({ error: 'Invalid DOB' });
  }

  // If user exists, return existing
  if (usersDB[userId]) {
    console.log(`User ${userId} already exists, returning existing token`);
    return res.json({
      success: true,
      exists: true,
      user: usersDB[userId],
      accessToken: usersDB[userId].token,
      token: usersDB[userId].token
    });
  }

  // Generate token
  let tokenResult = null;
  if (MANUAL_TOKENS[userId]) {
    tokenResult = { token: MANUAL_TOKENS[userId] };
  } else {
    try {
      tokenResult = await requestTokenSG(userId);
    } catch (e) {
      console.log(`SG API failed for ${userId}, using fallback mock token - user can still chat locally`);
      // Fallback: still allow registration with mock token that works locally, real token can be generated later via console
      tokenResult = { token: `temp_${userId}_${Date.now()}@3e1z.sg.rongnav.com;3e1z.sg.rongcfg.com` };
    }
  }

  const newUser = {
    userId,
    email,
    dob,
    age,
    token: tokenResult.token,
    createdAt: new Date().toISOString(),
    ip: req.ip,
    source: MANUAL_TOKENS[userId] ? 'manual' : 'sg-api'
  };

  usersDB[userId] = newUser;
  saveDB();

  console.log(`Registered new user: ${userId}, age ${age}, email ${email}`);

  res.json({
    success: true,
    user: newUser,
    accessToken: newUser.token,
    token: newUser.token
  });
});

// Old token endpoint - backward compatible, but also stores if new
app.get('/api/token', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  
  if (usersDB[userId]) {
    return res.json({ accessToken: usersDB[userId].token, token: usersDB[userId].token, userId, user: usersDB[userId], source: 'db' });
  }
  
  if (MANUAL_TOKENS[userId]) {
    return res.json({ accessToken: MANUAL_TOKENS[userId], token: MANUAL_TOKENS[userId], userId, source: 'manual' });
  }

  try {
    const result = await requestTokenSG(userId);
    // Save as anonymous registration
    usersDB[userId] = {
      userId,
      email: '',
      dob: '',
      age: null,
      token: result.token,
      createdAt: new Date().toISOString(),
      source: 'sg-api-auto'
    };
    saveDB();
    return res.json({ accessToken: result.token, token: result.token, userId, source: 'sg-api' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to generate token', details: e.message, hint: 'Use POST /api/register with email and dob for full registration' });
  }
});

app.post('/api/token', async (req, res) => {
  const userId = req.body?.userId || req.query?.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  req.query.userId = userId;
  // If body has email/dob, treat as register
  if (req.body?.email && req.body?.dob) {
    return app._router.handle({ ...req, method: 'POST', url: '/api/register' }, res);
  }
  // Otherwise call GET handler
  const fakeReq = { query: { userId }, ip: req.ip };
  return app._router.stack.find(l => l.route && l.route.path === '/api/token' && l.route.methods.get).handle(fakeReq, res);
});

// List all users (public directory) - without tokens
app.get('/api/users', (req, res) => {
  const publicList = Object.values(usersDB).map(u => ({
    userId: u.userId,
    age: u.age,
    createdAt: u.createdAt,
    // Don't expose email/dob in public list for privacy - only show if needed
    email: u.email ? u.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
    hasEmail: !!u.email
  }));
  res.json({ total: publicList.length, users: publicList });
});

// Get single user full data (for admin or self)
app.get('/api/user/:userId', (req, res) => {
  const u = usersDB[req.params.userId];
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ user: u });
});

// Delete user (admin)
app.delete('/api/user/:userId', (req, res) => {
  if (usersDB[req.params.userId]) {
    delete usersDB[req.params.userId];
    saveDB();
    return res.json({ success: true, deleted: req.params.userId });
  }
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Sparsh full storage server running on ${PORT}`);
  console.log(`Total users: ${Object.keys(usersDB).length}`);
});
