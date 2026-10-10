const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = __dirname, PUBLIC = path.join(ROOT, 'public'), DATA = path.join(ROOT, 'data');
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'D7U-change-moi-2026';
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, {recursive:true});
const dbFile = path.join(DATA, 'content.json');
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({
  activities: [
    {id:1,title:'Journée de solidarité',category:'Communauté',date:'2026-08-12',image:'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1000&q=80',description:'Un moment de partage et d’entraide pour renforcer les liens entre les membres et soutenir notre communauté.'},
    {id:2,title:'Préparation de notre projet agricole',category:'Nos projets',date:'2026-07-05',image:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80',description:'Nous étudions des activités génératrices de revenus pour faire grandir progressivement le capital du groupe.'},
    {id:3,title:'Réunion de planification',category:'Réunion',date:'2026-06-22',image:'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=80',description:'Les membres échangent des idées et organisent les prochaines étapes de notre vision commune.'}
  ],
  projects: [
    {id:101,title:'Agriculture moderne',category:'Agriculture',image:'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80',description:'Production et transformation de produits agricoles.'},
    {id:102,title:'Commerce',category:'Commerce',image:'https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=900&q=80',description:'Développer des activités commerciales au bénéfice des membres.'},
    {id:103,title:'Immobilier',category:'Investissement',image:'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80',description:'Préparer des investissements durables et collectifs.'},
    {id:104,title:'Technologie et communication',category:'Innovation',image:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',description:'Utiliser le numérique pour valoriser les activités du groupe.'}
  ]
}, null, 2));
function readDB(){ try{return JSON.parse(fs.readFileSync(dbFile,'utf8'));}catch{return {activities:[],projects:[]};}}
function writeDB(db){fs.writeFileSync(dbFile,JSON.stringify(db,null,2));}
const sessions = new Map();
function send(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
function readBody(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>2e6){reject(new Error('Contenu trop volumineux'));req.destroy();}});req.on('end',()=>{try{resolve(b?JSON.parse(b):{});}catch{reject(new Error('JSON invalide'));}});});}
function tokenFrom(req){const m=(req.headers.cookie||'').match(/d7u_session=([^;]+)/);return m?decodeURIComponent(m[1]):'';}
function authorized(req){const t=tokenFrom(req);return !!t&&sessions.has(t);}
function clean(s,max=5000){return String(s||'').trim().slice(0,max);}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/content') return send(res,200,readDB());
 if(req.method==='POST'&&url.pathname==='/api/login'){
  try{const b=await readBody(req);if(clean(b.username,80)!==ADMIN_USER||clean(b.password,200)!==ADMIN_PASSWORD)return send(res,401,{error:'Identifiants incorrects.'});
  const t=crypto.randomBytes(32).toString('hex');sessions.set(t,{created:Date.now()});res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`d7u_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});return res.end(JSON.stringify({ok:true}));}catch(e){return send(res,400,{error:e.message});}
 }
 if(req.method==='POST'&&url.pathname==='/api/logout'){const t=tokenFrom(req);sessions.delete(t);res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':'d7u_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});return res.end('{"ok":true}');}
 if(url.pathname.startsWith('/api/admin/')){
  if(!authorized(req))return send(res,401,{error:'Connexion administrateur requise.'});
  if(req.method==='POST'&&url.pathname==='/api/admin/save'){
   try{const b=await readBody(req), db=readDB();const kind=b.kind==='projects'?'projects':'activities';const item={title:clean(b.title,140),category:clean(b.category,80),description:clean(b.description,3000),image:clean(b.image,1000)};
    if(!item.title||!item.description)return send(res,400,{error:'Le titre et la description sont obligatoires.'});
    if(kind==='activities')item.date=clean(b.date,20)||new Date().toISOString().slice(0,10);
    const id=Number(b.id);if(id){const ix=db[kind].findIndex(x=>x.id===id);if(ix<0)return send(res,404,{error:'Publication introuvable.'});db[kind][ix]={...db[kind][ix],...item};}
    else {item.id=Date.now();db[kind].unshift(item);}
    writeDB(db);return send(res,200,{ok:true,content:db});
   }catch(e){return send(res,400,{error:e.message});}
  }
  if(req.method==='POST'&&url.pathname==='/api/admin/delete'){
   try{const b=await readBody(req),kind=b.kind==='projects'?'projects':'activities',db=readDB();db[kind]=db[kind].filter(x=>x.id!==Number(b.id));writeDB(db);return send(res,200,{ok:true,content:db});}catch(e){return send(res,400,{error:e.message});}
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/check')return send(res,200,{ok:true});
  return send(res,404,{error:'Route admin introuvable.'});
 }
 let pathname=decodeURIComponent(url.pathname);if(pathname==='/')pathname='/index.html';
 const file=path.normalize(path.join(PUBLIC,pathname));if(!file.startsWith(PUBLIC))return send(res,403,{error:'Interdit'});
 fs.readFile(file,(err,data)=>{if(err)return send(res,404,'Page introuvable','text/plain; charset=utf-8');const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};send(res,200,data.toString(),types[ext]||'application/octet-stream');});
});
server.listen(PORT,()=>console.log(`D7U disponible sur http://localhost:${PORT}\nAdmin: ${ADMIN_USER} | mot de passe par défaut: ${ADMIN_PASSWORD}`));
