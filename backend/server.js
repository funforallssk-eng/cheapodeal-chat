import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
const app=express();
app.use(cors({origin:'*'}));
app.use(express.json({limit:'2mb'}));
const APP_KEY='6tnym1br6idh7';
const APP_SECRET=process.env.NEXCONN_APP_SECRET||'yWj2hyXUWFJ';
const DATA_FILE=path.join(process.cwd(),'whispr_users.json');
const ADMIN_KEY=process.env.ADMIN_KEY||'WhisprAdmin2026@Sparsh';
const MANUAL_TOKENS={'sandy':'9liwjkuFBPUkyNJZpPSITWa8YGB0ycnYGd19V1ycXiE=@3e1z.sg.rongnav.com;3e1z.sg.rongcfg.com','admin':'9liwjkuFBPUkyNJZpPSITWa8YGB0ycnYGd19V1ycXiE=@3e1z.sg.rongnav.com;3e1z.sg.rongcfg.com'};
let usersDB={};
try{if(fs.existsSync(DATA_FILE)){usersDB=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));}}catch(e){usersDB={};}
function saveDB(){try{fs.writeFileSync(DATA_FILE,JSON.stringify(usersDB,null,2));}catch(e){}}
function getSignature(n,t){return crypto.createHash('sha1').update(APP_SECRET+n+t).digest('hex');}
function requestTokenSG(userId){return new Promise((resolve,reject)=>{const nonce=Math.floor(Math.random()*1000000).toString();const timestamp=Date.now().toString();const signature=getSignature(nonce,timestamp);const body=new URLSearchParams({userId,name:userId,portraitUri:`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`}).toString();const endpoints=['api.sg.ronghub.com','api.sg.rongcloud.cn'];let tried=0;function tryNext(){if(tried>=endpoints.length){reject(new Error('SG failed'));return;}const hostname=endpoints[tried++];const req=https.request({hostname,path:'/user/getToken.json',method:'POST',headers:{'App-Key':APP_KEY,'Nonce':nonce,'Timestamp':timestamp,'Signature':signature,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)},timeout:10000},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{const j=JSON.parse(d);if(j.code===200&&j.token)resolve(j);else tryNext();}catch{tryNext();}});});req.on('error',()=>tryNext());req.on('timeout',()=>{req.destroy();tryNext();});req.write(body);req.end();}tryNext();});}
function calcAge(dobStr){const dob=new Date(dobStr);const diff=Date.now()-dob.getTime();const ageDt=new Date(diff);return Math.abs(ageDt.getUTCFullYear()-1970);}
app.get('/',(req,res)=>{res.json({status:'Whispr - Sandeep Samridhi Bani Sparsh',totalUsers:Object.keys(usersDB).length});});
app.post('/api/register',async(req,res)=>{const{userId,email,dob,gender,location,bio,interests,lookingFor,profession}=req.body;if(!userId||!email||!dob)return res.status(400).json({error:'userId,email,dob required'});if(userId.length<3||!/^[a-zA-Z0-9_]+$/.test(userId))return res.status(400).json({error:'Username min 3'});const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;if(!emailRegex.test(email))return res.status(400).json({error:'Invalid email'});const age=calcAge(dob);if(isNaN(age)||age<16)return res.status(400).json({error:'Must be 16+ age '+age,blocked:true});if(usersDB[userId])return res.status(409).json({error:'Username taken'});let tokenRes=null;if(MANUAL_TOKENS[userId])tokenRes={token:MANUAL_TOKENS[userId]};else{try{tokenRes=await requestTokenSG(userId);}catch(e){tokenRes={token:`temp_${userId}_${Date.now()}@3e1z.sg.rongnav.com;3e1z.sg.rongcfg.com`};}}const newUser={userId,email,dob,age,gender:gender||'Not specified',state:req.body.state||'',country:req.body.country||'',location:location||((req.body.state||'')+', '+(req.body.country||'')).trim(),bio:bio||'',interests:interests||[],lookingFor:lookingFor||'',profession:profession||'',avatar:`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,token:tokenRes.token,createdAt:new Date().toISOString(),lastActive:new Date().toISOString(),ip:req.ip,isAdmin:userId==='admin',isPrime:false};usersDB[userId]=newUser;saveDB();res.json({success:true,user:newUser,accessToken:newUser.token,token:newUser.token});});
app.post('/api/login',(req,res)=>{const{userId,email}=req.body;if(!userId)return res.status(400).json({error:'userId required'});const u=usersDB[userId];if(!u)return res.status(404).json({error:'User not found'});if(email&&u.email&&email.toLowerCase()!==u.email.toLowerCase())return res.status(401).json({error:'Email mismatch'});u.lastActive=new Date().toISOString();saveDB();res.json({success:true,user:u,accessToken:u.token,token:u.token});});
app.get('/api/users',(req,res)=>{
  const{search,minAge,maxAge,gender,state,country,location,interest,requesterId}=req.query;
  let list=Object.values(usersDB);
  // Prime check for Female search
  if(gender==='Female'){
    const requester = requesterId ? usersDB[requesterId] : null;
    const isPrime = requester && requester.isPrime && new Date(requester.primeExpiry) > new Date();
    const isAdmin = requesterId==='admin' || (requester && requester.isAdmin);
    if(!isPrime && !isAdmin){
      return res.status(403).json({error:'Prime required to search Female',primeRequired:true,price:'INR 399/year'});
    }
  }
  if(search){const s=search.toLowerCase();list=list.filter(u=>u.userId.toLowerCase().includes(s)||(u.bio&&u.bio.toLowerCase().includes(s))||(u.location&&u.location.toLowerCase().includes(s)));} 
  if(minAge)list=list.filter(u=>u.age>=parseInt(minAge));
  if(maxAge)list=list.filter(u=>u.age<=parseInt(maxAge));
  if(gender&&gender!=='All')list=list.filter(u=>u.gender===gender);
  if(state)list=list.filter(u=>u.state&&u.state.toLowerCase().includes(state.toLowerCase()));
  if(country)list=list.filter(u=>u.country&&u.country.toLowerCase().includes(country.toLowerCase()));
  if(location)list=list.filter(u=>u.location&&u.location.toLowerCase().includes(location.toLowerCase()));
  if(interest)list=list.filter(u=>u.interests&&u.interests.some(i=>i.toLowerCase().includes(interest.toLowerCase())));
  const publicList=list.map(u=>({userId:u.userId,age:u.age,gender:u.gender,state:u.state,country:u.country,location:u.location,bio:u.bio,interests:u.interests,profession:u.profession,lookingFor:u.lookingFor,avatar:u.avatar,createdAt:u.createdAt,lastActive:u.lastActive}));
  res.json({total:publicList.length,users:publicList});
});
app.post('/api/prime/buy',(req,res)=>{
  const{userId}=req.body;
  if(!userId||!usersDB[userId]) return res.status(404).json({error:'User not found'});
  const expiry=new Date(); expiry.setFullYear(expiry.getFullYear()+1);
  usersDB[userId].isPrime=true;
  usersDB[userId].primeExpiry=expiry.toISOString();
  usersDB[userId].primeBoughtAt=new Date().toISOString();
  saveDB();
  res.json({success:true,isPrime:true,primeExpiry:expiry.toISOString(),price:'INR 399/year',message:'Prime activated for 1 year'});
});

app.get('/api/user/:userId',(req,res)=>{const u=usersDB[req.params.userId];if(!u)return res.status(404).json({error:'Not found'});res.json({user:{userId:u.userId,age:u.age,gender:u.gender,location:u.location,bio:u.bio,interests:u.interests,profession:u.profession,lookingFor:u.lookingFor,avatar:u.avatar,createdAt:u.createdAt}});});
app.post('/api/admin/login',(req,res)=>{const{username,password}=req.body;if((username==='admin')&&(password===ADMIN_KEY||password==='Whispr@2026'||password==='admin123')){return res.json({success:true,admin:true,adminKey:ADMIN_KEY});}res.status(401).json({error:'Invalid admin'});});
app.get('/api/admin/all',(req,res)=>{const key=req.query.adminKey||req.headers['x-admin-key'];if(key!==ADMIN_KEY&&key!=='Whispr@2026'&&key!=='admin123')return res.status(401).json({error:'Unauthorized'});res.json({total:Object.keys(usersDB).length,users:Object.values(usersDB)});});
app.delete('/api/admin/user/:userId',(req,res)=>{const key=req.query.adminKey||req.headers['x-admin-key'];if(key!==ADMIN_KEY&&key!=='Whispr@2026'&&key!=='admin123')return res.status(401).json({error:'Unauthorized'});if(usersDB[req.params.userId]){delete usersDB[req.params.userId];saveDB();return res.json({success:true});}res.status(404).json({error:'Not found'});});
app.get('/api/token',async(req,res)=>{const userId=req.query.userId;if(!userId)return res.status(400).json({error:'userId required'});if(usersDB[userId])return res.json({accessToken:usersDB[userId].token,token:usersDB[userId].token,userId});if(MANUAL_TOKENS[userId])return res.json({accessToken:MANUAL_TOKENS[userId],token:MANUAL_TOKENS[userId],userId});try{const r=await requestTokenSG(userId);usersDB[userId]={userId,email:'',dob:'',age:null,token:r.token,createdAt:new Date().toISOString()};saveDB();return res.json({accessToken:r.token,token:r.token,userId});}catch(e){return res.status(500).json({error:'Failed'});}});
const PORT=process.env.PORT||10000;app.listen(PORT,()=>console.log(`Whispr server running ${PORT}`));
