import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {loadContent} from './content.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folderKinds=['posts','pages','landing-pages','tags','faqs','seo'];
export async function applySnapshot(repo,snapshot,{apiOrigin,fetchMedia=fetch}={}){
 if(snapshot.version!==1||!Array.isArray(snapshot.documents)||!Array.isArray(snapshot.media)||snapshot.documents.length>20000)throw new Error('Invalid CMS export.');
 const staging=fs.mkdtempSync(path.join(os.tmpdir(),'avecjo-sync-'));
 const timestamp=new Date().toISOString().replace(/[:.]/g,'-');
 const backup=path.join(repo,'.cms-backups',timestamp);
 try{
  fs.cpSync(path.join(repo,'data'),path.join(staging,'data'),{recursive:true});
  fs.cpSync(path.join(repo,'content'),path.join(staging,'content'),{recursive:true});
  for(const kind of folderKinds){fs.rmSync(path.join(staging,'content',kind),{force:true,recursive:true});fs.mkdirSync(path.join(staging,'content',kind),{recursive:true});}
  const base=JSON.parse(fs.readFileSync(path.join(staging,'data/content.json'))),seo=JSON.parse(fs.readFileSync(path.join(staging,'data/seo.json')));
  const categories=[],guides=[],identities=new Set();
  for(const item of snapshot.documents){
   if(!item||!item.data||!['posts','pages','landing-pages','categories','tags','faqs','seo','guides','settings'].includes(item.kind)||!/^[a-z0-9-]{1,120}$/.test(item.id))throw new Error('Invalid document in export.');
   const data=item.data;
   if(identities.has(item.kind+'/'+item.id))throw new Error('Duplicate CMS document.');identities.add(item.kind+'/'+item.id);
   if(folderKinds.includes(item.kind)){
    const filename=['posts','pages','landing-pages'].includes(item.kind)?data.slug:item.id;
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(filename))throw new Error('Unsafe content filename.');
    fs.writeFileSync(path.join(staging,'content',item.kind,filename+'.json'),JSON.stringify(data,null,2)+'\n');
   }else if(item.kind==='categories')categories.push(data);
   else if(item.kind==='guides')guides.push(data);
   else if(item.id==='site')base.site=data;
   else if(item.id==='home')seo.home=data;
   else if(item.id==='business'){seo.businessDescription=data.businessDescription;seo.areas=data.areas;}
   else if(item.id==='aio')fs.writeFileSync(path.join(staging,'data/aio.json'),JSON.stringify(data,null,2)+'\n');
   else throw new Error('Unknown settings document.');
  }
  if(!categories.length||!guides.length)throw new Error('Export is missing categories or guide sources.');
  base.categories=categories;seo.guides=guides;
  fs.writeFileSync(path.join(staging,'data/content.json'),JSON.stringify(base,null,2)+'\n');
  fs.writeFileSync(path.join(staging,'data/seo.json'),JSON.stringify(seo,null,2)+'\n');
  loadContent(staging); // Route and markup checks run before any real file changes.
  const downloaded=[];
  for(const media of snapshot.media){
   if(!/^assets\/images\/[A-Za-z0-9_.-]+\.(jpe?g|png|webp|gif|avif)$/i.test(media.path)||!/^[a-f0-9]{64}$/.test(media.sha256)||!Number.isInteger(Number(media.bytes))||Number(media.bytes)>5242880)throw new Error('Invalid image in export.');
   const local=path.join(repo,'web',media.path);
   if(fs.existsSync(local)&&crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex')===media.sha256)continue;
   if(!apiOrigin)throw new Error('Image download needs the configured API origin.');
   const response=await fetchMedia(new URL('/'+media.path,apiOrigin),{redirect:'error',signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw new Error('Image download failed: '+media.path);
   const buffer=Buffer.from(await response.arrayBuffer());
   if(buffer.length!==Number(media.bytes)||buffer.length>5242880||crypto.createHash('sha256').update(buffer).digest('hex')!==media.sha256)throw new Error('Image integrity failed: '+media.path);
   const file=path.join(staging,'media',path.basename(media.path));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buffer);downloaded.push({file,local});
  }
  fs.mkdirSync(backup,{recursive:true});
  for(const dir of ['content','data'])fs.cpSync(path.join(repo,dir),path.join(backup,dir),{recursive:true});
  for(const dir of ['content','data']){fs.rmSync(path.join(repo,dir),{recursive:true});fs.cpSync(path.join(staging,dir),path.join(repo,dir),{recursive:true});}
  for(const item of downloaded)fs.copyFileSync(item.file,item.local);
  return {documents:snapshot.documents.length,downloaded:downloaded.length,backup};
 }catch(error){if(fs.existsSync(path.join(backup,'data'))&&fs.existsSync(path.join(backup,'content')))for(const dir of ['data','content']){fs.rmSync(path.join(repo,dir),{recursive:true,force:true});fs.cpSync(path.join(backup,dir),path.join(repo,dir),{recursive:true});}throw error;}
 finally{fs.rmSync(staging,{recursive:true,force:true});}
}
async function main(){
 const config=JSON.parse(fs.readFileSync(path.join(root,'web/runtime-config.json')));
 if(!config.apiBaseUrl)throw new Error('Set the PA HTTPS API URL in web/runtime-config.json after buying hosting.');
 const api=new URL(config.apiBaseUrl);
 if(api.protocol!=='https:')throw new Error('CMS sync requires HTTPS.');
 const call=async(route,options={})=>{const url=new URL(api);url.searchParams.set('route',route);const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});const body=await r.json();if(!r.ok)throw new Error(body.error||'CMS API error.');return body;};
 let token=process.env.AVECJO_API_TOKEN;
 if(!token){
  if(!process.stdin.isTTY)throw new Error('Run in an interactive terminal or set AVECJO_API_TOKEN securely.');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});let hidden=false;const original=rl._writeToOutput.bind(rl);rl._writeToOutput=text=>{if(!hidden)original(text);};
  const ask=prompt=>new Promise(resolve=>rl.question(prompt,resolve));
  const identifier=await ask('Admin ID or email: ');process.stdout.write('Password: ');hidden=true;let password=await ask('');hidden=false;process.stdout.write('\n');rl.close();
  const auth=await call('auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password})});password='';token=auth.token;
 }
 try{const snapshot=await call('export',{headers:{Authorization:`Bearer ${token}`}});const result=await applySnapshot(root,snapshot,{apiOrigin:api.origin});console.log(`Synced ${result.documents} approved documents and ${result.downloaded} new images. Backup: ${result.backup}`);}
 finally{await call('auth/logout',{method:'POST',headers:{Authorization:`Bearer ${token}`}}).catch(()=>{});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
