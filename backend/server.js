import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const APP_KEY = '6tnym1br6idh7';
const APP_SECRET = process.env.NEXCONN_APP_SECRET || 'yWj2hyXUWFJ';

// Try both possible Nexconn endpoints
const ENDPOINTS = [
  `https://api-${APP_KEY}.nexconn.ai/v1/users/token`,
  `https://api.nexconn.ai/v1/users/token`,
  `https://${APP_KEY}.api.nexconn.ai/v1/users/token`
];

app.get('/', (req, res) => {
  res.send(`CheapoDeal Token Server Running - App ${APP_KEY}`);
});

app.post('/api/token', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    console.log(`Generating token for userId: ${userId}`);

    let lastError = null;
    for (const url of ENDPOINTS) {
      try {
        console.log(`Trying endpoint: ${url}`);
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appKey: APP_KEY,
            appSecret: APP_SECRET,
            userId: userId,
            ttl: 0
          })
        });
        
        const text = await r.text();
        console.log(`Response from ${url}: ${r.status} - ${text.substring(0, 200)}`);
        
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        
        if (r.ok) {
          // Return whatever Nexconn returns
          return res.json(data);
        } else {
          lastError = data;
        }
      } catch (e) {
        console.log(`Endpoint ${url} failed: ${e.message}`);
        lastError = e.message;
      }
    }

    // If all endpoints failed, return error details
    return res.status(500).json({ 
      error: 'All Nexconn endpoints failed', 
      details: lastError,
      tried: ENDPOINTS 
    });

  } catch (e) {
    console.error('Server error:', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

app.listen(process.env.PORT || 10000, () => {
  console.log('Token server running on', process.env.PORT || 10000);
});
