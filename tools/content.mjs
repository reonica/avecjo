import fs from 'node:fs';
import path from 'node:path';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reserved = new Set(['admin', 'assets', 'content', 'data', 'tools', 'migration', 'blog', 'gfv', 'contact', 'photo', 'recherche', 'merci', 'sitemap', 'index', '404']);

export function validatePost(post, filename, data) {
  if (!slugPattern.test(post.slug || '') || reserved.has(post.slug)) throw new Error(`Invalid article slug: ${filename}`);
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
  // Publication is an owner-reviewed operation. Reject executable HTML even in a reviewed post.
  if (/<\s*(?:script|style|object|embed|iframe|svg|math|base|link|meta|form|input|button|textarea|template|noscript)\b|\bon[a-z]+\s*=/i.test(post.html)) throw new Error(`Active HTML is not allowed in ${filename}`);
  const decode = value => value.replace(/&#(?:x([0-9a-f]+)|(\d+));?/gi, (_, hex, decimal) => {
    const code = parseInt(hex || decimal, hex ? 16 : 10);
    return code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&(?:colon|tab|newline);/gi, match => match.toLowerCase() === '&colon;' ? ':' : '').replace(/[\u0000-\u0020\u007f]/g, '');
  for (const attribute of post.html.matchAll(/\b(?:href|src|poster|style)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const decoded = decode(attribute[1] ?? attribute[2] ?? attribute[3] ?? '');
    if (/^(?:javascript|vbscript|data):/i.test(decoded) || /(?:expression\(|url\(["']?(?:javascript|vbscript|data):)/i.test(decoded)) throw new Error(`Unsafe URL in ${filename}`);
  }
  return post;
}

export function loadContent(root) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/content.json'), 'utf8'));
  if (data.postsDirectory !== 'content/posts') throw new Error('Expected articles in content/posts');
  const directory = path.join(root, 'content/posts');
  const order = new Map((data.postOrder || []).map((slug, i) => [slug, i]));
  data.posts = fs.readdirSync(directory).filter(f => f.endsWith('.json')).map(filename => validatePost(JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8')), filename, data));
  data.posts.sort((a, b) => {
    const aOld = order.has(a.slug), bOld = order.has(b.slug);
    if (aOld !== bOld) return aOld ? 1 : -1;
    return aOld ? order.get(a.slug) - order.get(b.slug) : (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0) || a.slug.localeCompare(b.slug);
  });
  if (!data.posts.length) throw new Error('No articles found in content/posts');
  return data;
}
