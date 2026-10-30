import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function cmsSnapshot(root){
 const base=JSON.parse(fs.readFileSync(path.join(root,'data/content.json'))),seo=JSON.parse(fs.readFileSync(path.join(root,'data/seo.json'))),documents=[];
 const add=(kind,id,data)=>documents.push({kind,id,data});
 for(const kind of ['posts','pages','landing-pages','tags','faqs','seo']){const dir=path.join(root,'content',kind);if(fs.existsSync(dir))for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')))add(kind,file.slice(0,-5),JSON.parse(fs.readFileSync(path.join(dir,file))));}
 for(const data of base.categories)add('categories',data.slug,data);
 for(const data of seo.guides)add('guides',data.slug,data);
 const slugify=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').replace(/œ/g,'oe').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const tagNames=new Set(documents.filter(d=>d.kind==='tags').map(d=>d.data.title));
 for(const name of new Set(documents.filter(d=>d.kind==='posts').flatMap(d=>d.data.tags||[])))if(!tagNames.has(name))add('tags',slugify(name)||crypto.createHash('sha256').update(name).digest('hex').slice(0,12),{title:name,description:''});
 for(const [id,data] of Object.entries({site:base.site,home:seo.home,business:{businessDescription:seo.businessDescription,areas:seo.areas},aio:JSON.parse(fs.readFileSync(path.join(root,'data/aio.json')))}))add('settings',id,data);
 const media=[];const images=path.join(root,'web/assets/images');
 for(const filename of fs.readdirSync(images)){if(!/\.(jpe?g|png|webp|gif|avif)$/i.test(filename))continue;const buffer=fs.readFileSync(path.join(images,filename)),assetPath='assets/images/'+filename;media.push({id:crypto.createHash('sha256').update(assetPath).digest('hex').slice(0,24),path:assetPath,alt_text:documents.find(d=>d.data.image?.replace(/^\//,'')===assetPath)?.data.imageAlt||filename.replace(/[-_]/g,' '),bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')});}
 return {version:1,documents,media};
}
