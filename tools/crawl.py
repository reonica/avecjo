#!/usr/bin/env python3
"""Read-only Guidehanoi migration. Cached source responses are retained for audit."""
import concurrent.futures as cf
import datetime as dt
import hashlib
import html as stdhtml
import json
import re
import subprocess
import time
import unicodedata
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote, quote, urlencode
from lxml import html, etree

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'guidehanoi'
WORK = ROOT / 'work/guidehanoi-migration'
CACHE = WORK / 'cache'
IMAGES = SITE / 'assets/images'
BASE = 'https://www.guidehanoi.com'
for p in (CACHE, IMAGES, SITE / 'data'):
    p.mkdir(parents=True, exist_ok=True)
ERRORS = []
FETCHES = {}
URLS = set()
ASSETS = {}
REQUESTS = {}

class MissingFetch(Exception): pass

def curl_queue():
    """Network execution is performed separately through approved curl tool calls."""
    jobs=[]; config=['parallel','parallel-max = 5']
    for u,binary in sorted(REQUESTS.items()):
        key=hashlib.sha256(u.encode()).hexdigest()[:20]
        dest=CACHE/(key+('.bin' if binary else '.response'))
        safe_url=quote(u,safe=':/?=&%#,+;@()!')
        config.extend(['silent','show-error','location','retry = 2','retry-delay = 1','max-time = 45','user-agent = "Mozilla/5.0 GuidehanoiMigration/1.0"','url = '+json.dumps(safe_url),'output = '+json.dumps(str(dest)),'write-out = "%{json}\\n"','next'])
        jobs.append({'url':u,'binary':binary,'path':str(dest)})
    if config[-1]=='next': config.pop()
    (WORK/'curl-jobs.conf').write_text('\n'.join(config)+'\n')
    dump(WORK/'curl-jobs.json',jobs)
    print('NEEDS_FETCH',len(jobs),str(WORK/'curl-jobs.conf'),flush=True)

def ingest_curl_log():
    jobsfile=WORK/'curl-jobs.json'; logfile=WORK/'curl-results.jsonl'
    if not jobsfile.exists() or not logfile.exists(): return
    jobs={x['path']:x for x in json.loads(jobsfile.read_text())}
    for line in logfile.read_text().splitlines():
        try:
            v=json.loads(line); job=jobs.get(v.get('filename_effective'))
            if not job: continue
            info={'url':job['url'],'status':v.get('http_code',0),'finalUrl':v.get('url_effective',job['url']),'contentType':v.get('content_type') or '', 'bytes':v.get('size_download',0),'curlExit':v.get('exitcode',0)}
            key=hashlib.sha256(job['url'].encode()).hexdigest()[:20]
            dump(CACHE/(key+'.json'),info)
        except Exception: pass

def dump(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def norm(url):
    url = urljoin(BASE + '/', stdhtml.unescape(url)).replace('\\/', '/')
    p = urlparse(url)
    if p.hostname not in ('guidehanoi.com', 'www.guidehanoi.com'):
        return None
    if not p.path or p.path == '/':
        return BASE + ('?' + p.query if p.query else '/')
    return BASE + unquote(p.path).rstrip('/') + ('?' + p.query if p.query else '')

def fetch(url, binary=False):
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    path = CACHE / (key + ('.bin' if binary else '.response'))
    meta = CACHE / (key + '.json')
    if path.exists() and meta.exists():
        info = json.loads(meta.read_text())
        FETCHES[url] = info
        return path.read_bytes(), info
    REQUESTS[url]=binary
    raise MissingFetch(url)

def docdata(blob):
    doc = html.fromstring(blob)
    ds = doc.xpath('//textarea[contains(@class,"w30s-content-data-page")]')
    data = json.loads(ds[0].text) if ds else {}
    return doc, data

def objects(value):
    if isinstance(value, dict):
        yield value
        for v in value.values():
            yield from objects(v)
    elif isinstance(value, list):
        for v in value:
            yield from objects(v)

def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, dict):
        for v in value.values(): yield from strings(v)
    elif isinstance(value, list):
        for v in value: yield from strings(v)

