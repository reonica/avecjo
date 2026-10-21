import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadContent, validatePost} from '../tools/content.mjs';
import {createAuthBridge} from '../admin/auth-bridge.mjs';

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
    fs.cpSync(root, copy, {recursive: true, filter(source) { return !path.relative(root, source).split(path.sep).some(part => ['.git', 'node_modules'].includes(part)); }});
    const post = {...sample, slug: 'cms-integration-test', title: 'Découverte de Hanoi — test CMS', seoTitle: 'Une publication de test indépendante pour Avec Jo', description: 'Cet article temporaire vérifie que le CMS génère correctement les pages, les sujets et les métadonnées du carnet de Jo.', html: '<h2>Une nouvelle découverte</h2><p>Contenu de test temporaire.</p>', tags: ['CMS Integration'], date: '2026-10-16T12:00:00Z'};
    fs.writeFileSync(path.join(copy, 'content/posts/cms-integration-test.json'), JSON.stringify(post));
    const build = spawnSync(process.execPath, ['tools/build.mjs'], {cwd: copy, encoding: 'utf8'});
    assert.equal(build.status, 0, build.stderr);
    const read = file => fs.readFileSync(path.join(copy, file), 'utf8');
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

test('CMS draft workflow uses forks and public-repository scope without a publishing token', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'admin/config.json'), 'utf8'));
  assert.equal(config.backend.repo, 'reonica/avecjo');
  assert.equal(config.backend.branch, 'main');
  assert.equal(config.backend.open_authoring, true);
  assert.equal(config.backend.auth_scope, 'public_repo');
  assert.equal(config.publish_mode, 'editorial_workflow');
  assert.ok(!JSON.stringify(config).includes('client_secret'));
});

function harness() {
  const opener = {};
  const origin = 'https://cms.example.web.app';
  let listener;
  const sent = [];
  const bridge = createAuthBridge({origin, opener, subscribe(fn) { listener = fn; return () => { listener = null; }; }, send(target, message, targetOrigin) { sent.push({target, message, targetOrigin}); }});
  return {bridge, opener, origin, sent, receive(event) { listener?.(event); }};
}

test('OAuth token waits for same-origin handshake from the actual CMS window', () => {
  const h = harness();
  h.bridge.complete('test-token-not-a-real-credential');
  assert.equal(h.sent.length, 1);
  h.receive({source: h.opener, origin: 'https://attacker.invalid', data: 'authorizing:github'});
  h.receive({source: {}, origin: h.origin, data: 'authorizing:github'});
  assert.equal(h.sent.length, 1);
  h.receive({source: h.opener, origin: h.origin, data: 'authorizing:github'});
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[1].target, h.opener);
  assert.equal(h.sent[1].targetOrigin, h.origin);
  assert.ok(h.sent[1].message.startsWith('authorization:github:success:'));
  h.bridge.complete('another-test-token');
  assert.equal(h.sent.length, 2);
});

test('OAuth handshake may arrive before login and disposal prevents token delivery', () => {
  const h = harness();
  h.receive({source: h.opener, origin: h.origin, data: 'authorizing:github'});
  assert.equal(h.sent.length, 1);
  h.bridge.complete('test-token');
  assert.equal(h.sent.length, 2);
  const closed = harness();
  closed.bridge.dispose();
  closed.bridge.complete('test-token');
  closed.receive({source: closed.opener, origin: closed.origin, data: 'authorizing:github'});
  assert.equal(closed.sent.length, 1);
});
