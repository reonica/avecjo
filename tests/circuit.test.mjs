import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCircuits} from '../tools/circuits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hubSlug = 'circuits';
const slug = 'circuits/1-jour-a-hanoi';
const halfDaySlug = 'circuits/une-demi-journee-a-hanoi';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const page = (route = slug) => read(`${route}/index.html`);
const hub = () => read(`${hubSlug}/index.html`);
const circuitSources = () => fs.readdirSync(path.join(root, 'content/circuits')).filter(file => file.endsWith('.json')).sort().map(file => JSON.parse(read(`content/circuits/${file}`)));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const rel = (from, target = '') => `${from ? '../'.repeat(from.split('/').filter(Boolean).length) : './'}${String(target).replace(/^\/+/, '')}`;
const main = html => html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|apos|quot|#39);/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const headings = html => [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)];
function afterHeading(html, label) {
  const all = headings(html);
  const index = all.findIndex(item => label.test(plain(item[1])));
  assert.ok(index >= 0, `Missing heading: ${label}`);
  return html.slice(all[index].index + all[index][0].length, all[index + 1]?.index ?? html.length);
}

test('circuit generation preserves hub and tour routes with Hosting/SEO registration after rebuilds', async () => {
  const emitted = [];
  await buildCircuits({root, rel, esc, save: (...args) => emitted.push(args)});
  const sources = circuitSources();
  for (const expected of [slug, halfDaySlug]) {
    assert.ok(sources.some(source => source.slug === expected), `Keep the owner-approved Hanoi tour: ${expected}`);
  }
  for (const source of sources) {
    const matches = emitted.filter(args => args[0] === source.slug);
    assert.equal(matches.length, 1, `Emit the circuit route exactly once: ${source.slug}`);
    assert.ok(matches[0][3].includes('programme'));
  }
  assert.deepEqual(emitted.map(args => args[0]).sort(), [hubSlug, ...circuitSources().map(circuit => circuit.slug)].sort(), 'Generate only the hub and actual JSON tours');
  assert.match(read('tools/build.mjs'), /buildCircuits\(\s*\{/, 'The main rebuild must invoke the circuit builder');

  const domain = JSON.parse(read('data/content.json')).site.domain.replace(/\/$/, '');
  const sitemapLinks = [...read('sitemap/index.html').matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => new URL(match[1], `${domain}/sitemap/`).pathname.replace(/\/$/, ''));
  for (const target of [hubSlug, ...sources.map(source => source.slug)]) {
    const url = `/${target}`;
    const html = read(`${target}/index.html`);
    assert.ok(html.includes(emitted.find(args => args[0] === target)[3]), `Generated HTML is stale: ${url}`);
    assert.ok(JSON.parse(read('migration/build-manifest.json')).routes.includes(url), url);
    assert.ok(JSON.parse(read('firebase.json')).hosting.rewrites.some(rule => rule.source === url && rule.destination === `${url}/index.html`), url);
    assert.ok(read('_redirects').includes(`${url} ${url}/index.html 200!`), url);
    assert.ok(html.includes(`rel="canonical" href="${domain}${url}"`), url);
    assert.ok(read('sitemap.xml').includes(`<loc>${domain}${url}</loc>`), url);
    assert.ok(sitemapLinks.includes(url), `Missing from HTML sitemap: ${url}`);
  }
});

test('the Circuits hub lists only source tours and stays discoverable from shared navigation', () => {
  const html = hub();
  assert.match(html, /<body class="page-circuits"/);
  const cards = [...main(html).matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
  const sources = circuitSources();
  assert.equal(cards.length, sources.length, 'Do not invent extra tours or placeholder cards');
  const base = 'https://test.example/circuits/';
  for (const source of sources) {
    const card = cards.find(body => [...body.matchAll(/<a\b[^>]*href="([^"]+)"/g)].some(match => new URL(match[1], base).pathname.replace(/\/$/, '') === `/${source.slug}`));
    assert.ok(card, `Missing linked source tour: ${source.slug}`);
    assert.ok(plain(card).includes(plain(source.title)), source.slug);
    const photo = card.match(/<img\b[^>]*>/)?.[0];
    assert.ok(photo, `Missing real tour photograph: ${source.slug}`);
    const heroPaths = [source.hero, ...source.hero.variants].map(photo => `/${photo.src}`);
    assert.ok(heroPaths.includes(new URL(attr(photo, 'src'), base).pathname), 'The card must use a real source photograph or its responsive variant');
  }
  assert.match(html, /href="[^"\n]*assets\/circuit\.css\?v=/);
  for (const file of ['index.html', 'blog/index.html', 'gfv/index.html', ...sources.map(source => `${source.slug}/index.html`)]) {
    const header = read(file).match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1] ?? '';
    const basePath = file === 'index.html' ? '/' : `/${path.dirname(file)}/`;
    assert.ok([...header.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>Circuits<\/a>/g)].some(match => new URL(match[1], `https://test.example${basePath}`).pathname.replace(/\/$/, '') === '/circuits'), `Shared navigation cannot reach the hub: ${file}`);
  }
  for (const source of sources) {
    const breadcrumb = main(page(source.slug)).match(/<nav class="breadcrumbs"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
    assert.ok([...breadcrumb.matchAll(/href="([^"]+)"/g)].some(match => new URL(match[1], `https://test.example/${source.slug}/`).pathname.replace(/\/$/, '') === '/circuits'));
    const current = breadcrumb.match(/<span\b[^>]*aria-current="page"[^>]*>([\s\S]*?)<\/span>/)?.[1];
    assert.equal(plain(current ?? ''), plain(source.breadcrumbTitle), `Use the current tour's own breadcrumb: ${source.slug}`);
  }
  const json = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  const nodes = json.flatMap(value => value['@graph'] ?? [value]);
  const collection = nodes.find(value => [value['@type']].flat().includes('CollectionPage'));
  assert.ok(collection, 'The hub needs CollectionPage structured data');
  const list = nodes.find(value => value['@id'] === collection.mainEntity?.['@id']);
  assert.equal(list?.['@type'], 'ItemList', 'The collection must point to its catalogue');
  assert.deepEqual(list.itemListElement.map(item => [new URL(item.url).pathname, item.name]), sources.map(source => [`/${source.slug}`, source.title]));
  assert.deepEqual(list.itemListElement.map(item => item.position), sources.map((_, index) => index + 1));
});

test('the hub aggregates additional JSON sources without requiring hard-coded tour cards', async () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'avecjo-circuits-'));
  try {
    const sources = circuitSources();
    const fixture = {...sources[0], slug: 'circuits/itineraire-test', title: 'Un itinéraire de test', breadcrumbTitle: 'Itinéraire de test'};
    const all = [...sources, fixture];
    fs.mkdirSync(path.join(fixtureRoot, 'content/circuits'), {recursive: true});
    fs.symlinkSync(path.join(root, 'assets'), path.join(fixtureRoot, 'assets'), 'dir');
    for (const circuit of all) {
      fs.writeFileSync(path.join(fixtureRoot, 'content', `${circuit.slug}.json`), JSON.stringify(circuit));
    }
    const emitted = [];
    await buildCircuits({root: fixtureRoot, rel, esc, save: (...args) => emitted.push(args)});
    assert.deepEqual(emitted.map(args => args[0]).sort(), [hubSlug, ...all.map(source => source.slug)].sort());
    const body = emitted.find(args => args[0] === hubSlug)[3];
    const cards = [...body.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)];
    assert.equal(cards.length, all.length);
    for (const circuit of all) {
      assert.ok(body.includes(esc(circuit.title)), circuit.slug);
      assert.ok(body.includes(`href="${rel(hubSlug, circuit.slug)}"`), circuit.slug);
    }
  } finally {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
  }
});

