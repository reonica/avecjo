/** Rebuild the ready-to-upload static site. No packages, network or credentials required. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { structuredData } from './seo.mjs';
import { loadContent } from './content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = loadContent(root);
const { site, posts, categories, albums, pages } = data;
const seo = JSON.parse(fs.readFileSync(path.join(root,'data/seo.json'),'utf8'));
const guides = new Map(seo.guides.map(g=>[g.slug,g]));
const domain = site.domain.replace(/\/$/, '');
const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const text = html => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const slugify = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const limit = (value, max = 170) => value.length > max ? value.slice(0, max).replace(/\s\S*$/, '') + '…' : value;
const bySlug = new Map([...posts, ...categories, ...albums, ...pages].map(p => [p.slug, p]));
const cat = slug => categories.find(c => c.slug === slug);
const tags = [...new Set(posts.flatMap(p => p.tags || []))].sort((a, b) => a.localeCompare(b, 'fr'));
const tagSlugs = new Map(tags.map(t => [t, slugify(t)]));
const generated = new Map();
const pageDate = new Date(data.migration.crawledAt).toISOString().slice(0, 10);
const phoneDisplay = '+84 916 882 795';
const assetVersion = filename => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,filename))).digest('hex').slice(0,12);
const styleVersion=assetVersion('style.css'), scriptVersion=assetVersion('script.js');
const icons = {
  arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>', left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  up: '<path d="M12 20V4M6 10l6-6 6 6"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L9 11a16 16 0 0 0 4 4l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
  pin: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  whatsapp: '<path d="M20.3 3.7A10 10 0 0 0 3.5 15.4L2 22l6.7-1.5A10 10 0 0 0 20.3 3.7Z"/><path d="M8 7.5c-.7 0-1.5 1.3-1.5 2.2 0 2.7 3.4 6.2 6.6 7 .9.2 2.5-.7 2.7-1.5.2-.8.1-.9-.4-1.1l-2-1-.8.9c-.4.3-2.9-1.8-2.7-2.2l.6-1-1.1-2.7c-.2-.5-.5-.6-1.4-.6Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
const rel = (slug, destination = '') => `${slug ? '../'.repeat(slug.split('/').filter(Boolean).length) : './'}${String(destination).replace(/^\/+/, '')}`;
const absolute = p => `${domain}/${String(p).replace(/^\/+/, '')}`;
const image = (p, slug, opts = '') => p ? `<img src="${esc(rel(slug, p.image || p.src || p))}" alt="${esc(p.imageAlt || p.alt || p.title || '')}" ${opts}>` : '';
const crumb = (slug, items) => `<nav class="breadcrumbs" aria-label="Fil d’Ariane"><ol><li><a href="${rel(slug)}">Accueil</a></li>${items.map(x => `<li aria-hidden="true">/</li><li>${x.slug !== undefined ? `<a href="${esc(rel(slug, x.slug))}">${esc(x.title)}</a>` : `<span aria-current="page">${esc(x.title)}</span>`}</li>`).join('')}</ol></nav>`;
const arrowLink = (slug, target, label, extra = '') => `<a class="text-link ${extra}" href="${esc(rel(slug, target))}">${esc(label)} ${icon('arrow')}</a>`;

function localizeHtml(html, slug) {
  return String(html || '').replace(/\b(href|src|poster)=(['"])(.*?)\2/gi, (match, name, q, original) => {
    let target = original.replace(/&amp;/g, '&');
    if (/^(?:mailto:|tel:|#|data:)/i.test(target)) return match;
    if (/^https?:\/\/(?:www\.)?guidehanoi\.com(?:\/|$)/i.test(target)) {
      const u = new URL(target);
      target = u.pathname + u.search + u.hash;
    } else if (/^(?:https?:)?\/\//i.test(target)) return match;
    if (target.startsWith('/') || target.startsWith('assets/')) return `${name}=${q}${esc(rel(slug, target))}${q}`;
    return match;
  });
}

function header(slug, active) {
  const nav = (target, label) => `<a href="${rel(slug, target)}"${active === target ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="site-header"><div class="header-inner container">
    <button class="mobile-menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-navigation" aria-label="Ouvrir le menu">${icon('menu')}</button>
    <nav class="desktop-nav header-left" aria-label="Navigation principale">${nav('', 'Accueil')}${nav('blog', 'Blog')}</nav>
    <a class="brand" href="${rel(slug)}" aria-label="Avec Jo — Accueil">${image({image: site.logo, imageAlt: 'Avec Jo'}, slug, 'width="50" height="50"')}</a>
    <nav class="desktop-nav header-right" aria-label="Photos et contact">${nav('photo', 'Photos')}${nav('contact', 'Contact')}<a class="button button-primary" href="${rel(slug, 'contact')}">Parlons de votre voyage</a></nav>
    <a class="mobile-contact" href="${rel(slug, 'contact')}" aria-label="Contacter Joseph">${icon('phone')}</a>
  </div><nav class="mobile-nav" id="mobile-navigation" aria-label="Navigation mobile" hidden>${nav('', 'Accueil')}${nav('blog', 'Blog')}${nav('photo', 'Photos')}${nav('contact', 'Contact')}${categories.map(c => nav(c.slug, c.title)).join('')}<a class="button button-primary" href="${rel(slug, 'contact')}">Préparer mon voyage ${icon('arrow')}</a></nav></header>`;
}

function footer(slug) {
  return `<footer class="site-footer"><div class="container"><div class="footer-grid">
    <div class="footer-brand"><a href="${rel(slug)}" aria-label="Avec Jo — Accueil">${image({image:site.logo,imageAlt:'Avec Jo'},slug,'width="80" height="80" loading="lazy"')}</a><div><strong>Avec Jo</strong><p><a href="https://guidehanoi.com/">guide francophone nord vietnam</a></p></div></div>
    <div class="footer-column"><h2>Explorer</h2><ul>${[['','Accueil'],['blog','Blog'],['photo','Photos'],['contact','Contact'],['guide-francophone-nord-vietnam','Voyager avec Jo'],['sitemap','Sitemap']].map(([p,l])=>`<li><a href="${rel(slug,p)}">${l}</a></li>`).join('')}</ul></div>
    <div class="footer-column"><h2>Le carnet de Jo</h2><ul>${['circuits-vietnam','incontournables-vietnam','conseils-voyage'].map(s=>`<li><a href="${rel(slug,s)}">${esc(cat(s)?.title || s)}</a></li>`).join('')}</ul></div>
    <div class="footer-column"><h2>Parlons de votre voyage</h2><ul><li><a href="mailto:${esc(site.email)}">${icon('mail')}${esc(site.email)}</a></li><li><a href="tel:${esc(site.phone)}">${icon('phone')}${phoneDisplay}</a></li><li><a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(site.address)}" target="_blank" rel="noopener">${icon('pin')}${esc(site.address)}</a></li><li><a href="${esc(site.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')}Écrire sur WhatsApp</a></li></ul></div>
  </div><div class="footer-bottom"><span>© ${pageDate.slice(0,4)} Avec Jo · Guidehanoi.com</span><a href="${rel(slug,'sitemap.xml')}">Sitemap XML</a><a href="${esc(site.social.instagram)}" target="_blank" rel="noopener">Instagram</a><a href="${esc(site.social.facebook)}" target="_blank" rel="noopener">Facebook</a><a href="${esc(site.social.youtube)}" target="_blank" rel="noopener">YouTube</a></div></div></footer>
  <a class="whatsapp-float" href="${esc(site.whatsapp)}" target="_blank" rel="noopener" aria-label="Écrire à Joseph sur WhatsApp">${icon('whatsapp')}</a><button id="back-to-top" type="button" aria-label="Revenir en haut de la page" hidden>${icon('up')}</button>`;
}

function layout(slug, title, description, content, options = {}) {
  const canonical = options.canonical || absolute(slug);
  const socialImage = absolute(options.image || site.hero);
  const metaDescription = limit(description || site.description,170);
  const json = JSON.stringify(structuredData({site,domain,slug,title,description:metaDescription,content,socialImage,schema:options.schema,seo,canonical})).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="google-site-verification" content="EG0k_SSw6viD3gRz9u1X2a4xlwSmV0OzG6IynJLq-pU"><meta name="msvalidate.01" content="27875A8864644FC1CCFED6E968BE47A0"><meta name="theme-color" content="#305977"><meta name="color-scheme" content="light"><title>${esc(title)}</title><meta name="description" content="${esc(metaDescription)}"><link rel="canonical" href="${esc(canonical)}"><meta name="robots" content="${options.noindex ? 'noindex,follow' : 'index,follow'}"><meta property="og:type" content="${options.article?'article':'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDescription)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(socialImage)}"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="Avec Jo"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="${esc(rel(slug,site.logo))}" type="image/png"><link rel="stylesheet" href="${rel(slug,'style.css')}?v=${styleVersion}"><link rel="alternate" type="application/rss+xml" title="Le carnet de Jo" href="${rel(slug,'rss.xml')}"><script type="application/ld+json">${json}</script><script src="${rel(slug,'script.js')}?v=${scriptVersion}" defer></script></head>
<body class="${esc(options.className || '')}"><a class="skip-link" href="#main-content">Aller au contenu</a>${header(slug,options.active ?? slug)}<main id="main-content" class="site-main">${content}</main>${footer(slug)}</body></html>\n`;
}

function save(slug, title, description, content, opts={}) {
  const html=layout(slug,title,description,content,opts);
  const dir=path.join(root,slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.html'),html);
  if(slug && !slug.includes('/')) {
    const oldFlatCopy=path.join(root,`${slug}.html`);
    if(fs.existsSync(oldFlatCopy)) fs.unlinkSync(oldFlatCopy);
  }
  generated.set(slug,{title,url:absolute(slug),noindex:!!opts.noindex,excludeFromSitemap:!!opts.excludeFromSitemap,lastmod:opts.lastmod || ''});
}

function card(p, slug, opts={}) {
  const c=cat(p.category);
  const description=p.description;
  const searchAttributes=opts.searchable?` data-category="${esc(p.category || '')}" data-tags="${esc(JSON.stringify(p.tags || []))}" data-search="${esc([p.title,p.description,...(p.tags||[]),text(p.html)].join(' '))}"`:'';
  return `<article class="post-card"${searchAttributes}><a href="${rel(slug,p.slug)}">${image(p,slug,'loading="lazy" decoding="async"')}<p class="eyebrow">${esc(c?.title || 'Le carnet de Jo')}</p><h2>${esc(p.title)}</h2></a>${description?`<p>${esc(limit(description))}</p>`:''}${arrowLink(slug,p.slug,'Lire l’article','coral')}</article>`;
}

function featured(p, slug) {
  if(!p) return '';
  const short=p.slug==='que-faire-a-hanoi-vietnam'?'30+ choses à faire à Hanoï':p.title;
  return `<article class="featured-article"><a class="featured-image" href="${rel(slug,p.slug)}">${image(p,slug,'loading="lazy" decoding="async"')}</a><div><p class="eyebrow">${esc(cat(p.category)?.title || 'Le carnet de Jo')}</p><h3><a href="${rel(slug,p.slug)}">${esc(short)}</a></h3><p>${esc(limit(p.description,190))}</p>${arrowLink(slug,p.slug,'Lire l’article','coral')}</div></article>`;
}

function home() {
  const feedbackOrder=['trek-a-sapa','rue-du-train-hanoi','aeroport-de-hanoi','diner-chez-l-habitant-ha-giang','chute-d-eau-ha-giang','centre-ville-hanoi'];
  const captions={'trek-a-sapa':'Sapa','rue-du-train-hanoi':'Rue du train','aeroport-de-hanoi':'À l’aéroport','diner-chez-l-habitant-ha-giang':'Chez l’habitant','chute-d-eau-ha-giang':'Ha Giang','centre-ville-hanoi':'Hanoï'};
  const positions={'trek-a-sapa':'50% 60%','rue-du-train-hanoi':'50% 65%','aeroport-de-hanoi':'45% 64%','diner-chez-l-habitant-ha-giang':'50% 70%','chute-d-eau-ha-giang':'50% 65%','centre-ville-hanoi':'50% 65%'};
  const topicImages={
    'circuits-vietnam':'assets/images/36-guide-voyage-puluong-2e1227fec1.jpg',
    'incontournables-vietnam':'assets/images/1440-810-45-halong-vietnam-e939a1f63f.jpg',
    'conseils-voyage':'assets/images/29-que-faire-a-hanoi-036c4cf549.jpg',
  };
  const lead=bySlug.get('que-faire-a-hanoi-vietnam') || posts[0];
  const small=['circuit-nord-vietnam','que-faire-au-vietnam','visite-pagode-tran-quoc-hanoi'].map(s=>bySlug.get(s)).filter(Boolean);
  save('',seo.home.title,seo.home.description,`
    <section class="hero" aria-label="Découvrir le Vietnam avec Joseph">${image({image:site.hero,imageAlt:'Un pêcheur lance son filet au lever du soleil au Vietnam'},'','class="hero-image" width="1440" height="810" fetchpriority="high"')}<div class="container hero-inner"><div class="hero-content"><p class="eyebrow">Guide francophone · Hanoï &amp; Vietnam</p><h1>Le Vietnam,<em>à votre rythme.</em></h1><p>Rencontres, culture et voyages sur mesure avec <a class="hero-guide-link" href="https://guidehanoi.com/">guide francophone Vietnam</a> Joseph.</p><div class="hero-actions"><a class="button button-primary" href="./contact">Préparer mon voyage ${icon('arrow')}</a>${arrowLink('','blog','Découvrir le blog')}</div></div></div></section>
    <section class="section feedback-section" aria-labelledby="feedback-title" data-carousel-container><div class="container"><div class="section-heading"><h2 id="feedback-title">Des rencontres, des souvenirs.</h2><p>Quelques moments partagés avec les voyageurs d’Avec Jo.</p></div><div class="feedback-track" data-carousel aria-label="Photos des voyageurs d’Avec Jo">${feedbackOrder.map(s=>{const a=bySlug.get(s);return a?`<figure class="feedback-card"><a href="${rel('',a.slug)}">${image(a,'',`loading="lazy" decoding="async" style="object-position:${positions[s]}"`)}<figcaption>${captions[s]}</figcaption></a></figure>`:'';}).join('')}</div><div class="carousel-controls"><button type="button" data-carousel-prev aria-label="Photos précédentes">${icon('left')}</button><button type="button" data-carousel-next aria-label="Photos suivantes">${icon('right')}</button></div>${arrowLink('','photo','Voir toutes les photos')}</div></section>
    <section class="section topics-section" aria-labelledby="topics-title" data-carousel-container><div class="container"><div class="section-heading"><h2 id="topics-title">Explorez le Vietnam selon <em>vos envies.</em></h2></div><div class="topics-track" data-carousel aria-label="Les trois thèmes du carnet de Jo">${['circuits-vietnam','incontournables-vietnam','conseils-voyage'].map(s=>{const c=cat(s);return `<a class="topic-card" href="${rel('',s)}">${image({image:topicImages[s] || c.image,imageAlt:c.title},'','loading="lazy" decoding="async"')}<h3>${esc(c.title)}</h3>${icon('arrow')}</a>`;}).join('')}</div><div class="home-guide-summary"><h3>Votre voyage, avec Jo.</h3><p>Joseph, guide francophone au Vietnam basé à Hanoï, échange avec vous pour préparer vos visites et votre parcours dans le nord.</p><nav class="guide-destination-links" aria-label="Accompagnement en français par destination">${seo.guides.filter(g=>g.slug!=='guide-francophone-vietnam').map(g=>`<a href="${rel('',g.slug)}">${esc(g.label)}</a>`).join('')}</nav></div></div></section>
    <section class="section journal-section" aria-labelledby="journal-title"><div class="container"><div class="section-heading"><h2 id="journal-title">Le carnet de Jo</h2>${arrowLink('','blog','Tous les articles')}</div>${featured(lead,'')}<div class="article-list">${small.map(p=>`<a class="article-row" href="${rel('',p.slug)}">${image(p,'','loading="lazy" decoding="async"')}<div><p class="eyebrow">${esc(cat(p.category)?.title || '')}</p><h3>${esc(p.slug==='que-faire-au-vietnam'?'Les incontournables du Vietnam':p.title)}</h3></div>${icon('arrow')}</a>`).join('')}</div></div></section>`,{
      active:'',image:site.hero,lastmod:seo.updatedOn,schema:{'@context':'https://schema.org','@type':'TravelAgency',name:'Avec Jo',url:domain,logo:absolute(site.logo),image:absolute(site.hero),telephone:site.phone,email:site.email,address:{'@type':'PostalAddress',streetAddress:'25 Nguyen Van Loc',addressLocality:'Ha Dong, Hanoi',addressCountry:'VN'},sameAs:Object.values(site.social),description:site.description},className:'page-home'
    });
}

function archive(slug, title, description, opts={}) {
  const archivePosts=opts.category?posts.filter(p=>p.category===opts.category):opts.tag?posts.filter(p=>(p.tags||[]).includes(opts.tag)):posts;
  const presentation = opts.descriptionHtml ? `<div class="archive-description-content">${localizeHtml(opts.descriptionHtml,slug)}</div>` : `<p>${esc(description)}</p>`;
  const intro = description ? `<p>${esc(limit(description,220))}</p>${description.length>220 || opts.descriptionHtml?`<details class="archive-description"><summary>Lire la présentation complète</summary>${presentation}</details>`:''}` : '';
  const filters=opts.category||opts.tag?'':`<div class="filter-list" aria-label="Catégories"><button class="filter-button" type="button" data-category="all" aria-pressed="true">Tout</button>${categories.map(c=>`<button class="filter-button" type="button" data-category="${esc(c.slug)}" aria-pressed="false">${esc(c.title)}</button>`).join('')}</div>`;
  save(slug,title==='Le Vietnam, de l’intérieur.'?'Blog voyage Vietnam — Avec Jo':opts.tag?`Articles sur ${title} — Le carnet de Jo`:`${title} — Avec Jo`,description || `Les articles du carnet de Jo : ${title}.`,`
    <div class="container"><header class="page-heading">${crumb(slug,[{title:opts.tag?'Sujet':title}])}<p class="eyebrow">${opts.tag?'Sujet':opts.category?'Le carnet de Jo':'Blog voyage Vietnam'}</p><h1>${esc(title)}</h1>${intro}</header>${opts.cover?image({image:opts.cover,imageAlt:title},slug,'class="archive-cover" loading="lazy"'):''}
    <div class="blog-controls">${filters}<form class="search-field" role="search">${icon('search')}<label for="blog-search" class="sr-only">Rechercher dans les articles</label><input id="blog-search" name="q" type="search" placeholder="Rechercher un article" autocomplete="off"></form></div><p id="filter-status" role="status" aria-live="polite">${archivePosts.length} articles</p>
    <div class="post-grid" data-category="${esc(opts.category || '')}" data-tag="${esc(opts.tag || '')}">${archivePosts.map(p=>card(p,slug,{searchable:true})).join('')}</div><div id="empty-results" hidden><h2>Aucun article trouvé</h2><p>Essayez un autre sujet ou découvrez l’ensemble du carnet.</p><button type="button" data-clear-filters>Effacer les filtres</button></div><nav data-pagination aria-label="Pages des articles"></nav><noscript><p>Tous les articles sont affichés. Utilisez les liens de catégories pour naviguer.</p></noscript></div>`,{active:'blog',image:opts.cover || site.hero,className:'page-archive',noindex:!!opts.noindex});
}

function article(p) {
  const description=p.description;
  let body=localizeHtml(p.html,p.slug);
  const used=new Set();
  body=body.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,(m,level,attributes,title)=>{
    const existing=attributes.match(/\bid=["']([^"']+)["']/i);
    const base=existing?existing[1]:slugify(text(title));let id=base || `section-${used.size+1}`, i=2;while(used.has(id)) id=`${base}-${i++}`;used.add(id);
    return `<h${level}${existing?attributes:`${attributes} id="${esc(id)}"`}>${title}</h${level}>`;
  });
  const date=p.date?new Intl.DateTimeFormat('fr-FR',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(p.date)):'';
  const related=posts.filter(q=>q.slug!==p.slug && q.category===p.category).slice(0,3);
  const serviceLinks=(seo.articleServices[p.slug] || ['guide-francophone-vietnam']).map(s=>guides.get(s)).filter(Boolean);
  const serviceBox=`<aside class="article-service-box" aria-label="Préparer votre visite avec Jo"><h2>Préparez votre visite avec Jo</h2><p>Vous souhaitez être accompagné en français ? Découvrez les possibilités de visite et échangez avec Joseph sur votre projet.</p><ul>${serviceLinks.map(g=>`<li><a href="${rel(p.slug,g.slug)}">${esc(g.title)}</a></li>`).join('')}</ul></aside>`;
  const schema={'@context':'https://schema.org','@type':'BlogPosting',headline:p.title,description,image:absolute(p.image),url:absolute(p.slug),mainEntityOfPage:absolute(p.slug),inLanguage:'fr',publisher:{'@type':'Organization',name:'Avec Jo',logo:{'@type':'ImageObject',url:absolute(site.logo)}}};
  if(p.date) schema.datePublished=p.date;if(p.dateModified) schema.dateModified=p.dateModified;
  save(p.slug,p.seoTitle || p.title,description,`<header class="article-hero container">${crumb(p.slug,[{slug:'blog',title:'Blog'},{title:p.title}])}<p class="eyebrow"><a href="${rel(p.slug,p.category)}">${esc(cat(p.category)?.title || 'Le carnet de Jo')}</a></p><h1>${esc(p.title)}</h1><p class="article-byline">Publié par <a href="${rel(p.slug,'guide-francophone-vietnam')}">Avec Jo</a></p>${date?`<p class="post-meta"><time datetime="${esc(p.date)}">${esc(date)}</time></p>`:''}${image(p,p.slug,'class="article-cover" fetchpriority="high"')}</header>
    <div class="article-layout container"><aside class="article-toc" aria-label="Sommaire de l’article"><h2>Au sommaire</h2><div data-toc></div><a class="button button-primary" href="${rel(p.slug,'contact')}">Un voyage avec Jo ? ${icon('arrow')}</a></aside><div><article class="article-content">${body}</article>${serviceBox}${p.tags?.length?`<nav class="article-tags" aria-label="Sujets de l’article">${p.tags.map(t=>`<a href="${esc(rel(p.slug,`blog?keyword=${encodeURIComponent(t)}`))}">${esc(t)}</a>`).join('')}</nav>`:''}<div class="article-share"><button type="button" class="button button-secondary" data-copy-link>Copier le lien de l’article</button><span class="sr-only" data-copy-status role="status"></span></div></div></div>
    ${related.length?`<section class="section related-posts"><div class="container"><div class="section-heading"><h2>Continuez votre découverte</h2></div><div class="post-grid">${related.map(q=>card(q,p.slug)).join('')}</div></div></section>`:''}`,{active:'blog',article:true,image:p.image,schema,lastmod:(p.dateModified||p.date||'').slice(0,10),className:'page-article'});
}

function lightbox() {
  return `<dialog id="photo-lightbox" aria-label="Visionneuse de photos"><button type="button" data-lightbox-close aria-label="Fermer la photo">${icon('close')}</button><img data-lightbox-image alt=""><p data-lightbox-caption aria-live="polite"></p><button type="button" data-lightbox-prev aria-label="Photo précédente">${icon('left')}</button><button type="button" data-lightbox-next aria-label="Photo suivante">${icon('right')}</button></dialog>`;
}
function gallery(a) {
  const slug=a.slug;
  const isMain=['photo','photos-clients-avec-jo'].includes(slug);
  const feedback=albums.filter(x=>x.kind==='album');
  const items = isMain ? feedback : [];
  const albumGrid=items.length?`<div class="album-grid" data-gallery>${items.map(x=>`<article class="album-card"><button type="button" data-lightbox="${esc(rel(slug,x.image))}" data-caption="${esc(x.title)}" aria-label="Agrandir la photo : ${esc(x.title)}">${image(x,slug,'loading="lazy" decoding="async"')}</button><h2><a href="${rel(slug,x.slug)}">${esc(x.title)}</a></h2></article>`).join('')}</div>`:'';
  const photoGrid = a.images?.length && !isMain ? `<div class="photo-grid" data-gallery>${a.images.map(i=>`<figure><button type="button" data-lightbox="${esc(rel(slug,i.src))}" data-caption="${esc(i.caption || a.title)}" aria-label="Voir la photo : ${esc(i.alt || a.title)}">${image(i,slug,'loading="lazy" decoding="async"')}</button><figcaption>${esc(i.caption || a.title)}</figcaption></figure>`).join('')}</div>` : '';
  const galleryDescription=a.description || (isMain?`Découvrez ${slug==='photo'?'les photos des voyageurs':'les albums de voyage'} d’Avec Jo : Hanoï, Sapa et Ha Giang. Retrouvez les moments partagés avec Joseph.`:`Photo de voyageurs avec Jo : ${a.title}. Retrouvez ce souvenir de voyage et les autres albums du Vietnam.`);
  save(slug,`${a.seoTitle || a.title} — Avec Jo`,galleryDescription,`<div class="container"><header class="page-heading">${crumb(slug,isMain?[{title:'Photos'}]:[{slug:'photo',title:'Photos'},{title:a.title}])}<h1>${isMain?'Des voyages, <em>des souvenirs.</em>':esc(a.title)}</h1>${isMain?'<p>Quelques moments partagés avec les voyageurs d’Avec Jo.</p>':a.description?`<p>${esc(a.description)}</p>`:''}</header>${a.html?`<div class="article-content">${localizeHtml(a.html,slug)}</div>`:''}${albumGrid}${photoGrid}${!items.length && !a.images.length?`<div class="empty-gallery"><p>Aucune photo n’a encore été publiée dans cet album.</p>${arrowLink(slug,'photo','Découvrir les photos avec Jo')}</div>`:''}${isMain?`<p class="gallery-extra">${arrowLink(slug,'photos-incontournables-vietnam','Photos des incontournables du Vietnam')}</p>`:''}</div>${lightbox()}`,{active:'photo',image:a.image,className:'page-photo'});
}

function contact() {
  const slug='contact';
  const query=encodeURIComponent(site.address);
  save(slug,'Contact — Avec Jo, guide francophone au Vietnam','Contactez Joseph pour préparer votre voyage au Vietnam : WhatsApp, e-mail et formulaire de contact.',`<div class="container"><header class="page-heading">${crumb(slug,[{title:'Contact'}])}<h1>Parlons de votre voyage.</h1><p>Joseph, votre guide francophone au Vietnam.</p></header><div class="contact-grid"><div class="contact-details"><div class="contact-map"><iframe title="Localisation d’Avec Jo : ${esc(site.address)}" src="https://www.google.com/maps?q=${query}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>${`<a class="text-link coral" href="https://www.google.com/maps/search/?api=1&amp;query=${query}" target="_blank" rel="noopener">Ouvrir la carte ${icon('arrow')}</a>`}<ul><li><a href="mailto:${esc(site.email)}" class="contact-line">${icon('mail')}${esc(site.email)}</a></li><li><a href="tel:${esc(site.phone)}" class="contact-line">${icon('phone')}${phoneDisplay}</a></li><li class="contact-line">${icon('pin')}${esc(site.address)}</li></ul><a class="button button-primary" href="${esc(site.whatsapp)}" target="_blank" rel="noopener">${icon('whatsapp')}Écrire sur WhatsApp ${icon('arrow')}</a></div>
    <form class="contact-form" name="contact" method="POST" action="mailto:${esc(site.email)}" enctype="text/plain" data-contact-form data-email="${esc(site.email)}"><p><label for="contact-name">Votre nom <span aria-hidden="true">*</span></label><input id="contact-name" name="name" autocomplete="name" placeholder="Votre nom" required maxlength="120"></p><p><label for="contact-email">Votre e-mail <span aria-hidden="true">*</span></label><input id="contact-email" name="email" type="email" autocomplete="email" placeholder="votre@email.com" required maxlength="200"></p><p><label for="contact-phone">Téléphone (facultatif)</label><input id="contact-phone" name="phone" type="tel" autocomplete="tel" placeholder="+33…" maxlength="60"></p><p><label for="contact-message">Votre projet de voyage <span aria-hidden="true">*</span></label><textarea id="contact-message" name="message" placeholder="Parlez-nous de votre projet : dates, nombre de personnes, vos envies…" required minlength="10" maxlength="10000" rows="7"></textarea></p><button class="button button-primary" type="submit">Préparer mon e-mail ${icon('arrow')}</button><p class="form-note">Votre nom et votre e-mail permettent à Joseph de vous répondre au sujet de votre voyage.</p><div id="form-status" role="status" aria-live="polite" hidden></div></form></div></div>`,{active:'contact',className:'page-contact'});
  save('merci','Merci de votre intérêt — Avec Jo','Préparez votre message à Joseph depuis la page Contact.',`<section class="error-page container"><p class="eyebrow">Votre projet de voyage</p><h1>Merci de votre intérêt.</h1><p>Pour contacter Joseph, préparez votre e-mail depuis la page Contact, puis envoyez-le avec votre messagerie.</p><p>${arrowLink('merci','contact','Contacter Joseph')}</p><a class="button button-primary" href="${rel('merci')}">Revenir à l’accueil ${icon('arrow')}</a></section>`,{active:'contact'});
}

function legacy(p) {
  const slug=p.slug;
  const displayTitle=p.seoTitle || p.title;
  const body=localizeHtml(p.html,slug);
  const links=p.links || [];
  const legacyDescription=p.description || (text(body).length>50?limit(text(body),170):`Découvrez la page « ${displayTitle} » d’Avec Jo : photos, liens et informations pour préparer votre découverte du Vietnam avec Joseph.`);
  const linkedPosts=posts.filter(x=>slugify(x.title+' '+(x.tags||[]).join(' ')).includes(slugify(p.seoTitle || p.title))).slice(0,6);
  save(slug,displayTitle,legacyDescription,`<div class="container"><header class="page-heading">${crumb(slug,[{title:displayTitle}])}<h1>${esc(displayTitle)}</h1>${p.description?`<p>${esc(p.description)}</p>`:''}</header>${body?`<div class="article-content legacy-content">${body}</div>`:p.image?image(p,slug,'class="archive-cover" loading="lazy"'):''}${links.length?`<div class="album-grid legacy-links">${links.map(l=>`<article class="album-card"><a href="${rel(slug,l.slug)}">${image(l,slug,'loading="lazy"')}<h2>${esc(l.title)}</h2></a>${l.description?`<p>${esc(l.description)}</p>`:''}</article>`).join('')}</div>`:''}${linkedPosts.length?`<section class="section"><div class="section-heading"><h2>Dans le carnet de Jo</h2></div><div class="post-grid">${linkedPosts.map(q=>card(q,slug)).join('')}</div></section>`:''}<p class="legacy-contact">${arrowLink(slug,'contact','Parlons de votre voyage')}</p></div>`,{active:'blog',image:p.image,className:'page-legacy'});
}

function guidePage(g) {
  const slug=g.slug;
  const cover=bySlug.get(g.coverPost);
  const articles=g.relatedPosts.map(s=>bySlug.get(s)).filter(Boolean);
  const connections={
    'guide-francophone-hanoi':['guide-francophone-ninh-binh','guide-francophone-nord-vietnam'],
    'guide-francophone-ninh-binh':['guide-francophone-tam-coc','pu-luong','guide-francophone-hanoi'],
    'guide-francophone-tam-coc':['guide-francophone-ninh-binh','guide-francophone-hanoi'],
    'mai-chau-phu-tho':['pu-luong','guide-francophone-nord-vietnam'],
    'pu-luong':['mai-chau-phu-tho','guide-francophone-ninh-binh'],
    'ha-giang-loop':['cao-bang','guide-francophone-nord-vietnam'],
    'cao-bang':['ha-giang-loop','guide-francophone-nord-vietnam']
  };
  const otherGuides=(connections[slug] || seo.guides.filter(q=>q.slug!==slug).map(q=>q.slug)).map(s=>guides.get(s)).filter(Boolean);
  const breadcrumbs=slug==='guide-francophone-vietnam'?[{title:'Voyager avec Jo'}]:[{slug:'guide-francophone-vietnam',title:'Voyager avec Jo'},{title:g.label}];
  save(slug,g.seoTitle,g.description,`<div class="container"><header class="page-heading">${crumb(slug,breadcrumbs)}<p class="eyebrow">Avec Jo · Accompagnement en français</p><h1>${esc(g.title)}</h1><p>${esc(g.lead)}</p></header>${image({image:cover.image,imageAlt:`${g.label} — photo du carnet de Jo`},slug,'class="archive-cover" fetchpriority="high"')}
    <div class="guide-layout"><div class="guide-content article-content">${g.sections.map(s=>`<section><h2>${esc(s.heading)}</h2><p>${esc(s.text)}</p>${s.items?`<ul>${s.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:''}</section>`).join('')}
    <section class="guide-faq" aria-labelledby="questions-frequentes"><h2 id="questions-frequentes">Vos questions avant de partir</h2>${g.faq.map(f=>`<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join('')}</section>
    <section><h2>Pour poursuivre votre voyage</h2><nav class="guide-destination-links" aria-label="Autres étapes avec un guide francophone">${otherGuides.map(q=>`<a href="${rel(slug,q.slug)}">${esc(q.label)}</a>`).join('')}</nav></section></div>
    <aside class="guide-contact" aria-labelledby="guide-contact-title"><p class="eyebrow">Votre interlocuteur</p><h2 id="guide-contact-title">Joseph, Avec Jo</h2><p>Guide francophone au Vietnam, basé à Hanoï. Échangez sur vos dates, votre groupe et les visites souhaitées. Les possibilités d’accompagnement et les conditions sont à confirmer ensemble.</p><a class="button button-primary" href="${rel(slug,'contact')}">Préparer mon voyage ${icon('arrow')}</a><a class="text-link" href="${esc(site.whatsapp)}" target="_blank" rel="noopener">Écrire sur WhatsApp ${icon('arrow')}</a><a href="mailto:${esc(site.email)}">${esc(site.email)}</a><a href="tel:${esc(site.phone)}">${phoneDisplay}</a><p class="guide-address">${esc(site.address)}</p></aside></div>
    <section class="section"><div class="section-heading"><h2>Dans le carnet de Jo</h2>${arrowLink(slug,'blog','Tous les articles')}</div><div class="post-grid">${articles.map(p=>card(p,slug)).join('')}</div></section></div>`,{active:'guides',image:cover.image,schema:{'@type':'Service',name:g.title,description:g.description,serviceType:'Accompagnement touristique en français',areaServed:{'@type':'Place',name:g.area}},lastmod:seo.updatedOn,className:'page-guide'});
}

function servicesPage() {
  const slug='services';
  save(slug,'Voyages et accompagnement en français — Avec Jo','Choisissez votre accompagnement en français avec Joseph : Hanoï et les étapes du nord du Vietnam, de Ninh Binh à Cao Bang. Préparez votre demande.',`<div class="container"><header class="page-heading">${crumb(slug,[{title:'Voyager avec Jo'}])}<p class="eyebrow">Préparer votre séjour</p><h1>Votre voyage, avec Jo.</h1><p>Une découverte de Hanoï, une étape rurale ou un parcours dans le nord : choisissez les lieux qui vous intéressent, puis échangez avec Joseph sur vos dates, votre groupe et les possibilités d’accompagnement.</p></header><div class="post-grid guide-catalog">${seo.guides.map(g=>`<article class="post-card"><a href="${rel(slug,g.slug)}">${image({image:bySlug.get(g.coverPost).image,imageAlt:g.label},slug,'loading="lazy" decoding="async"')}<h2>${esc(g.label)}</h2></a><p>${esc(limit(g.lead,185))}</p>${arrowLink(slug,g.slug,'Découvrir')}</article>`).join('')}</div><section class="section article-content"><h2>Définissons le voyage qui vous convient</h2><p>Précisez vos dates, le nombre de personnes et votre rythme. Demandez quelles journées sont accompagnées en français et les prestations prévues dans le devis. Les visites, le transport et les hébergements sont à confirmer ensemble.</p>${arrowLink(slug,'contact','Présenter mon projet à Joseph')}</section></div>`,{active:'guides',lastmod:seo.updatedOn,className:'page-services'});
}

function sitemapPage() {
  const slug='sitemap';
  const group=(title,items)=>`<section><h2>${title}</h2><ul>${items.map(x=>`<li><a href="${rel(slug,x.slug)}">${esc(x.title)}</a></li>`).join('')}</ul></section>`;
  save(slug,'Sitemap — Toutes les pages du site Avec Jo','Retrouvez toutes les pages, articles, sujets et photos du site Avec Jo.',`<div class="container"><header class="page-heading">${crumb(slug,[{title:'Sitemap'}])}<h1>Le plan du site.</h1><p>Retrouvez toutes les pages et les articles d’Avec Jo.</p></header><div class="sitemap-grid">${group('Explorer',[{slug:'',title:'Accueil'},{slug:'blog',title:'Blog'},{slug:'contact',title:'Contact'},{slug:'photo',title:'Photos'},...categories])}${group('Le carnet de Jo',posts)}${group('Photos & albums',albums)}${group('Accompagnement en français',seo.guides)}${group('Tous les sujets',tags.map(t=>({slug:`tag/${tagSlugs.get(t)}`,title:t})))}${group('Autres pages',pages.filter(p=>!guides.has(p.slug)).map(p=>({...p,title:p.seoTitle || p.title})))}</div><p>${arrowLink(slug,'sitemap.xml','Consulter le sitemap XML')}</p></div>`,{className:'page-sitemap'});
}

home();
archive('blog','Le Vietnam, de l’intérieur.','Découvrez le carnet de Jo : itinéraires, découvertes et conseils d’un guide francophone au Vietnam.');
archive('recherche','Rechercher dans le carnet de Jo','Retrouvez un lieu, un conseil ou une idée de voyage parmi les articles d’Avec Jo.');
categories.forEach(c=>archive(c.slug,c.title,c.description,{category:c.slug,cover:c.image,descriptionHtml:c.descriptionHtml}));
tags.forEach(t=>archive(`tag/${tagSlugs.get(t)}`,t,`Les articles liés au sujet « ${t} ».`,{tag:t}));
posts.forEach(article);albums.forEach(gallery);pages.filter(p=>!guides.has(p.slug)&&p.slug!=='services').forEach(legacy);seo.guides.forEach(guidePage);servicesPage();contact();sitemapPage();

const aliasRows=[];
for(const [source,target] of Object.entries(data.migration.aliases || {})) {
  const slug=new URL(source).pathname.replace(/^\/+|\/+$/g,'');
  const dest=new URL(target).pathname.replace(/^\/+|\/+$/g,'');
  const href=rel(slug,dest);
  const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avec Jo</title><link rel="canonical" href="${absolute(dest)}"><meta http-equiv="refresh" content="0;url=${esc(href)}"><meta name="robots" content="noindex,follow"></head><body><a href="${esc(href)}">Continuer vers Avec Jo</a></body></html>\n`;
  fs.mkdirSync(path.join(root,slug),{recursive:true});fs.writeFileSync(path.join(root,slug,'index.html'),html);
  const oldFlatAlias=path.join(root,`${slug}.html`);if(fs.existsSync(oldFlatAlias))fs.unlinkSync(oldFlatAlias);
  aliasRows.push(`/${slug} /${dest} 301!`,`/${slug}/ /${dest} 301!`);
}

const errorHtml=layout('', 'Page introuvable — Avec Jo','Cette page n’a pas été trouvée.',`<section class="error-page container"><p class="error-code">404</p><h1>Une autre découverte vous attend.</h1><p>Cette page n’a pas été trouvée. Explorez le carnet de Jo ou contactez Joseph pour préparer votre voyage.</p><a class="button button-primary" href="./">Revenir à l’accueil ${icon('arrow')}</a></section>`,{noindex:true});
fs.writeFileSync(path.join(root,'404.html'),errorHtml.replace('<head>','<head><base href="/">'));
const sitemapEntries=[...generated.values()].filter(x=>!x.noindex&&!x.excludeFromSitemap).map(x=>`  <url><loc>${esc(x.url)}</loc>${x.lastmod?`<lastmod>${x.lastmod}</lastmod>`:''}</url>`);
fs.writeFileSync(path.join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(root,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${domain}/sitemap.xml\n`);
fs.writeFileSync(path.join(root,'rss.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Le carnet de Jo</title><link>${domain}/blog</link><description>${esc(site.description)}</description><language>fr</language>${posts.map(p=>`<item><title>${esc(p.title)}</title><link>${absolute(p.slug)}</link><guid isPermaLink="true">${absolute(p.slug)}</guid><description>${esc(p.description)}</description>${p.date?`<pubDate>${new Date(p.date).toUTCString()}</pubDate>`:''}</item>`).join('')}</channel></rss>\n`);
const assetAliases=Object.entries(data.migration.assetAliases || {});
const rewrites=[...generated.keys()].filter(Boolean).map(s=>`/${s} /${s}/index.html 200!`);
fs.writeFileSync(path.join(root,'_redirects'),`# Preserve each original extensionless URL, query strings, and original image URLs.\n${aliasRows.join('\n')}\n${rewrites.join('\n')}\n${assetAliases.map(([old,target])=>`${old.startsWith('http')?new URL(old).pathname:old} /${String(target).replace(/^\//,'')} 200!`).join('\n')}\n`);
// Firebase Hosting uses its own routing configuration; Netlify files are ignored on deploy.
const firebaseConfig={
  hosting:{
    public:'.',
    ignore:['firebase.json','**/.*','**/node_modules/**','tools/**','migration/**','data/**','content/**','docs/**','tests/**','*.md','package*.json','netlify.toml','_redirects','**/__pycache__/**','**/*.pyc','**/*.zip','firebase-debug*.log'],
    cleanUrls:true,
    trailingSlash:false,
    redirects:aliasRows.map(row=>{const [source,destination]=row.split(' ');return {source,destination,type:301};}),
    rewrites:[
      {source:'/admin',destination:'/admin/index.html'},
      ...[...generated.keys()].filter(Boolean).map(s=>({source:`/${s}`,destination:`/${s}/index.html`})),
      ...assetAliases.map(([old,target])=>({source:old.startsWith('http')?new URL(old).pathname:old,destination:`/${String(target).replace(/^\//,'')}`}))
    ],
    headers:[
      {source:'**',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]},
      {source:'/assets/**',headers:[{key:'Cache-Control',value:'public, max-age=2592000'}]},
      {source:'**/*.@(js|css)',headers:[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},
      ...['/admin','/admin/**'].map(source=>({source,headers:[{key:'Cache-Control',value:'no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Cross-Origin-Opener-Policy',value:'same-origin-allow-popups'}]})),
      {source:'/admin/vendor/**',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]}
    ]
  }
};
fs.writeFileSync(path.join(root,'firebase.json'),JSON.stringify(firebaseConfig,null,2)+'\n');
fs.writeFileSync(path.join(root,'data/search-index.json'),JSON.stringify(posts.map(p=>({slug:p.slug,title:p.title,description:p.description,category:p.category,tags:p.tags})),null,2)+'\n');
fs.writeFileSync(path.join(root,'migration/build-manifest.json'),JSON.stringify({builtAt:new Date().toISOString(),pages:generated.size,posts:posts.length,tags:tags.length,aliases:aliasRows.length/2,assetAliases:assetAliases.length,routes:[...generated.keys()].map(s=>'/'+s)},null,2)+'\n');
console.log(`Built ${generated.size} pages, ${posts.length} complete posts, ${tags.length} tag pages, ${aliasRows.length/2} original redirects, ${assetAliases.length} image aliases.`);
