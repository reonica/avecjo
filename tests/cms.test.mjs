import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadContent, validatePost} from '../tools/content.mjs';
import {cmsSnapshot} from '../tools/cms-data.mjs';
import {applySnapshot} from '../tools/cms-sync.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = loadContent(root);
const sample = structuredClone(data.posts[0]);

test('every article has one editable source and all historical article URLs remain available', () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data/content.json'), 'utf8'));
  assert.equal(index.posts, undefined);
  assert.equal(data.posts.length, fs.readdirSync(path.join(root, 'content/posts')).filter(f => f.endsWith('.json')).length);
  for (const slug of index.postOrder) assert.ok(data.posts.some(p => p.slug === slug), slug);
});

test('new CMS article is loaded, ordered first and preserves HTML/tags used by the site builder', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'avecjo-cms-test-'));
  try {
    fs.mkdirSync(path.join(temporary, 'data'));
    fs.mkdirSync(path.join(temporary, 'content/posts'), {recursive: true});
    fs.copyFileSync(path.join(root, 'data/content.json'), path.join(temporary, 'data/content.json'));
    fs.writeFileSync(path.join(temporary, 'content/posts', `${sample.slug}.json`), JSON.stringify(sample));
    const post = {...sample, slug: 'article-cms-test', title: 'Un nouvel article', html: '<h2>Voyager ensemble</h2><p>Un contenu français.</p>', tags: ['Nouveau'], date: '2026-10-16T12:00:00Z'};
    fs.writeFileSync(path.join(temporary, 'content/posts/article-cms-test.json'), JSON.stringify(post));
    const content = loadContent(temporary);
    assert.equal(content.posts[0].slug, post.slug);
    assert.equal(content.posts[0].html, post.html);
    assert.deepEqual(content.posts[0].tags, post.tags);
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
});

test('article input cannot overwrite admin, traverse directories or use another page URL', () => {
  for (const slug of ['../admin', 'admin', '/blog', 'a/b', 'contact', 'gfv', 'circuits', data.categories[0].slug]) {
    assert.throws(() => validatePost({...sample, slug}, `${slug}.json`, data));
  }
  assert.throws(() => validatePost(sample, 'renamed.json', data), /filename/);
});

test('a new CMS article builds into its page, blog, category, tag, RSS and sitemap without changing the real repo', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'avecjo-build-test-'));
  const copy = path.join(temporary, 'site');
  try {
    fs.cpSync(root, copy, {recursive: true, filter(source) { return !path.relative(root, source).split(path.sep).some(part => ['.git', 'node_modules', 'dist'].includes(part)); }});
    const post = {...sample, slug: 'cms-integration-test', title: 'Découverte de Hanoi — test CMS', seoTitle: 'Une publication de test indépendante pour Avec Jo', description: 'Cet article temporaire vérifie que le CMS génère correctement les pages, les sujets et les métadonnées du carnet de Jo.', html: '<h2>Une nouvelle découverte</h2><p>Contenu de test temporaire.</p>', tags: ['CMS Integration'], date: '2026-10-16T12:00:00Z'};
    fs.writeFileSync(path.join(copy, 'content/posts/cms-integration-test.json'), JSON.stringify(post));
    const build = spawnSync(process.execPath, ['tools/build.mjs'], {cwd: copy, encoding: 'utf8'});
    assert.equal(build.status, 0, build.stderr);
    const read = file => fs.readFileSync(path.join(copy, file==='firebase.json'?file:'dist/'+file), 'utf8');
    const article = read('cms-integration-test/index.html');
    assert.ok(article.includes(`<title>${post.seoTitle}</title>`));
    assert.ok(article.includes('https://www.guidehanoi.com/cms-integration-test'));
    assert.ok(article.includes('Contenu de test temporaire.'));
    for (const file of ['blog/index.html', `${post.category}/index.html`, 'tag/cms-integration/index.html', 'rss.xml', 'sitemap.xml', 'data/search-index.json']) assert.ok(read(file).includes('cms-integration-test'), file);
    const hosting = JSON.parse(read('firebase.json')).hosting;
    assert.ok(hosting.rewrites.some(rule => rule.source === '/cms-integration-test' && rule.destination === '/cms-integration-test/index.html'));
    const check = spawnSync(process.execPath, ['tools/validate-seo.mjs'], {cwd: copy, encoding: 'utf8'});
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.equal(fs.existsSync(path.join(root, 'content/posts/cms-integration-test.json')), false);
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
});

