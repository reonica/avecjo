/** Verify discoverability, visible keyword destinations and shared-link changes. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const seo=JSON.parse(fs.readFileSync(path.join(root,'data/seo.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'migration/build-manifest.json'),'utf8'));
const site=JSON.parse(fs.readFileSync(path.join(root,'data/content.json'),'utf8')).site;
const errors=[], titles=new Map(), descriptions=new Map();
const read=slug=>fs.readFileSync(path.join(root,slug,'index.html'),'utf8');
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
let structuredGraphs=0,indexablePages=0;
for(const route of manifest.routes){
  const slug=route.replace(/^\//,'');
  const html=read(slug);
  const canonical=html.match(/rel="canonical" href="([^"]+)"/)?.[1];
  const title=html.match(/<title>(.*?)<\/title>/)?.[1];
  const description=html.match(/name="description" content="([^"]*)"/)?.[1];
  if((html.match(/<h1\b/g)||[]).length!==1)errors.push({route,problem:'Expected one visible main heading'});
  if(!description||description.length>250)errors.push({route,problem:'Missing or excessively long description'});
  if(!html.includes('<a href="https://guidehanoi.com/">guide francophone nord vietnam</a>'))errors.push({route,problem:'Shared footer text or link incorrect'});
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || '{}');
  const graph=data['@graph'] || [];
  if(!graph.length)errors.push({route,problem:'Structured data graph missing'});
  else structuredGraphs++;
  const ids=new Set(graph.map(x=>x['@id']));
  if(ids.size!==graph.length)errors.push({route,problem:'Repeated structured data entity ID'});
  const page=graph.find(x=>['WebPage','ContactPage','CollectionPage'].includes(x['@type']));
  if(page?.url!==canonical)errors.push({route,problem:'Structured page URL differs from canonical'});
  const selfCanonical=canonical===site.domain+route;
  const noindex=html.includes('content="noindex,follow"');
  if(noindex && sitemap.includes(`<loc>${canonical}</loc>`))errors.push({route,problem:'Noindex URL is in XML sitemap'});
  if(!noindex&&selfCanonical){
    indexablePages++;
    if(!sitemap.includes(`<loc>${canonical}</loc>`))errors.push({route,problem:'Indexable canonical page missing from sitemap'});
    if(titles.has(title))errors.push({route,problem:'Duplicate indexable title',other:titles.get(title)});else titles.set(title,route);
    if(descriptions.has(description))errors.push({route,problem:'Duplicate indexable description',other:descriptions.get(description)});else descriptions.set(description,route);
  }
  const breadcrumbs=graph.find(x=>x['@type']==='BreadcrumbList');
  if(breadcrumbs)for(const [i,item] of breadcrumbs.itemListElement.entries())if(item.position!==i+1 || !item.item.startsWith(site.domain+'/'))errors.push({route,problem:'Invalid breadcrumb structure'});
}
const home=read('');
if(!home.includes('Rencontres, culture et voyages sur mesure avec <a class="hero-guide-link" href="https://guidehanoi.com/">guide francophone Vietnam</a> Joseph.'))errors.push({route:'/',problem:'Requested hero text or link incorrect'});
for(const g of seo.guides){
  const html=read(g.slug);
  if(html.includes('content="noindex,follow"'))errors.push({route:g.slug,problem:'Guide page excluded from index'});
  if(!html.includes('"@type":"Service"'))errors.push({route:g.slug,problem:'Visible service has no Service data'});
  for(const faq of g.faq)if(!html.includes(faq.question.replace(/&/g,'&amp;').replace(/'/g,'&#39;')))errors.push({route:g.slug,problem:'Visible question missing'});
}
for(const item of seo.keywordMap)if(!manifest.routes.includes('/'+item.slug))errors.push({keyword:item.keyword,problem:'Keyword target route missing'});
const report={checkedAt:new Date().toISOString(),passed:errors.length===0,counts:{structuredGraphs,indexablePages,guidePages:seo.guides.length,keywordTargets:seo.keywordMap.length},keywordTargets:seo.keywordMap,errors};
fs.writeFileSync(path.join(root,'migration/seo-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
