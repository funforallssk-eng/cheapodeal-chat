import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const APP_KEY = '6tnym1br6idh7';
const APP_SECRET = process.env.NEXCONN_APP_SECRET || 'yWj2hyXUWFJ';

// RongCloud/Nexconn token endpoints to try
const TOKEN_URLS = [
  'https://api.rongcloud.cn/user/getToken.json',
  'https://api.nexconn.ai/user/getToken.json',
  'https://api-us.nexconn.ai/user/getToken.json'
];

function getSignature(nonce, timestamp) {
  return crypto.createHash('sha1').update(APP_SECRET + nonce + timestamp).digest('hex');
}

app.get('/', (req, res) => {
  res.send(`CheapoDeal Token Server Running - App ${APP_KEY}`);
});

app.get('/api/token', async (req, res) => {
  const userId = req.query.userId || 'testuser';
  req.body = { userId };
  return handleToken(req, res);
});

app.post('/api/token', handleToken);

async function handleToken(req, res) {
  const userId = req.body?.userId || req.query?.userId || 'testuser';
  const name = req.body?.name || userId;
  const portrait = req.body?.portrait || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;

  const nonce = Math.floor(Math.random() * 1000000).toString();
  const timestamp = Date.now().toString();
  const signature = getSignature(nonce, timestamp);

  console.log(`Generating token for ${userId} - nonce ${nonce}`);

  let lastError = null;
  for (const url of TOKEN_URLS) {
    try {
      console.log(`Trying ${url}`);
      const body = new URLSearchParams({
