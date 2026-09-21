import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import https from 'https';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const APP_KEY = '6tnym1br6idh7';
const APP_SECRET = 'yWj2hyXUWFJ';

// Known working token for sandy - you provided this from console
const MANUAL_TOKENS = {
  'sandy': '9liwjkuFBPUkyNJZpPSITWa8YGB0ycnYGd19V1ycXiE=@3e1z.sg.rongnav.com;3e1z.sg.rongcfg.com'
};

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

    // Singapore region endpoints - these work from Render
    const endpoints = [
      'api.sg.ronghub.com',
      'api.sg.rongcloud.cn',
      'api-sg.ronghub.com'
    ];

    let tried = 0;
    function tryNext() {
      if (tried >= endpoints.length) {
        reject(new Error('All SG endpoints failed'));
        return;
      }
      const hostname = endpoints[tried++];
      console.log(`Trying SG endpoint: ${hostname} for ${userId}`);

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
            console.log(`Response from ${hostname}:`, JSON.stringify(json).substring(0, 300));
            if (json.code === 200 && json.token) {
              resolve(json);
            } else {
              console.log(`Failed on ${hostname}:`, json);
              tryNext();
            }
          } catch (e) {
            console.log(`Invalid JSON from ${hostname}:`, data.substring(0, 200));
            tryNext();
          }
        });
      });

      req.on('error', (e) => {
        console.log(`Error on ${hostname}:`, e.message);
        tryNext();
      });

      req.on('timeout', () => {
        console.log(`Timeout on ${hostname}`);
        req.destroy();
        tryNext();
      });

      req.write(body);
      req.end();
    }

    tryNext();
  });
}

app.get('/', (req, res) => {
  res.json({
    status: 'CheapoDeal Token Server - whisper SG region',
    appKey: APP_KEY,
    region: 'Singapore (sg)',
    nav: '3e1z.sg.rongnav.com',
    cfg: '3e1z.sg.rongcfg.com',
    manualTokens: Object.keys(MANUAL_TOKENS),
    test: '/api/token?userId=sandy'
  });
});

app.get('/api/token', async (req, res) => {
  const userId = req.query.userId || 'sandy';
  return handle(userId, res);
});

app.post('/api/token', async (req, res) => {
  const userId = req.body?.userId || req.query?.userId || 'sandy';
  return handle(userId, res);
});

async function handle(userId, res) {
  // Return manual token if we have it (fast, no API call)
  if (MANUAL_TOKENS[userId]) {
    console.log(`Returning manual token for ${userId}`);
    return res.json({
      accessToken: MANUAL_TOKENS[userId],
      token: MANUAL_TOKENS[userId],
      userId: userId,
      source: 'manual-hardcoded'
    });
  }

  // Try to generate new token via SG API
  try {
    const result = await requestTokenSG(userId);
    // Cache it for next time
    MANUAL_TOKENS[userId] = result.token;
    console.log(`Generated and cached token for ${userId}`);
    return res.json({
      accessToken: result.token,
      token: result.token,
      userId: result.userId || userId,
      source: 'sg-api'
    });
  } catch (e) {
    console.error(`Failed to generate token for ${userId}:`, e.message);
    // If we fail, return sandy token as demo so frontend can at least connect
    return res.status(500).json({
      error: 'Failed to generate token for ' + userId,
      details: e.message,
      hint: 'Generate token manually in console.nexconn.ai for this userId and add to MANUAL_TOKENS in server.js',
      availableManualTokens: Object.keys(MANUAL_TOKENS),
      tryThis: 'Use userId=sandy which has manual token, or add more manual tokens'
    });
  }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Whisper SG token server running on ${PORT}`);
  console.log('Manual tokens:', Object.keys(MANUAL_TOKENS));
});
