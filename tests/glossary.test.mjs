import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const words = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/glossary.json'), 'utf8'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('migration/build-manifest.json'));
const routes = manifest.routes.filter(route => /^\/gfv(?:\/page\/\d+)?$/.test(route));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

test('all glossary entries remain readable in static pages, including Vietnamese and usage notes', () => {
  assert.ok(words.length > 0);
  assert.equal(new Set(words.map(word => word.id)).size, words.length);
  const cards = new Map();
  for (const route of routes) {
    const html = read(`${route.slice(1)}/index.html`);
    const found = [...html.matchAll(/<article class="gf-static-word[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
    assert.ok(found.length > 0, route);
    for (const [, id, body] of found) {
      assert.ok(!cards.has(id), `Duplicate static entry: ${id}`);
      cards.set(id, body);
    }
  }
  assert.equal(cards.size, words.length);
  for (const word of words) {
    const body = cards.get(word.id);
    assert.ok(body, `Missing entry: ${word.id}`);
    for (const field of ['word', 'pronunciation', 'type', 'grammar', 'definition', 'example', 'collocations', 'notes', 'synonyms', 'domain', 'theme', 'family', 'vietnamese']) {
      if (word[field]) assert.ok(body.includes(escape(word[field])), `${word.id}: lost ${field}`);
    }
    if (word.vietnamese) assert.ok(body.includes('lang="vi"'), word.id);
  }
});

test('glossary pagination, canonical URLs and sitemap remain consistent with Hosting', () => {
  const hosting = JSON.parse(read('firebase.json')).hosting;
  const domain = JSON.parse(read('data/content.json')).site.domain;
  const sitemap = read('sitemap.xml');
  assert.equal(routes.length, Math.ceil(words.length / 25));
  for (const route of routes) {
    const html = read(`${route.slice(1)}/index.html`);
    assert.ok(html.includes(`rel="canonical" href="${domain}${route}"`), route);
    assert.ok(sitemap.includes(`<loc>${domain}${route}</loc>`), route);
    assert.ok(hosting.rewrites.some(rule => rule.source === route && rule.destination === `${route}/index.html`), route);
  }
  for (const route of ['/','/blog','/sitemap']) {
    const html = read(`${route === '/' ? '' : route.slice(1) + '/'}index.html`);
    assert.ok(/href="[^"]*gfv"[^>]*>Glossaire/.test(html), `Undiscoverable glossary on ${route}`);
  }
});

test('interactive glossary assets are fingerprinted and its public data is deployable', () => {
  const html = read('gfv/index.html');
  for (const file of ['gfv.css', 'gfv.js', 'data/glossary.json']) {
    assert.ok(html.includes(`assets/${file}?v=`), `Unversioned glossary asset: ${file}`);
    assert.ok(fs.existsSync(path.join(root, 'assets', file)), file);
  }
  const hosting = JSON.parse(read('firebase.json')).hosting;
  assert.ok(!hosting.ignore.includes('assets/**'));
  assert.ok(!hosting.ignore.includes('assets/data/**'));
  assert.ok(!/\.netlify\/functions\/pronounce/.test(read('assets/gfv.js')));
});
