
const express=require('express');
const cors=require('cors');
const fs=require('fs');
const path=require('path');
const app=express();
app.use(cors());
app.use(express.json());

const DB_FILE=path.join(__dirname,'users.json');
const MSG_FILE=path.join(__dirname,'messages.json');
let usersDB={};
let messagesDB={}; // { chatId: [ {from, to, text, time, id} ] }

try{if(fs.existsSync(DB_FILE)){usersDB=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}}catch(e){usersDB={};}
try{if(fs.existsSync(MSG_FILE)){messagesDB=JSON.parse(fs.readFileSync(MSG_FILE,'utf8'));}}catch(e){messagesDB={};}

function saveDB(){fs.writeFileSync(DB_FILE,JSON.stringify(usersDB,null,2));}
function saveMsg(){fs.writeFileSync(MSG_FILE,JSON.stringify(messagesDB,null,2));}
function getChatId(a,b){return [a,b].sort().join('_');}

app.get('/',(req,res)=>res.json({status:'Whispr Real-time API - Messages exchanged via backend',users:Object.keys(usersDB).length,chats:Object.keys(messagesDB).length}));

app.post('/api/register',(req,res)=>{
  const{userId,email,password,name,dob}=req.body;
  if(!userId||!email||!password){return res.status(400).json({error:'Username, Email, Password required'});}
  if(userId.length<3){return res.status(400).json({error:'Username min 3 chars'});}
  if(password.length<4){return res.status(400).json({error:'Password min 4 chars'});}
  if(usersDB[userId]){return res.status(400).json({error:'Username already exists'});}
  const emailExists=Object.values(usersDB).find(u=>u.email.toLowerCase()===email.toLowerCase());
  if(emailExists){return res.status(400).json({error:'Email already registered'});}
  if(dob){
    const age=Math.abs(new Date(Date.now()-new Date(dob).getTime()).getUTCFullYear()-1970);
    if(age<16){return res.status(400).json({error:'Must be 16+ Age '+age});}
  }
  const avatar=`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`;
  const user={userId,email,password,name:name||userId,dob:dob||null,age:dob?Math.abs(new Date(Date.now()-new Date(dob).getTime()).getUTCFullYear()-1970):null,avatar,createdAt:new Date().toISOString(),lastActive:new Date().toISOString()};
  usersDB[userId]=user;saveDB();
  const publicUser={...user};delete publicUser.password;
  res.json({success:true,user:publicUser});
});

app.post('/api/login',(req,res)=>{
  const{userId,email,password}=req.body;
  const identifier=(userId||email||'').toLowerCase().trim();
  if(!identifier||!password){return res.status(400).json({error:'Email/Username and Password required'});}
  let user=usersDB[Object.keys(usersDB).find(k=>k.toLowerCase()===identifier)]||Object.values(usersDB).find(u=>u.email.toLowerCase()===identifier);
  if(!user){return res.status(401).json({error:'User not found'});}
  if(user.password!==password){return res.status(401).json({error:'Invalid password'});}
  user.lastActive=new Date().toISOString();saveDB();
  const publicUser={...user};delete publicUser.password;
  res.json({success:true,user:publicUser});
});

app.get('/api/users',(req,res)=>{
  const{search,requesterId}=req.query;
  let list=Object.values(usersDB);
  if(search){
    const s=search.toLowerCase().trim();
    list=list.filter(u=>u.userId.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)||(u.name&&u.name.toLowerCase().includes(s)));
  }
  const publicList=list.map(u=>{const p={...u};delete p.password;return p;});
  res.json({total:publicList.length,users:publicList});
});

// Real-time messaging endpoints
app.post('/api/messages/send',(req,res)=>{
  const{from,to,text}=req.body;
  if(!from||!to||!text){return res.status(400).json({error:'from, to, text required'});}
  if(!usersDB[from]||!usersDB[to]){return res.status(404).json({error:'User not found'});}
  const chatId=getChatId(from,to);
  if(!messagesDB[chatId]) messagesDB[chatId]=[];
  const msg={id:Date.now()+'_'+Math.random().toString(36).substr(2,9),from,to,text:text.trim(),time:new Date().toISOString(),timeStr:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
  messagesDB[chatId].push(msg);
  // Keep last 500 per chat
  if(messagesDB[chatId].length>500) messagesDB[chatId]=messagesDB[chatId].slice(-500);
  saveMsg();
  // Update lastActive
  if(usersDB[from]){usersDB[from].lastActive=new Date().toISOString();}
  saveDB();
  res.json({success:true,message:msg});
});

app.get('/api/messages/:userId/:otherId',(req,res)=>{
  const{userId,otherId}=req.params;
  const chatId=getChatId(userId,otherId);
  const msgs=messagesDB[chatId]||[];
  res.json({chatId,total:msgs.length,messages:msgs});
});

app.get('/api/chats/:userId',(req,res)=>{
  const{userId}=req.params;
  const chats=[];
  Object.keys(messagesDB).forEach(chatId=>{
    if(chatId.includes(userId)){
      const parts=chatId.split('_');
      const other=parts.find(p=>p!==userId);
      if(other){
        const msgs=messagesDB[chatId];
        if(msgs.length>0){
          const last=msgs[msgs.length-1];
          chats.push({userId:other,chatId,lastMsg:last.text,lastTime:last.timeStr,lastTimeISO:last.time,total:msgs.length});
        }
      }
    }
  });
  chats.sort((a,b)=>new Date(b.lastTimeISO)-new Date(a.lastTimeISO));
  res.json({total:chats.length,chats});
});

app.delete('/api/messages/:userId/:otherId',(req,res)=>{
  const{userId,otherId}=req.params;
  const chatId=getChatId(userId,otherId);
  if(messagesDB[chatId]){delete messagesDB[chatId];saveMsg();}
  res.json({success:true,deleted:chatId});
});

app.get('/api/admin/all',(req,res)=>{
  const{adminKey}=req.query;
  if(adminKey!=='Whispr@2026'){return res.status(401).json({error:'Unauthorized'});}
  res.json({total:Object.keys(usersDB).length,users:Object.values(usersDB),chats:Object.keys(messagesDB).length});
});

app.delete('/api/admin/user/:userId',(req,res)=>{
  const{adminKey}=req.query;const{userId}=req.params;
  if(adminKey!=='Whispr@2026'){return res.status(401).json({error:'Unauthorized'});}
  if(usersDB[userId]){delete usersDB[userId];saveDB();}
  // Delete all chats involving user
  Object.keys(messagesDB).forEach(cid=>{if(cid.includes(userId)) delete messagesDB[cid];});
  saveMsg();
  res.json({success:true});
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('Whispr REAL-TIME API running on '+PORT));
