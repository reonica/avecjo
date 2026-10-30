import http from 'node:http';
import {cmsSnapshot} from './cms-data.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.join(repo,'dist');
if(!fs.existsSync(root))throw new Error('Run npm run build first.');
const hosting=JSON.parse(fs.readFileSync(path.join(repo,'firebase.json'))).hosting;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.xml':'application/xml','.txt':'text/plain','.woff2':'font/woff2'};
http.createServer((req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let route=decodeURIComponent(url.pathname).replace(/\/$/,'')||'/';
 if(route==='/backend/demo-data.json'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(cmsSnapshot(repo)));return;}
 if(route==='/admin'||route.startsWith('/admin/')){res.writeHead(301,{Location:'/backend'});res.end();return;}
 if(route.startsWith('/backend/api')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Static preview: PHP API is not configured.'}));return;}
 const redirect=hosting.redirects.find(r=>r.source===url.pathname||r.source===route);if(redirect){res.writeHead(redirect.type,{Location:redirect.destination+url.search});res.end();return;}
 const rewrite=hosting.rewrites.find(r=>r.source===route||r.regex&&new RegExp(r.regex).test(route));
 let file=path.resolve(root,'.'+(rewrite?.destination||route));if(!file.startsWith(root+path.sep)&&file!==root)throw new Error('path');
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)&&fs.existsSync(file+'.html'))file+='.html';
 let status=200;if(!fs.existsSync(file)||/\.(php|sql)$/.test(file)||path.basename(file).startsWith('.')){status=404;file=path.join(root,'404.html');}
 res.writeHead(status,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end('Bad request');}}).listen(8787,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8787/backend'));
