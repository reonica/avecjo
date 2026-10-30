import fs from 'node:fs';
import path from 'node:path';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reserved = new Set(['admin', 'backend', 'api', 'dist', 'web', 'cms', 'server', 'assets', 'content', 'data', 'tools', 'migration', 'blog', 'gfv', 'circuits', 'contact', 'photo', 'recherche', 'merci', 'sitemap', 'index', '404', 'services', 'destinations', 'tours', 'video', 'galeries']);

export function validatePost(post, filename, data) {
  if (!slugPattern.test(post.slug || '') || reserved.has(post.slug) || (data.reservedRoutes||[]).includes(post.slug)) throw new Error(`Invalid article slug: ${filename}`);
  if ((data.landingPages||[]).some(p=>p.slug===post.slug))throw new Error('Article conflicts with landing page');
  if (filename !== `${post.slug}.json`) throw new Error(`Article filename must match slug: ${filename}`);
  if ([...(data.pages || []), ...(data.categories || []), ...(data.albums || [])].some(p => p.slug === post.slug)) throw new Error(`Article conflicts with an existing page: ${post.slug}`);
  for (const field of ['title', 'seoTitle', 'description', 'html', 'image', 'imageAlt', 'category']) {
    if (typeof post[field] !== 'string' || !post[field].trim()) throw new Error(`Missing ${field} in ${filename}`);
  }
  if (!(data.categories || []).some(c => c.slug === post.category)) throw new Error(`Unknown category in ${filename}`);
  if (!Array.isArray(post.tags) || post.tags.some(t => typeof t !== 'string' || !t.trim())) throw new Error(`Invalid tags in ${filename}`);
  for (const field of ['date', 'dateModified']) {
    if (post[field] && Number.isNaN(Date.parse(post[field]))) throw new Error(`Invalid ${field} in ${filename}`);
  }
  if (!/^\/?assets\/images\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png|webp|gif|avif)$/i.test(post.image) || post.image.split('/').includes('..')) throw new Error(`Use an image from assets/images in ${filename}`);
  validateMarkup(post.html, filename);
  return post;
}

export function validateMarkup(html, filename='page') {
  if(typeof html!=='string')throw new Error('Invalid HTML in '+filename);
  // Publication is an owner-reviewed operation. Reject executable HTML even in a reviewed post.
  if (/<\s*(?:script|style|object|embed|iframe|svg|math|base|link|meta|form|input|button|textarea|template|noscript)\b|\bon[a-z]+\s*=/i.test(html)) throw new Error(`Active HTML is not allowed in ${filename}`);
  const decode = value => value.replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_, hex, decimal) => {
    const code = parseInt(hex || decimal, hex ? 16 : 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&(?:colon|tab|newline);/gi, match => match.toLowerCase() === '&colon;' ? ':' : '').replace(/[\u0000-\u0020\u007f]/g, '');
  for (const attribute of html.matchAll(/\b(?:href|src|poster|style)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const decoded = decode(attribute[1] ?? attribute[2] ?? attribute[3] ?? '');
    if (/^(?:javascript|vbscript|data):/i.test(decoded) || /(?:expression\(|url\(["']?(?:javascript|vbscript|data):)/i.test(decoded)) throw new Error(`Unsafe URL in ${filename}`);
  }
}

export function loadContent(root) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/content.json'), 'utf8'));
  if (data.postsDirectory !== 'content/posts') throw new Error('Expected articles in content/posts');
  const readFolder = name => { const dir=path.join(root,'content',name); return fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))):[]; };
  data.pages = readFolder('pages'); data.landingPages = readFolder('landing-pages'); data.faqs = readFolder('faqs');
  data.pageSettings = Object.fromEntries(readFolder('seo').map(p=>{ if(typeof p.page!=='string'||p.page.startsWith('/')||p.page.includes('..'))throw new Error('Invalid SEO page');if(p.canonical&&!/^https:\/\/[^\s<>\"]+$/.test(p.canonical))throw new Error('Invalid canonical URL');return [p.page,p]; }));
  data.tagMetadata=readFolder('tags');
  const seoPath=path.join(root,'data/seo.json');
  const guideSlugs=fs.existsSync(seoPath)?JSON.parse(fs.readFileSync(seoPath,'utf8')).guides.map(g=>g.slug):[];
  data.reservedRoutes=guideSlugs;
  const publicRoutes=[...data.pages,...data.landingPages,...data.categories,...(data.albums||[])].map(p=>p.slug);
  if(new Set(publicRoutes).size!==publicRoutes.length)throw new Error('Duplicate public content route');
  for(const p of [...data.pages,...data.landingPages]){validateMarkup((p.html||'').replace(/<iframe src="https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]*" title="[^"<>]*" allowfullscreen loading="lazy"><\/iframe>/g,''),p.slug);if(!slugPattern.test(p.slug||'')||guideSlugs.includes(p.slug)||reserved.has(p.slug)&&!['destinations','tours','video','galeries'].includes(p.slug))throw new Error('Page route conflicts with a system route: '+p.slug);}

  for(const page of data.landingPages){
    if(!slugPattern.test(page.slug||'')||reserved.has(page.slug)||[...data.pages,...data.categories,...(data.albums||[])].some(p=>p.slug===page.slug))throw new Error('Invalid landing page route: '+page.slug);
    validatePost({...page,image:page.image||data.site.hero,imageAlt:page.imageAlt||page.title,category:page.category||data.categories[0].slug,tags:page.tags||[]},page.slug+'.json',{...data,pages:[],landingPages:[]});
  }
  const directory = path.join(root, 'content/posts');
  const order = new Map((data.postOrder || []).map((slug, i) => [slug, i]));
  data.posts = fs.readdirSync(directory).filter(f => f.endsWith('.json')).map(filename => validatePost(JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8')), filename, data));
  if(data.posts.some(p=>data.landingPages.some(l=>l.slug===p.slug)))throw new Error('Landing page conflicts with an article');
  data.posts.sort((a, b) => {
    const aOld = order.has(a.slug), bOld = order.has(b.slug);
    if (aOld !== bOld) return aOld ? 1 : -1;
    return aOld ? order.get(a.slug) - order.get(b.slug) : (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0) || a.slug.localeCompare(b.slug);
  });
  if (!data.posts.length) throw new Error('No articles found in content/posts');
  return data;
}