test('the tour preserves its seven programme times and the original service boundaries', () => {
  const body = main(page());
  assert.ok(body, 'The circuit must use the shared main element');
  const text = plain(body);
  for (const time of ['08h30', '09h30', '10h30', '12h30', '13h30', '15h00', '16h00']) {
    assert.ok(text.includes(time), `Missing programme time: ${time}`);
  }
  for (const stop of ['phung hung', 'cyclo-pousse', 'temple de la litterature', 'ba đinh', 'saint-joseph', 'cafe a l’œuf']) {
    assert.ok(text.includes(stop), `Missing original stop: ${stop}`);
  }
  const included = plain(afterHeading(body, /^(?:ce qui est )?inclus$/));
  assert.match(included, /guide francophone prive/);
  assert.match(included, /street food/);
  assert.match(included, /(?:une|1) boisson/);
  assert.doesNotMatch(included, /dejeuner|billets? d[’']entree|chauffeur|climatise|bouteilles? d[’']eau/, 'Do not import the reference PDF operator’s included services');
  const excluded = plain(afterHeading(body, /^(?:ce qui (?:n[’']est pas|est)|prestations) ?non inclus$|^non inclus$/));
  for (const service of [/billets? d[’']entree/, /(?:transports?|trajets?)/, /cyclo-pousse/, /marionnettes/, /(?:repas|dejeuner)/, /frais.*paiement/]) {
    assert.match(excluded, service, `Lost excluded service: ${service}`);
  }
  assert.doesNotMatch(text, /musee des femmes|pagode au pilier unique/);
});

test('both tours use two distinct real local photographs and the shared Avec Jo shell', () => {
  const allPhotoPaths = [];
  for (const source of circuitSources()) {
    const html = page(source.slug);
    const body = main(html);
    const photos = [...body.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
    assert.equal(photos.length, 2, `Count programme photographs without shared header/footer logos: ${source.slug}`);
    for (const photo of photos) {
      const src = attr(photo, 'src');
      assert.ok(src && !/^(?:https?:|data:|\/\/)/i.test(src), 'Programme photographs must be local');
      assert.doesNotMatch(src, /imagegen|dall[-_]?e|ai[-_]?generated|openai/i, 'Do not substitute generated pictures for real tour photographs');
      assert.ok(attr(photo, 'alt')?.trim(), 'Programme photographs need meaningful alternative text');
      const localPath = path.resolve(root, source.slug, src.split('?')[0]);
      assert.ok(fs.existsSync(localPath), `Missing programme photograph: ${src}`);
      allPhotoPaths.push(localPath);
    }
    for (const photo of [source.hero, source.programmePhoto]) {
      assert.match(photo.credit.source, /^https:\/\//, 'Keep the real photographs’ source attribution');
      assert.ok(photo.credit.author && photo.credit.license && photo.credit.licenseUrl);
      assert.ok(body.includes(esc(photo.credit.source)), 'Render the source attribution beside the photograph');
    }
    for (const marker of ['class="site-header"', 'class="site-footer"', 'class="skip-link"', 'id="main-content"', 'id="mobile-navigation"', 'class="whatsapp-float"', 'id="back-to-top"']) {
      assert.ok(html.includes(marker), `Missing shared shell: ${marker} in ${source.slug}`);
    }
    assert.match(html, /href="[^"\n]*style\.css\?v=/);
    assert.match(html, /href="[^"\n]*assets\/circuit\.css\?v=/);
  }
  assert.equal(new Set(allPhotoPaths).size, allPhotoPaths.length, 'The half-day tour must use different photographs from the full-day tour');
  for (const file of ['index.html', 'blog/index.html', 'gfv/index.html']) {
    assert.ok(!read(file).includes('assets/circuit.css'), `Circuit styles leaked into ${file}`);
  }
});

test('mobile navigation keeps the Circuits hub and shared contact controls without the three category links', () => {
  for (const route of ['', 'blog', hubSlug, ...circuitSources().map(source => source.slug)]) {
    const html = read(route ? `${route}/index.html` : 'index.html');
    const menu = html.match(/<nav\b[^>]*id="mobile-navigation"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(menu, `Missing mobile menu: ${route || '/'}`);
    const links = [...menu.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(match => new URL(match[1], `https://test.example/${route ? `${route}/` : ''}`).pathname.replace(/\/$/, ''));
    assert.ok(links.includes('/circuits'), 'Keep the main Circuits menu item');
    for (const category of ['circuits-vietnam', 'conseils-voyage', 'incontournables-vietnam']) {
      assert.ok(!links.includes(`/${category}`), `Remove the category from the mobile menu: ${category}`);
    }
    assert.match(html, /<a\b[^>]*class="whatsapp-float"[^>]*href="https:\/\/wa\.me\//);
    assert.match(html, /<button\b[^>]*id="back-to-top"[^>]*type="button"/);
  }
});

test('the half-day programme covers the supplied visits and both four-hour departure windows', () => {
  const source = circuitSources().find(source => source.slug === halfDaySlug);
  assert.ok(source);
  const body = main(page(halfDaySlug));
  const text = plain(body);
  for (const stop of [/vieux quartier/, /(?:đong|dong) xuan/, /ma may/, /dessert/, /cafe/]) {
    assert.match(text, stop, `Missing half-day visit: ${stop}`);
  }
  for (const window of ['09h00–13h00', '14h00–18h00']) {
    assert.ok(text.includes(window), `Missing selectable half-day window: ${window}`);
  }
  const fullDay = circuitSources().find(source => source.slug === slug);
  assert.deepEqual(source.booking, fullDay.booking, 'The new tour keeps the same confirmed reservation terms');
  assert.match(plain(source.metadata.join(' ')), /hotel dans le vieux quartier/);
  assert.match(plain(source.tips.find(tip => tip.title === 'Rendez-vous')?.text ?? ''), /hotel dans le vieux quartier/);
});

test('the full-day tour consistently starts from the hotel in the Old Quarter', () => {
  const source = circuitSources().find(source => source.slug === slug);
  assert.match(plain(source.metadata.join(' ')), /depart de votre hotel dans le vieux quartier/);
  assert.match(plain(source.programme.flatMap(section => section.paragraphs).join(' ')), /hotel dans le vieux quartier/);
  assert.match(plain(source.tips.find(tip => tip.title === 'Rendez-vous')?.text ?? ''), /hotel dans le vieux quartier/);
});

test('programme navigation and reservation disclosures work as native HTML controls', () => {
  for (const source of circuitSources()) {
    const html = page(source.slug);
    const body = main(html);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs break native anchor targets');
    assert.match(body, /<a\b[^>]*href="#programme"/);
    for (const [, target] of html.matchAll(/<a\b[^>]*href="#([^"]+)"/g)) {
      assert.ok(ids.includes(target), `Broken native anchor: #${target}`);
    }
    assert.ok(ids.includes('reservation'));
    const disclosures = [...body.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map(match => match[1]);
    for (const label of ['confirmation', 'annulation et remboursement', 'meteo']) {
      assert.ok(disclosures.some(detail => plain(detail.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? '') === label), `Missing native reservation disclosure: ${label}`);
    }
    assert.doesNotMatch(body, /\bonclick\s*=/i);
  }
});

test('public tour content preserves the approved 30-day deposit policy without prices or private data', () => {
  for (const source of circuitSources()) {
    const cancellation = plain(main(page(source.slug)));
    assert.match(cancellation, /plus de 30 jours avant la visite, l[’']acompte est integralement rembourse/);
    assert.match(cancellation, /a 30 jours ou moins, l[’']acompte n[’']est pas remboursable/);
    assert.doesNotMatch(cancellation, /conditions d[’']annulation et de remboursement.*avant la confirmation/);
  }
  for (const html of [...circuitSources().map(source => page(source.slug)), hub()]) {
    const text = plain(main(html));
    assert.doesNotMatch(text, /€|\$|\b(?:eur|usd)\b|\d[\d., ]*\s*(?:vnd|dongs?)\b/);
    assert.doesNotMatch(html, /Ludovic|Salom[eé]|Coisne|260809LD|260809|09\/08\/2026|2026-08-09|26\/10\/2026/i);
    assert.doesNotMatch(text, /\b\d+\s*%|\b(?:14|15|29) jours?\b/, 'Do not restore the old conflicting cancellation schedule or a deposit percentage');
    for (const [, json] of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const inspect = value => {
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) {
          assert.ok(!/^(?:offers|price|priceCurrency|lowPrice|highPrice)$/i.test(key), `Unexpected monetary structured data: ${key}`);
          if (key === '@type') assert.ok(![item].flat().some(type => /^(?:Offer|AggregateOffer)$/.test(type)));
          inspect(item);
        }
      };
      inspect(JSON.parse(json));
    }
  }
});
