import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const APP_KEY = '6tnym1br6idh7';
const APP_SECRET = process.env.NEXCONN_APP_SECRET || 'yWj2hyXUWFJ';

const TOKEN_URLS = [
  'https://api.rongcloud.cn/user/getToken.json',
  'https://api.nexconn.ai/user/getToken.json',
  'https://api-us.nexconn.ai/user/getToken.json'
];

function getSignature(nonce, timestamp) {
  return crypto.createHash('sha1').update(APP_SECRET + nonce + timestamp).digest('hex');
}

app.get('/', (req, res) => {
  res.send('CheapoDeal Token Server Running - App ' + APP_KEY);
});

app.get('/api/token', async (req, res) => {
  req.body = { userId: req.query.userId || 'testuser' };
  return handleToken(req, res);
});

app.post('/api/token', handleToken);

async function handleToken(req, res) {
  try {
    const userId = (req.body && req.body.userId) || req.query.userId || 'testuser';
    const name = (req.body && req.body.name) || userId;
    const portrait = (req.body && req.body.portrait) || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId;

    const nonce = Math.floor(Math.random() * 1000000).toString();
    const timestamp = Date.now().toString();
    const signature = getSignature(nonce, timestamp);

    console.log('Generating token for ' + userId);

    let lastError = null;
    for (const url of TOKEN_URLS) {
      try {
        console.log('Trying ' + url);
        const body = new URLSearchParams({ userId: userId, name: name, portraitUri: portrait });
        
        const r = await fetch(url, {
          method: 'POST',
          headers: {
            'App-Key': APP_KEY,
            'Nonce': nonce,
            'Timestamp': timestamp,
            'Signature': signature,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body
        });

        const data = await r.json();
        console.log('Response ' + url + ':', JSON.stringify(data).substring(0, 500));

        if (data.code === 200 && data.token) {
          return res.json({ accessToken: data.token, token: data.token, userId: data.userId, raw: data });
        } else {
          lastError = data;
        }
      } catch (e) {
        console.log('Failed ' + url + ': ' + e.message);
        lastError = e.message;
      }
    }

    res.status(500).json({
      error: 'All token endpoints failed',
      details: lastError,
      hint: 'Check App Key/Secret in console.nexconn.ai - App ' + APP_KEY,
      tried: TOKEN_URLS
    });

  } catch (e) {
    console.error('Server error:', e);
    res.status(500).json({ error: e.message });
  }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, function() {
  console.log('Token server running on ' + PORT);
});
