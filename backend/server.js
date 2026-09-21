
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
let messagesDB={};

try{if(fs.existsSync(DB_FILE)){usersDB=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}}catch(e){usersDB={};}
try{if(fs.existsSync(MSG_FILE)){messagesDB=JSON.parse(fs.readFileSync(MSG_FILE,'utf8'));}}catch(e){messagesDB={};}

function saveDB(){fs.writeFile(DB_FILE,JSON.stringify(usersDB,null,2),()=>{});}
function saveMsg(){fs.writeFile(MSG_FILE,JSON.stringify(messagesDB,null,2),()=>{});}
function getChatId(a,b){return [a,b].sort().join('_');}

app.get('/',(req,res)=>res.json({status:'Whispr REAL-TIME 1s Sync',users:Object.keys(usersDB).length,chats:Object.keys(messagesDB).length}));

app.post('/api/register',(req,res)=>{
  const{userId,dob,name,age,avatar,email,password}=req.body;
  if(!userId||!dob){return res.status(400).json({error:'Username and DOB required'});}
  if(usersDB[userId]){return res.status(400).json({error:'Username already exists'});}
  const user={userId,dob,name:name||userId,age:age||null,avatar:avatar||'https://api.dicebear.com/7.x/avataaars/svg?seed='+userId,email:email||userId+'@whispr.local',password:password||dob,createdAt:new Date().toISOString(),lastActive:new Date().toISOString()};
  usersDB[userId]=user;saveDB();
  const pub={...user};delete pub.password;
  res.json({success:true,user:pub});
});

app.post('/api/login',(req,res)=>{
  const{userId,dob,email,password}=req.body;
  const identifier=(userId||email||'').toLowerCase().trim();
  const pass=password||dob;
  if(!identifier){return res.status(400).json({error:'Username required'});}
  let user=usersDB[Object.keys(usersDB).find(k=>k.toLowerCase()===identifier)]||Object.values(usersDB).find(u=>u.email.toLowerCase()===identifier);
  if(!user){return res.status(401).json({error:'User not found'});}
  // Allow DOB as password or stored password
  if(user.password && user.password!==pass && user.dob!==pass){return res.status(401).json({error:'Invalid DOB/Password'});}
  user.lastActive=new Date().toISOString();saveDB();
  const pub={...user};delete pub.password;
  res.json({success:true,user:pub});
});

app.get('/api/users',(req,res)=>{
  const{search}=req.query;
  let list=Object.values(usersDB);
  if(search){
    const s=search.toLowerCase().trim();
    list=list.filter(u=>u.userId.toLowerCase().includes(s));
  }
  const publicList=list.map(u=>{const p={...u};delete p.password;return p;});
  res.json({total:publicList.length,users:publicList});
});

app.post('/api/messages/send',(req,res)=>{
  const{from,to,text}=req.body;
  if(!from||!to||!text){return res.status(400).json({error:'from, to, text required'});}
  if(!usersDB[from]||!usersDB[to]){return res.status(404).json({error:'User not found'});}
  const chatId=getChatId(from,to);
  if(!messagesDB[chatId]) messagesDB[chatId]=[];
  const msg={id:Date.now()+'_'+Math.random().toString(36).substr(2,6),from,to,text:text.trim(),time:new Date().toISOString(),timeStr:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
  messagesDB[chatId].push(msg);
  if(messagesDB[chatId].length>500) messagesDB[chatId]=messagesDB[chatId].slice(-500);
  saveMsg();
  res.json({success:true,message:msg});
});

app.get('/api/messages/:userId/:otherId',(req,res)=>{
  const{userId,otherId}=req.params;
  const chatId=getChatId(userId,otherId);
  const msgs=messagesDB[chatId]||[];
  res.set('Cache-Control','no-store');
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
  res.json({success:true});
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log('Whispr 1s REAL-TIME on '+PORT));