def internal_urls(doc, data):
    found = set()
    for u in doc.xpath('//a/@href'):
        n=norm(u)
        if n: found.add(n)
    for o in objects(data):
        if o.get('seo_name') and isinstance(o['seo_name'],str) and not o['seo_name'].startswith('#'):
            found.add(BASE + '/' + o['seo_name'].lstrip('/'))
        for k in ('url','link_url'):
            if isinstance(o.get(k),str):
                n=norm(o[k])
                if n: found.add(n)
    for s in strings(data):
        if '<a' in s:
            try:
                d=html.fragment_fromstring(s,create_parent='div')
                for u in d.xpath('.//a/@href'):
                    n=norm(u)
                    if n: found.add(n)
            except Exception: pass
    return {u for u in found if not any(x in u for x in ('{{','datafiles','javascript','/assets/','/images/','/undefined'))}

def plain(s):
    if not s: return ''
    try: return ' '.join(html.fragment_fromstring(str(s),create_parent='div').text_content().split())
    except Exception: return str(s)

def iso(n):
    try:
        n=int(n)
        return dt.datetime.fromtimestamp(n,dt.timezone.utc).isoformat().replace('+00:00','Z') if n>0 else ''
    except Exception: return ''

def slugify(s):
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')[:90]

def imgurls(fragment):
    out=set()
    if not fragment: return out
    try:
        d=html.fragment_fromstring(fragment,create_parent='div')
        for e in d.iter():
            for key in ('src','data-src','poster','href'):
                u=e.get(key,'')
                if u and ('datafiles/' in u or re.search(r'\.(jpg|jpeg|png|webp|gif|svg)(?:[?]|$)',u,re.I)):
                    out.add(urljoin(BASE+'/',u))
            if e.get('srcset'):
                for item in e.get('srcset').split(','):
                    out.add(urljoin(BASE+'/',item.strip().split()[0]))
            for u in re.findall(r'url\([\"\x27]?([^\)\"\x27]+)',e.get('style','')):
                out.add(urljoin(BASE+'/',u))
    except Exception: pass
    return {u for u in out if u.startswith('http')}

def clean(fragment):
    if not fragment: return ''
    try: d=html.fragment_fromstring(fragment,create_parent='div')
    except Exception: return '<p>'+stdhtml.escape(str(fragment))+'</p>'
    for e in list(d.iter()):
        if not isinstance(e.tag,str): continue
        if e.tag in ('script','style','textarea','object','embed','form','input','button'):
            e.drop_tree(); continue
        if e.tag=='iframe':
            src=e.get('src','')
            if not any(x in src for x in ('youtube.com/embed','youtube-nocookie.com/embed','vimeo.com/video')):
                e.drop_tree(); continue
            e.set('loading','lazy'); e.set('title',e.get('title') or 'Vidéo du Vietnam')
        for k in list(e.attrib):
            if k.lower().startswith('on') or k in ('style','class','data-cke-saved-src','data-cke-saved-href','data-widget-unique','contenteditable'):
                del e.attrib[k]
        if e.tag in ('img','source'):
            src=e.get('data-src') or e.get('src')
            if src:
                u=urljoin(BASE+'/',src)
                e.set('src','/'+ASSETS[u] if u in ASSETS else u)
            if e.get('srcset'):
                items=[]
                for item in e.get('srcset').split(','):
                    parts=item.strip().split(); u=urljoin(BASE+'/',parts[0]); parts[0]='/'+ASSETS[u] if u in ASSETS else u; items.append(' '.join(parts))
                e.set('srcset',', '.join(items))
            e.attrib.pop('data-src',None)
            e.set('loading','lazy')
        if e.tag=='a' and e.get('href'):
            u=e.get('href')
            if u.startswith('#'): continue
            n=norm(u)
            if n:
                p=urlparse(u); e.set('href',urlparse(n).path+('?' + urlparse(n).query if urlparse(n).query else '')+('#'+p.fragment if p.fragment else ''))
            elif u.lower().startswith('javascript:'): e.attrib.pop('href',None)
            elif u.startswith(('http://','https://')): e.set('rel','noopener noreferrer')
    return ''.join(etree.tostring(e,encoding='unicode',method='html') for e in d)

def local(u):
    return ASSETS.get(urljoin(BASE+'/',u or ''),'')

def save_asset(u):
    name=slugify(Path(unquote(urlparse(u).path)).stem) or 'image'
    ext=Path(urlparse(u).path).suffix.lower()
    if ext not in ('.jpg','.jpeg','.png','.webp','.gif','.svg','.avif'): ext='.jpg'
    dest=IMAGES/(name+'-'+hashlib.sha256(u.encode()).hexdigest()[:10]+ext)
    blob,info=fetch(u,True)
    if info['status']==200 and blob and ('image' in info['contentType'] or ext=='.svg'):
        dest.write_bytes(blob)
        return u,'assets/images/'+dest.name
    ERRORS.append({'url':u,'status':info['status'],'error':'Image did not return a valid image response'})
    return u,None

