const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

let usersDB = {};
let messagesDB = {};

// Try to load existing files if they exist
try {
  const fs = require('fs');
  const path = require('path');
  const f = path.join(__dirname, 'users.json');
  if (fs.existsSync(f)) {
    usersDB = JSON.parse(fs.readFileSync(f, 'utf8'));
    console.log('Loaded', Object.keys(usersDB).length, 'users from file');
  }
  const mf = path.join(__dirname, 'messages.json');
  if (fs.existsSync(mf)) {
    messagesDB = JSON.parse(fs.readFileSync(mf, 'utf8'));
  }
} catch (e) {
  console.log('No existing files, starting fresh');
}

function saveUsers() {
  try {
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(usersDB, null, 2));
  } catch (e) { console.log('Save failed', e.message); }
}

function saveMsgs() {
  try {
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(__dirname, 'messages.json'), JSON.stringify(messagesDB, null, 2));
  } catch (e) {}
}

function getChatId(a, b) {
  return [a, b].sort().join('_');
}

// Root - shows user count
app.get('/', (req, res) => {
  res.json({
    status: 'Whispr OK - Fixed',
    users: Object.keys(usersDB).length,
    chats: Object.keys(messagesDB).length,
    message: 'If 0 users, register from frontend - it will save here',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug', (req, res) => {
  res.json({ users: usersDB, messagesCount: Object.keys(messagesDB).length });
});

// REGISTER - Only Username + DOB (as you asked)
app.post('/api/register', (req, res) => {
  console.log('REGISTER attempt', req.body);
  const { userId, dob, name } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Username required' });
  }
  if (!dob) {
    return res.status(400).json({ success: false, error: 'DOB required' });
  }
  if (usersDB[userId]) {
    return res.status(400).json({ success: false, error: 'Username already exists - try login' });
  }

  const user = {
    userId: userId,
    dob: dob,
    name: name || userId,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userId,
    email: userId + '@whispr.local',
    password: dob,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString()
  };

  usersDB[userId] = user;
  saveUsers();
  console.log('REGISTERED', userId, 'total users', Object.keys(usersDB).length);

  const pub = {...user };
  delete pub.password;
  res.json({ success: true, user: pub, totalUsers: Object.keys(usersDB).length });
});

// LOGIN - Username + DOB
app.post('/api/login', (req, res) => {
  const { userId, dob } = req.body;
  console.log('LOGIN attempt', userId, dob);

  if (!userId) {
    return res.status(400).json({ success: false, error: 'Username required' });
  }

  const user = usersDB[userId] || usersDB[Object.keys(usersDB).find(k => k.toLowerCase() === userId.toLowerCase())];

  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found - register first' });
  }

  user.lastActive = new Date().toISOString();
  saveUsers();

  const pub = {...user };
  delete pub.password;
  res.json({ success: true, user: pub });
});

// Get all users / search by username
app.get('/api/users', (req, res) => {
  const { search } = req.query;
  let list = Object.values(usersDB).map(u => {
    let p = {...u };
    delete p.password;
    return p;
  });
  if (search) {
    const s = search.toLowerCase().trim();
    list = list.filter(u => u.userId.toLowerCase().includes(s));
  }
  res.set('Cache-Control', 'no-store');
  res.json({ total: list.length, users: list });
});

// Send message - 1 second sync
app.post('/api/messages/send', (req, res) => {
  const { from, to, text } = req.body;
  console.log('SEND', from, '->', to, text?.substring(0, 20));

  if (!from ||!to ||!text) {
    return res.status(400).json({ error: 'from,to,text required' });
  }

  const chatId = getChatId(from, to);
  if (!messagesDB[chatId]) messagesDB[chatId] = [];

  const msg = {
    id: Date.now(),
    from,
    to,
    text: text.trim(),
    time: new Date().toISOString(),
    timeStr: new Date().toLocaleTimeString()
  };

  messagesDB[chatId].push(msg);
  if (messagesDB[chatId].length > 500) messagesDB[chatId] = messagesDB[chatId].slice(-500);
  saveMsgs();

  res.json({ success: true, message: msg });
});

// Get messages - 1 sec sync, no cache
app.get('/api/messages/:userId/:otherId', (req, res) => {
  const { userId, otherId } = req.params;
  const chatId = getChatId(userId, otherId);
  res.set('Cache-Control', 'no-store');
  res.json({ chatId, total: (messagesDB[chatId] || []).length, messages: messagesDB[chatId] || [] });
});

app.get('/api/chats/:userId', (req, res) => {
  const { userId } = req.params;
  const chats = [];
  Object.keys(messagesDB).forEach(chatId => {
    if (chatId.includes(userId)) {
      const parts = chatId.split('_');
      const other = parts.find(p => p!== userId);
      if (other && messagesDB[chatId].length > 0) {
        const last = messagesDB[chatId][messagesDB[chatId].length - 1];
