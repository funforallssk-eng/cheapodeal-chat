
import express from 'express';
import cors from 'cors';
const app = express();
app.use(cors({origin: '*'}));
app.use(express.json());

const APP_KEY = '6tnym1br6idh7';
const APP_SECRET = process.env.NEXCONN_APP_SECRET || 'yWj2hyXUWFJ';
const PRIMARY = 'https://api-6tnym1br6idh7.nexconn.ai';

app.post('/api/token', async (req, res) => {
  try {
    const { userId } = req.body;
    if(!userId) return res.status(400).json({error: 'userId required'});
    const r = await fetch(`${PRIMARY}/v1/users/token`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ appKey: APP_KEY, appSecret: APP_SECRET, userId, ttl: 0 })
    });
    const data = await r.json();
    res.json(data);
  } catch(e){ res.status(500).json({error: e.message}); }
});

app.get('/', (req,res)=>res.send('CheapoDeal Token Server Running - App 6tnym1br6idh7'));

app.listen(process.env.PORT||3001, ()=>console.log('Token server running'));