def main():
    started=time.time()
    sitemap,sm_info=fetch(BASE+'/sitemap.xml')
    (WORK/'source-sitemap.xml').write_bytes(sitemap)
    robot,_=fetch(BASE+'/robots.txt'); (WORK/'source-robots.txt').write_bytes(robot)
    sd=etree.fromstring(sitemap)
    sitemap_urls={norm(x.text) for x in sd.xpath('//*[local-name()="loc"]')}
    sitemap_urls.discard(None)
    URLS.update(sitemap_urls)
    URLS.add(BASE+'/photo')
    pages={}; api_items=[]; api_urls=[]
    todo=set(URLS)
    # Sitemap + recursively discovered public paths. Query routes are inventoried separately.
    with cf.ThreadPoolExecutor(max_workers=5) as pool:
        while todo:
            batch=sorted(u for u in todo if u not in pages and not urlparse(u).query)
            todo=set()
            if not batch: break
            fs={pool.submit(fetch,u):u for u in batch}
            for f in cf.as_completed(fs):
                u=fs[f]
                blob,info=f.result()
                if info['status']!=200: pages[u]={'error':info}; continue
                try:
                    d,v=docdata(blob)
                    found=internal_urls(d,v); URLS.update(found)
                    todo.update(x for x in found if x not in pages and not urlparse(x).query and not x.endswith('/sitemap.xml'))
                    pages[u]={'data':v,'doc':d,'meta':info}
                except Exception as ex:
                    pages[u]={'error':info}; ERRORS.append({'url':u,'error':'Parse: '+str(ex)})
                if len(pages)%20==0: print('PAGE',len(pages),u,flush=True)
            if len(pages)>350:
                ERRORS.append({'error':'Crawl safety bound reached: review pending paths','pending':sorted(todo)}); break
    # Public blog JSON pagination is explicitly linked from the rendered blog.
    api1=BASE+'/news/index-v3-json?widget_id=16291568&limit=12&page=1'
    b,inf=fetch(api1); j=json.loads(b)
    api_total=int(j.get('paging',{}).get('total_page',1))
    api_requests=[BASE+'/news/index-v3-json?'+urlencode({'widget_id':16291568,'limit':12,'page':p}) for p in range(1,api_total+1)]
    with cf.ThreadPoolExecutor(max_workers=5) as pool:
        results=list(pool.map(fetch,api_requests))
    for u,(blob,inf) in zip(api_requests,results):
        v=json.loads(blob); api_items.extend(v.get('items',[])); api_urls.append(u); URLS.add(u)
        for o in v.get('items',[]):
            if o.get('seo_name'): URLS.add(BASE+'/'+o['seo_name'])
    for u in sorted(URLS-set(pages)):
        if urlparse(u).query: continue
        b,info=fetch(u)
        try:
            d,v=docdata(b); pages[u]={'data':v,'doc':d,'meta':info}
        except Exception as ex: ERRORS.append({'url':u,'error':'Parse: '+str(ex)})
    dump(WORK/'page-summary.json',[{'url':u,'status':p.get('meta',p.get('error',{})).get('status'),'type':p.get('data',{}).get('type_page'),'title':p.get('data',{}).get('name') or p.get('data',{}).get('title_page'),'contentChars':len(p.get('data',{}).get('content') or '')} for u,p in sorted(pages.items())])
    dump(WORK/'api-items.json',api_items)
    print('DISCOVERY',json.dumps({'sitemap':len(sitemap_urls),'publicPaths':len(pages),'apiPosts':len(api_items),'urls':len(URLS)},ensure_ascii=False),flush=True)
    dump(WORK/'raw-page-data.json',{u:p.get('data',{}) for u,p in pages.items()})

    images=set(); records=[]; album_records=[]; category_records=[]; other_records=[]; query_routes=set()
    known_cates={'circuits-vietnam','incontournables-vietnam','conseils-voyage'}
    for u,p in sorted(pages.items()):
        if 'data' not in p: continue
        v=p['data']; d=p['doc']; slug=urlparse(u).path.strip('/'); typ=v.get('type_page')
        content=v.get('content') or ''
        if v.get('image_list'):
            photos=[]
            for photo in v['image_list']:
                if isinstance(photo,dict) and photo.get('image_url'):
                    photos.append('<figure><img src="'+stdhtml.escape(photo['image_url'],quote=True)+'" alt="'+stdhtml.escape(v.get('name') or '',quote=True)+'" loading="lazy"></figure>')
            if photos: content+='<div class="legacy-gallery">'+''.join(photos)+'</div>'
        if v.get('link_youtube') and str(v['link_youtube']).startswith(('https://www.youtube.com/embed/','https://www.youtube-nocookie.com/embed/')):
            content += '<div class="video-embed"><iframe src="'+stdhtml.escape(v['link_youtube'],quote=True)+'" title="'+stdhtml.escape(v.get('name') or 'Vidéo du Vietnam',quote=True)+'" allowfullscreen loading="lazy"></iframe></div>'
        title=v.get('name') or v.get('title_page') or (d.xpath('//title/text()') or ['Avec Jo'])[0]
        canonical=(d.xpath('//link[@rel="canonical"]/@href') or [u])[0]
        desc=plain(v.get('meta_desc') or v.get('desc') or v.get('category_desc') or (d.xpath('//meta[@name="description"]/@content') or [''])[0])
        image=v.get('image_url') or v.get('category_image_url') or (d.xpath('//meta[@property="og:image"]/@content') or [''])[0]
        images.update(imgurls(content))
        if image: images.add(urljoin(BASE+'/',image))
        for tag in v.get('tags') or []:
            if isinstance(tag,str): query_routes.add(BASE+'/blog?keyword='+quote(tag))
        links=[]; seenlinks=set()
        for o in objects(v):
            child=o.get('seo_name'); childtitle=o.get('name')
            if child and childtitle and child!=slug and child not in ('photo','blog','contact') and not child.startswith('#') and child not in seenlinks:
                seenlinks.add(child); links.append({'slug':child,'title':childtitle,'image':o.get('image_url',''),'description':plain(o.get('desc'))})
        record={'slug':slug,'url':'/'+slug if slug else '/','title':title,'seoTitle':v.get('meta_title') or (d.xpath('//title/text()') or [title])[0],'description':desc,'image':image,'imageAlt':title,'html':content,'sourceUrl':u,'originalCanonical':canonical,'date':iso(v.get('date_created_format')),'dateModified':iso(v.get('date_update')),'tags':v.get('tags') if isinstance(v.get('tags'),list) else [],'sourceType':typ,'sourceId':v.get('id'),'links':links,'sourceHasBody':bool(content)}
        if norm(p['meta']['finalUrl'])!=norm(u): continue
        crumbs=v.get('breadscrumb',[])
        record['category']=next((urlparse(c.get('url','')).path.strip('/') for c in reversed(crumbs) if urlparse(c.get('url','')).path.strip('/') in known_cates),'incontournables-vietnam')
        if typ==7 and content:
            records.append(record)
        elif typ in (9,10,11) or slug in ('photo','photos-clients-avec-jo','photos-incontournables-vietnam','centre-ville-hanoi','chute-d-eau-ha-giang','diner-chez-l-habitant-ha-giang','aeroport-de-hanoi','rue-du-train-hanoi','trek-a-sapa'):
            items=[]
            album_objects=[v] if typ==11 else objects(v)
            for o in album_objects:
                if 'album_photos' in o:
                    if o.get('image_url'): items.append({'src':o['image_url'],'alt':o.get('name') or title,'caption':o.get('name') or title})
                    for ph in o.get('album_photos') or []:
                        if isinstance(ph,str): items.append({'src':ph,'alt':title,'caption':''})
                        elif isinstance(ph,dict):
                            src=ph.get('image_url') or ph.get('url') or ph.get('src') or ph.get('photo')
                            if src: items.append({'src':src,'alt':ph.get('name') or title,'caption':ph.get('name') or ph.get('caption') or ''})
            # Album detail JSON can expose images separately.
            for e in ([] if typ==11 else d.xpath('//*[@data-src or @src]')):
                src=e.get('data-src') or e.get('src','')
                if '/client-avec-jo/' in src: items.append({'src':urljoin(BASE+'/',src),'alt':title,'caption':''})
            dedup={urljoin(BASE+'/',x['src']):x for x in items}
            if image and '/client-avec-jo/' in image and image not in dedup: dedup[image]={'src':image,'alt':title,'caption':title}
            items=list(dedup.values())
            for x in items: images.add(urljoin(BASE+'/',x['src']))
            record['images']=items; record['kind']='album' if typ==11 else 'gallery'; album_records.append(record)
        elif slug in known_cates or (typ==6 and slug not in ('blog','recherche')):
            record['kind']='category'; record['featured']=slug in known_cates; record['descriptionHtml']=v.get('category_desc') or v.get('desc') or ''; category_records.append(record)
        elif slug not in ('','blog','contact','recherche'):
            # Legacy tour / destination / video pages remain at their existing URL.
            if not content:
                meaningful=[]
                for o in objects(v):
                    if o.get('seo_name')==slug and o.get('content'): meaningful.append(o['content'])
                if meaningful: record['html']=max(meaningful,key=len)
            record['kind']='legacy'; other_records.append(record)
    # Pick complete original article records; API is a second completeness source.
    byslug={r['slug']:r for r in records}
    for v in api_items:
        slug=v.get('seo_name','')
        if slug and slug not in byslug:
            r={'slug':slug,'url':'/'+slug,'title':v.get('name',''),'description':plain(v.get('meta_desc') or v.get('desc')),'category':'incontournables-vietnam','date':iso(v.get('date_created_format')),'dateModified':iso(v.get('date_update')),'image':v.get('image_url',''),'imageAlt':v.get('name',''),'tags':v.get('tags') if isinstance(v.get('tags'),list) else [],'html':v.get('content',''),'sourceUrl':BASE+'/'+slug,'originalCanonical':BASE+'/'+slug,'sourceType':7,'sourceId':v.get('id')}
            byslug[slug]=r; images.update(imgurls(r['html'])); images.add(r['image'])
    records=list(byslug.values())
    # Brand and feedback assets from the real home page, including CSS hero slides.
    home=pages.get(BASE+'/',{}).get('data',{})
    logo=home.get('company_logo') or BASE+'/datafiles/88364/upload/files/avec-jo/logo-Avec-JO.png?t=1771860860'
    hero=BASE+'/datafiles/88364/upload/images/banner-jo/1440-810-3-cantho-vietnam.jpg?t=1771863583'
    images.update((logo,hero))
    for p in pages.values():
        v=p.get('data',{}); d=p.get('doc')
        for o in objects(v):
            for key in ('image_url','image_thumb_url'):
                src=o.get(key)
                if isinstance(src,str) and src and key=='image_url': images.add(urljoin(BASE+'/',src))
        if d is not None and p is pages.get(BASE+'/'):
            for src in d.xpath('//*[@data-src]/@data-src'):
                if '/banner-jo/' in src or '/client-avec-jo/' in src: images.add(urljoin(BASE+'/',src))
    images.discard('')
    print('IMAGES',len(images),flush=True)
    missing=[]
    for u in sorted(images):
        key=hashlib.sha256(u.encode()).hexdigest()[:20]
        if not (CACHE/(key+'.bin')).exists() or not (CACHE/(key+'.json')).exists():
            REQUESTS[u]=True; missing.append(u)
    if missing: raise MissingFetch(missing[0])
    with cf.ThreadPoolExecutor(max_workers=5) as pool:
        for i,(u,path) in enumerate(pool.map(save_asset,sorted(images)),1):
            if path: ASSETS[u]=path
            if i%15==0: print('IMAGE',i,'/',len(images),flush=True)
    for group in (records,album_records,category_records,other_records):
        for r in group:
            r['html']=clean(r.get('html','')); r['image']=local(r.get('image'))
            if 'descriptionHtml' in r: r['descriptionHtml']=clean(r['descriptionHtml'])
            for link in r.get('links',[]): link['image']=local(link.get('image'))
            if 'images' in r:
                for x in r['images']: x['src']=local(x['src'])
                r['images']=[x for x in r['images'] if x['src']]
                if not r['image'] and r['images']: r['image']=r['images'][0]['src']
    records.sort(key=lambda x:x.get('dateModified') or x.get('date') or '',reverse=True)
    category_records.sort(key=lambda r:(0 if r['slug'] in known_cates else 1,r['slug']))
    query_routes.update(u for u in URLS if urlparse(u).query)
    URLS.update(query_routes)
    redirects={u:p['meta']['finalUrl'] for u,p in pages.items() if 'meta' in p and norm(p['meta']['finalUrl'])!=norm(u)}
    source_limitations=[]
    for u,p in sorted(pages.items()):
        if p.get('error'): source_limitations.append({'url':u,'status':p['error'].get('status'),'reason':'Source route requires a search query or redirects without query; preserve search compatibility.'})
    for r in album_records:
        if not r.get('images'): source_limitations.append({'url':r['sourceUrl'],'reason':'Original gallery has no public photos; no photos invented.'})
    asset_aliases={urlparse(u).path:'/'+path for u,path in ASSETS.items() if urlparse(u).hostname in ('guidehanoi.com','www.guidehanoi.com')}
    coverage={'sitemapUrlCount':len(sitemap_urls),'discoveredPathCount':len(pages),'discoveredUrlCount':len(URLS),'posts':len(records),'apiExpectedPosts':j.get('total'),'categories':len(category_records),'albums':len(album_records),'pages':len(other_records),'downloadedImages':len(ASSETS),'requestedImages':len(images),'errors':ERRORS,'sourceLimitations':source_limitations,'queryRoutes':sorted(query_routes),'aliases':redirects,'assetAliases':asset_aliases,'crawledAt':dt.datetime.now(dt.timezone.utc).isoformat(),'elapsedSeconds':round(time.time()-started),'coverageManifest':'migration/url-manifest.json'}
    data={'site':{'name':'Avec Jo','domain':BASE,'email':home.get('company_email','goavecjo@gmail.com'),'phone':home.get('company_phone','+84916882795'),'whatsapp':'https://wa.me/84916882795','address':home.get('company_address','25 Nguyen Van Loc, Ha Dong, Hanoi'),'logo':local(logo),'hero':local(hero),'description':'Guide francophone Vietnam — Chaque voyage, une expérience unique','social':{'facebook':'https://facebook.com/josvu19','youtube':'https://www.youtube.com/@Guidefrancophonevietnam','pinterest':'https://fr.pinterest.com/goavecjo/','tiktok':'https://www.tiktok.com/@josvu19','instagram':'https://instagram.com/josvu19'}},'categories':category_records,'posts':records,'albums':album_records,'pages':other_records,'assets':ASSETS,'migration':coverage}
    dump(SITE/'data/content.json',data)
    out=SITE/'migration'; out.mkdir(exist_ok=True)
    manifest=[]
    kind={r['sourceUrl']:'post' for r in records}|{r['sourceUrl']:'album' for r in album_records}|{r['sourceUrl']:'category' for r in category_records}|{r['sourceUrl']:'page' for r in other_records}
    for u in sorted(URLS):
        pp=urlparse(u); source=pages.get(u,{}); meta=source.get('meta',source.get('error',{})); path=pp.path or '/'
        route=path+('?' + pp.query if pp.query else '')
        target=('/blog?page='+str(dict(__import__('urllib.parse',fromlist=['parse_qsl']).parse_qsl(pp.query)).get('page',1))) if path=='/news/index-v3-json' else route
        manifest.append({'sourceUrl':u,'path':route,'target':target,'kind':kind.get(u,'query' if pp.query else 'core'),'inSitemap':u in sitemap_urls,'sourceStatus':meta.get('status'),'sourceCanonical':(source.get('doc').xpath('//link[@rel="canonical"]/@href') or [None])[0] if source.get('doc') is not None else None,'strategy':'query-compatible' if pp.query else 'same-path'})
    dump(out/'url-manifest.json',manifest); dump(out/'coverage.json',coverage); dump(out/'asset-manifest.json',ASSETS)
    checks=[]
    for r in records:
        original=pages.get(r['sourceUrl'],{}).get('data',{}).get('content','')
        body=html.fragment_fromstring(r['html'],create_parent='div')
        sourcebody=html.fragment_fromstring(original,create_parent='div') if original else body
        checks.append({'slug':r['slug'],'sourceBodyChars':len(original),'migratedBodyChars':len(r['html']),'plainTextIdentical':plain(original)==plain(r['html']),'sourceTextSha256':hashlib.sha256(plain(original).encode()).hexdigest(),'migratedTextSha256':hashlib.sha256(plain(r['html']).encode()).hexdigest(),'headings':len(body.xpath('.//h2|.//h3|.//h4')),'sourceHeadings':len(sourcebody.xpath('.//h2|.//h3|.//h4')),'tables':len(body.xpath('.//table')),'sourceTables':len(sourcebody.xpath('.//table')),'images':len(body.xpath('.//img')),'sourceImages':len(sourcebody.xpath('.//img'))})
    dump(out/'content-verification.json',checks)
    dump(WORK/'fetch-manifest.json',FETCHES)
    print('READY',json.dumps(coverage,ensure_ascii=False),flush=True)

if __name__=='__main__':
    ingest_curl_log()
    try: main()
    except MissingFetch: curl_queue()
