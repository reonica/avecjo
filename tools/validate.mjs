/** Audit every local URL, image, original article body and migration route. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './content.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=loadContent(root);
const issues=[];
const warnings=[];
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(['node_modules','.git','.github','tools','migration','admin','content','docs','tests'].includes(e.name))return [];
  const f=path.join(dir,e.name);return e.isDirectory()?walk(f):[f];
});
const files=walk(root);
const htmlFiles=files.filter(f=>f.endsWith('.html'));
const unescape=s=>String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const plain=s=>unescape(String(s).replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
const targetFile=p=>{
  let decoded;try{decoded=decodeURIComponent(p);}catch{return null;}
  const candidate=path.join(root,decoded.replace(/^\//,''));
  if(!candidate.startsWith(root+path.sep)&&candidate!==root)return null;
  if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return candidate;
  if(fs.existsSync(path.join(candidate,'index.html')))return path.join(candidate,'index.html');
  return null;
};
let links=0,images=0,anchors=0;
for(const file of htmlFiles){
  const html=fs.readFileSync(file,'utf8');
  const route=path.relative(root,file).split(path.sep).join('/');
  const base=new URL(route,'https://audit.local/');
  if(!html.includes('<html lang="fr">'))issues.push({file:route,problem:'Missing French language declaration'});
  if(!/<meta name="viewport"/.test(html))issues.push({file:route,problem:'Missing responsive viewport'});
  if(!/<link rel="canonical"/.test(html))issues.push({file:route,problem:'Missing canonical URL'});
  if(/\bon(?:click|load|error|mouseover)\s*=/i.test(html))issues.push({file:route,problem:'Legacy inline event handler retained'});
  for(const match of html.matchAll(/\b(href|src|poster|action)=["']([^"']*)["']/g)){
    const [_,attr,raw]=match;
    const value=unescape(raw);
    if(!value||/^(?:mailto:|tel:|data:|https?:|\/\/)/i.test(value))continue;
    if(/^javascript:/i.test(value)){issues.push({file:route,url:value,problem:'Unsafe legacy URL'});continue;}
    let resolved;try{resolved=new URL(value,base);}catch{issues.push({file:route,url:value,problem:'Invalid URL'});continue;}
    const target=targetFile(resolved.pathname);
    if(!target){issues.push({file:route,url:value,problem:'Missing local target'});continue;}
    links++;
    if(attr==='src'&&/\.(?:png|jpe?g|webp|gif|svg)$/i.test(resolved.pathname))images++;
    if(resolved.hash&&target.endsWith('.html')){
      let id;try{id=decodeURIComponent(resolved.hash.slice(1));}catch{id=resolved.hash.slice(1);}
      const targetHtml=target===file?html:fs.readFileSync(target,'utf8');
      const ids=[...targetHtml.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>unescape(m[1]));
      if(!ids.includes(id))issues.push({file:route,url:value,problem:'Missing fragment anchor'});
      else anchors++;
    }
  }
}

let headings=0,tables=0,articleTextMatches=0;
for(const p of content.posts){
  const f=targetFile('/'+p.slug);
  if(!f){issues.push({url:p.url,problem:'Original article route missing'});continue;}
  const html=fs.readFileSync(f,'utf8');
  const body=html.match(/<article class="article-content">([\s\S]*?)<\/article>/)?.[1];
  if(body===undefined){issues.push({url:p.url,problem:'Original article body missing'});continue;}
  if(plain(body)!==plain(p.html))issues.push({url:p.url,problem:'Article text differs from migrated original'});
  else articleTextMatches++;
  headings+=(body.match(/<h[1-6]\b/g)||[]).length;
  tables+=(body.match(/<table\b/g)||[]).length;
  if(/<img[^>]+src=["']https?:\/\//.test(body))issues.push({url:p.url,problem:'Article image still remote'});
}

const manifest=JSON.parse(fs.readFileSync(path.join(root,'migration/url-manifest.json'),'utf8'));
const uniqueOriginalPaths=[...new Set(manifest.map(x=>new URL(x.sourceUrl).pathname))];
const endpointPaths=uniqueOriginalPaths.filter(p=>p.startsWith('/news/'));
const publicPaths=uniqueOriginalPaths.filter(p=>!p.startsWith('/news/'));
for(const p of publicPaths)if(!targetFile(p))issues.push({url:p,problem:'Original public URL missing'});
const redirects=fs.readFileSync(path.join(root,'_redirects'),'utf8');
for(const [p,local] of Object.entries(content.migration.assetAliases||{})){
  const pathname=p.startsWith('http')?new URL(p).pathname:p;
  if(!redirects.includes(pathname+' '))issues.push({url:pathname,problem:'Old image URL rewrite missing'});
  if(!fs.existsSync(path.join(root,local.replace(/^\//,''))))issues.push({url:pathname,problem:'Image alias destination missing'});
}
for(const local of new Set(Object.values(content.assets))){
  if(!fs.existsSync(path.join(root,local)))issues.push({url:local,problem:'Migrated image missing'});
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
const sitemapUrls=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>unescape(m[1]));
for(const url of sitemapUrls)if(!targetFile(new URL(url).pathname))issues.push({url,problem:'XML sitemap route missing'});
if(new Set(sitemapUrls).size!==sitemapUrls.length)issues.push({problem:'Duplicate XML sitemap entries'});
for(const c of content.categories){
  const html=fs.readFileSync(targetFile('/'+c.slug),'utf8');
  const presentation=html.match(/<details class="archive-description">[\s\S]*?<\/summary>([\s\S]*?)<\/details>/)?.[1];
  if(plain(presentation)!==plain(c.descriptionHtml || c.description))issues.push({url:c.url,problem:'Category presentation differs from original'});
}
if(!fs.readFileSync(path.join(root,'404.html'),'utf8').includes('<base href="/">'))issues.push({problem:'404 needs a root base for nested unknown URLs'});

const hosting=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'),'utf8')).hosting;
if(hosting.public!=='.' || hosting.trailingSlash!==false || hosting.cleanUrls!==true)issues.push({problem:'Firebase URL format does not match the original site'});
if(hosting.rewrites.some(r=>r.source==='**' || r.source==='/**'))issues.push({problem:'Firebase catch-all would hide missing pages'});
for(const rule of hosting.rewrites)if(!targetFile(rule.destination))issues.push({url:rule.source,problem:'Firebase rewrite destination missing'});
const buildManifest=JSON.parse(fs.readFileSync(path.join(root,'migration/build-manifest.json'),'utf8'));
for(const route of buildManifest.routes.filter(r=>r!=='/'))if(!hosting.rewrites.some(r=>r.source===route && r.destination===route+'/index.html'))issues.push({url:route,problem:'Firebase page rewrite missing'});
for(const [source,target] of Object.entries(content.migration.aliases || {})){
  const oldPath=new URL(source).pathname.replace(/\/$/,'');
  const destination=new URL(target).pathname;
  for(const route of [oldPath,oldPath+'/'])if(!hosting.redirects.some(r=>r.source===route && r.destination===destination && r.type===301))issues.push({url:route,problem:'Firebase original redirect missing'});
}
for(const [source,target] of Object.entries(content.migration.assetAliases || {})){
  const oldPath=source.startsWith('http')?new URL(source).pathname:source;
  const destination='/'+target.replace(/^\//,'');
  if(!hosting.rewrites.some(r=>r.source===oldPath && r.destination===destination))issues.push({url:oldPath,problem:'Firebase original image rewrite missing'});
  const decodedPath=decodeURI(oldPath);
  if(!hosting.rewrites.some(r=>r.source===decodedPath && r.destination===destination))issues.push({url:oldPath,problem:'Firebase decoded image rewrite missing'});
}

const report={
  checkedAt:new Date().toISOString(),passed:issues.length===0,
  counts:{htmlFiles:htmlFiles.length,localReferences:links,imageReferences:images,validFragmentAnchors:anchors,originalPublicPaths:publicPaths.length,posts:content.posts.length,articleTextMatches,headings,tables,localImages:new Set(Object.values(content.assets)).size,xmlSitemapUrls:sitemapUrls.length,technicalApiPathsExcluded:endpointPaths.length,firebaseRewrites:hosting.rewrites.length,firebaseRedirects:hosting.redirects.length},
  sourceLimitations:content.migration.sourceLimitations,issues,warnings,
};
fs.writeFileSync(path.join(root,'migration/validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(issues.length)process.exitCode=1;