test('unsafe article markup and obfuscated active URLs fail the build', () => {
  for (const html of ['<script>alert(1)</script>', '<img src="x" onerror="alert(1)">', '<iframe src="https://example.com"></iframe>', '<a href="javascript:alert(1)">link</a>', '<a href="java&#x73;cript:alert(1)">link</a>', '<a href="java\nscript:alert(1)">link</a>', '<img src="data:image/svg+xml,test">']) {
    assert.throws(() => validatePost({...sample, html}, `${sample.slug}.json`, data));
  }
  assert.throws(() => validatePost({...sample, image: '/assets/images/../private.jpg'}, `${sample.slug}.json`, data));
});

test('native CMS snapshot includes every source module without accounts or client credentials', () => {
  const snapshot=cmsSnapshot(root);
  assert.equal(snapshot.documents.filter(d=>d.kind==='posts').length,data.posts.length);
  for(const kind of ['posts','pages','categories','tags','guides','settings'])assert.ok(snapshot.documents.some(d=>d.kind===kind),kind);
  assert.ok(!snapshot.documents.some(d=>['admins','leads','sessions'].includes(d.kind)));
  assert.ok(snapshot.media.length>20);
  assert.ok(!fs.readFileSync(path.join(root,'cms/app.js'),'utf8').includes('auth/github'));
});

test('CMS export round-trips approved source content and rejects route traversal without changing the repo', async () => {
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'avecjo-sync-test-'));
 try{
  for(const dir of ['content','data','web'])fs.cpSync(path.join(root,dir),path.join(temporary,dir),{recursive:true});
  const snapshot=cmsSnapshot(root);
  const result=await applySnapshot(temporary,snapshot);
  assert.equal(result.downloaded,0);
  assert.equal(loadContent(temporary).posts.length,data.posts.length);
  assert.deepEqual(loadContent(temporary).posts.map(p=>p.html),data.posts.map(p=>p.html));
  const before=fs.readFileSync(path.join(temporary,'data/content.json'),'utf8');
  snapshot.documents.push({kind:'pages',id:'bad',data:{slug:'../backend',title:'Bad',html:'<p>x</p>'}});
  await assert.rejects(applySnapshot(temporary,snapshot),/Unsafe content filename/);
  assert.equal(fs.readFileSync(path.join(temporary,'data/content.json'),'utf8'),before);
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});

test('new CMS landing, FAQ and SEO metadata generate visible content, matching schema and noindex exclusion', () => {
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'avecjo-pages-test-'));
 try{
  fs.cpSync(root,temporary,{recursive:true,filter(source){return !path.relative(root,source).split(path.sep).some(p=>['.git','node_modules','dist','.cms-backups'].includes(p));}});
  for(const name of ['landing-pages','faqs','seo'])fs.mkdirSync(path.join(temporary,'content',name),{recursive:true});
  fs.writeFileSync(path.join(temporary,'content/landing-pages/hanoi-special.json'),JSON.stringify({slug:'hanoi-special',title:'Un voyage ensemble',seoTitle:'Hanoi spécial — Avec Jo',description:'Une découverte privée de Hanoi avec Joseph, guide francophone pour préparer un voyage selon vos envies et votre rythme.',html:'<h2>Découvrir Hanoi</h2><p>Une page de campagne.</p>'}));
  fs.writeFileSync(path.join(temporary,'content/faqs/question.json'),JSON.stringify({question:'Comment réserver ce voyage ?',answer:'Contactez Joseph pour confirmer les disponibilités.',page:'hanoi-special',published:true}));
  fs.writeFileSync(path.join(temporary,'content/seo/hanoi-special.json'),JSON.stringify({title:'SEO campagne',page:'hanoi-special',seoTitle:'Un titre de campagne unique',noindex:true}));
  const build=spawnSync(process.execPath,['tools/build.mjs'],{cwd:temporary,encoding:'utf8'});assert.equal(build.status,0,build.stderr);
  const html=fs.readFileSync(path.join(temporary,'dist/hanoi-special/index.html'),'utf8');
  assert.ok(html.includes('<title>Un titre de campagne unique</title>'));
  assert.ok(html.includes('Comment réserver ce voyage ?'));
  assert.ok(html.includes('"@type":"FAQPage"'));
  assert.ok(!fs.readFileSync(path.join(temporary,'dist/sitemap.xml'),'utf8').includes('/hanoi-special</loc>'));
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});


test('production artifacts expose the login shell but no CMS seed or dashboard data', () => {
  const html=fs.readFileSync(path.join(root,'dist/backend/index.html'),'utf8');
  assert.ok(html.includes('id="auth-screen"'));
  assert.ok(html.includes('id="sidebar" data-protected hidden'));
  assert.ok(html.includes('class="main-shell" data-protected hidden'));
  for(const file of ['seed.json','manifest.json','demo-data.json'])assert.equal(fs.existsSync(path.join(root,'dist/backend',file)),false,file);
  const hosting=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'))).hosting;
  assert.ok(hosting.ignore.includes('**/*.php'));
});
