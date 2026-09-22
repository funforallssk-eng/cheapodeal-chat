const express=require('express');
const cors=require('cors');
const crypto=require('crypto');
const app=express();
app.use(cors({origin:'*'}));
app.use(express.json({limit:'10mb'}));

const APP_KEY=process.env.NEXCONN_APP_KEY||'YOUR_APP_KEY_HERE';
const APP_SECRET=process.env.NEXCONN_APP_SECRET||'YOUR_APP_SECRET_HERE';
const PRIMARY=process.env.NEXCONN_PRIMARY_DOMAIN||'api.sg-light-api.com';

function genNonce(){return Math.random().toString(36).substring(2,12);}
function genSig(secret,nonce,ts){return crypto.createHash('sha1').update(secret+nonce+ts).digest('hex');}

async function nexconn(endpoint,body){
  const nonce=genNonce();
  const ts=Date.now().toString();
  const sig=genSig(APP_SECRET,nonce,ts);
  const url=`https://${PRIMARY}${endpoint}`;
  try{
    const res=await fetch(url,{
      method:'POST',
      headers:{'App-Key':APP_KEY,'Nonce':nonce,'Timestamp':ts,'Signature':sig,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const txt=await res.text();
    let data; try{data=JSON.parse(txt);}catch(e){data={raw:txt};}
    return {status:res.status,data,ok:res.ok && data.code===0};
  }catch(e){
    return {status:500,data:{code:-1,error:e.message},ok:false};
  }
}

let users={}, friends={}, messages={}, typingStatus={};

try{
  const fs=require('fs'), path=require('path');
  const load=(f)=>{try{if(fs.existsSync(path.join(__dirname,f))) return JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'));}catch(e){} return null;};
  users=load('users.json')||{};
  friends=load('friends.json')||{};
  messages=load('messages.json')||{};
}catch(e){}

function saveAll(){
  try{
    const fs=require('fs'), path=require('path');
    fs.writeFileSync(path.join(__dirname,'users.json'),JSON.stringify(users,null,2));
    fs.writeFileSync(path.join(__dirname,'friends.json'),JSON.stringify(friends,null,2));
    fs.writeFileSync(path.join(__dirname,'messages.json'),JSON.stringify(messages,null,2));
  }catch(e){console.log('Save error',e.message);}
}

function chatId(a,b){return [a,b].sort().join('_');}

app.get('/',(req,res)=>{
  res.json({
    status:'Whispr Backend FIXED - All endpoints ready',
    endpoints:['POST /api/register','POST /api/login','GET /api/users?search=','POST /api/friends/add','GET /api/friends/list?userId=','POST /api/messages/send','GET /api/messages/:userId/:otherId','DELETE /api/messages/:userId/:otherId','POST /api/typing','GET /api/typing/:from/:to'],
    users:Object.keys(users).length,
    chats:Object.keys(messages).length,
    friends:Object.keys(friends).length,
    nexconnConfigured: APP_KEY!=='YOUR_APP_KEY_HERE'
  });
});

// REGISTER - Username+DOB only
app.post('/api/register',async(req,res)=>{
  console.log('REGISTER',req.body);
  const{userId,dob,name}=req.body;
  if(!userId||!dob) return res.status(400).json({success:false,error:'Username and DOB required'});
  if(users[userId]) return res.status(400).json({success:false,error:'Username already exists - try login'});
  const avatar=`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userId)}`;
  let tokenResult=null;
  if(APP_KEY!=='YOUR_APP_KEY_HERE'){
    const r=await nexconn('/v4/auth/access-token/issue',{userId,name:name||userId,avatarUrl:avatar});
    if(r.ok) tokenResult=r.data.result;
  }
  const user={userId,dob,name:name||userId,avatar,avatarUrl:avatar,email:userId+'@whispr.local',password:dob,accessToken:tokenResult?.accessToken||null,createdAt:new Date().toISOString()};
  users[userId]=user; saveAll();
  const pub={...user}; delete pub.password;
  res.json({success:true,user:pub,totalUsers:Object.keys(users).length});
});

app.post('/api/login',async(req,res)=>{
  console.log('LOGIN',req.body);
  const{userId,dob}=req.body;
  if(!userId) return res.status(400).json({success:false,error:'Username required'});
  let user=users[userId]||users[Object.keys(users).find(k=>k.toLowerCase()===userId.toLowerCase())];
  if(!user) return res.status(401).json({success:false,error:'User not found - register first'});
  const pub={...user}; delete pub.password;
  res.json({success:true,user:pub});
});

app.get('/api/users',(req,res)=>{
  const{search}=req.query;
  let list=Object.values(users).map(u=>{let p={...u};delete p.password;return p;});
  if(search){
    const s=search.toLowerCase().trim();
    list=list.filter(u=>u.userId.toLowerCase().includes(s));
  }
  res.set('Cache-Control','no-store');
  res.json({total:list.length,users:list});
});

// FRIENDS - FIXED - This was missing before causing JSON error
app.post('/api/friends/add',(req,res)=>{
  console.log('FRIENDS ADD',req.body);
  const{userId,friendId}=req.body;
  if(!userId||!friendId) return res.status(400).json({success:false,error:'userId and friendId required'});
  if(userId===friendId) return res.status(400).json({success:false,error:'Cannot add yourself'});
  if(!users[friendId]) return res.status(404).json({success:false,error:'User '+friendId+' not found - register first'});
  if(!users[userId]) return res.status(404).json({success:false,error:'Your user not found'});
  if(!friends[userId]) friends[userId]=[];
  if(friends[userId].includes(friendId)) return res.json({success:true,message:'Already friends',friendId});
  friends[userId].push(friendId);
  if(!friends[friendId]) friends[friendId]=[];
  if(!friends[friendId].includes(userId)) friends[friendId].push(userId);
  saveAll();
  res.json({success:true,friendId,friends:friends[userId]});
});

app.get('/api/friends/list',(req,res)=>{
  const{userId}=req.query;
  if(!userId) return res.status(400).json({success:false,error:'userId required'});
  const list=friends[userId]||[];
  const detailed=list.map(fid=>users[fid]).filter(Boolean).map(u=>{let p={...u};delete p.password;return p;});
  if(detailed.length===0){
    res.json({total:list.length,friends:list.map(id=>({friendId:id,userId:id}))});
  }else{
    res.json({total:detailed.length,friends:detailed.map(u=>({friendId:u.userId,...u}))});
  }
});

// MESSAGES - FIXED - 0.3s sync + emoji/gif/sticker
app.post('/api/messages/send',(req,res)=>{
  console.log('SEND MSG',req.body);
  const{from,to,text}=req.body;
  if(!from||!to||!text) return res.status(400).json({success:false,error:'from,to,text required'});
  if(!users[from]) return res.status(404).json({success:false,error:'Sender not found'});
  if(!users[to]) return res.status(404).json({success:false,error:'Recipient not found'});
  const id=chatId(from,to);
  if(!messages[id]) messages[id]=[];
  const msg={id:Date.now(),from,to,text:text.trim(),time:new Date().toISOString(),timeStr:new Date().toLocaleTimeString()};
  messages[id].push(msg);
  if(messages[id].length>1000) messages[id]=messages[id].slice(-1000);
  saveAll();
  res.json({success:true,message:msg});
});

app.get('/api/messages/:userId/:otherId',(req,res)=>{
  const{userId,otherId}=req.params;
  const id=chatId(userId,otherId);
  res.set('Cache-Control','no-store');
  res.json({chatId:id,total:(messages[id]||[]).length,messages:messages[id]||[]});
});

app.delete('/api/messages/:userId/:otherId',(req,res)=>{
  const{userId,otherId}=req.params;
  const id=chatId(userId,otherId);
  delete messages[id];
  saveAll();
  res.json({success:true});
});

// TYPING INDICATOR - 0.3s sync
app.post('/api/typing',(req,res)=>{
  const{from,to,typing}=req.body;
  if(!from||!to) return res.status(400).json({error:'from,to required'});
  const id=chatId(from,to);
  if(typing){
    typingStatus[id]={from,to,typing:true,time:Date.now()};
  }else{
    delete typingStatus[id];
  }
  res.json({success:true});
});

app.get('/api/typing/:from/:to',(req,res)=>{
  const{from,to}=req.params;
  const id=chatId(from,to);
  const status=typingStatus[id];
  if(status && Date.now()-status.time>3000){
    delete typingStatus[id];
    return res.json({typing:false});
  }
  if(status && status.from===from){
    res.json({typing:true,from:status.from,time:status.time});
  }else{
    res.json({typing:false});
  }
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('Whispr Backend FIXED - All endpoints ready on '+PORT));
