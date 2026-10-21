/** Render tour programmes through the site's shared layout, without a runtime dependency. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildCircuits({ save, rel, esc, root = defaultRoot }) {
  const directory = path.join(root, 'content/circuits');
  const circuits = fs.readdirSync(directory).filter(file => file.endsWith('.json')).sort().map(file => {
    const circuit = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    if (!/^circuits\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(circuit.slug) || `${circuit.slug.split('/')[1]}.json` !== file) {
      throw new Error(`Invalid circuit slug: ${file}`);
    }
    for (const photo of [circuit.hero, circuit.coffee]) {
      for (const source of [photo, ...photo.variants]) {
        if (!/^assets\/images\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|webp|avif)$/.test(source.src) || !fs.existsSync(path.join(root, source.src))) {
          throw new Error(`Missing circuit image: ${source.src}`);
        }
      }
    }
    return circuit;
  });

  const attribution = photo => `Photo : <a href="${esc(photo.credit.source)}" target="_blank" rel="noopener">${esc(photo.credit.author)}</a> · <a href="${esc(photo.credit.licenseUrl)}" target="_blank" rel="noopener">${esc(photo.credit.license)}</a>`;
  const hubSlug = 'circuits';
  const hubBody = `<header class="circuits-intro container"><nav class="breadcrumbs" aria-label="Fil d’Ariane"><ol><li><a href="${esc(rel(hubSlug))}">Accueil</a></li><li aria-hidden="true">/</li><li><span aria-current="page">Circuits</span></li></ol></nav><p class="eyebrow">Les voyages avec Jo</p><h1>Les circuits avec Jo</h1><p>Découvrez les programmes de visite avec votre guide francophone. Retrouvez le détail des itinéraires, les prestations prévues et les conseils pratiques pour préparer votre voyage.</p></header>
    <div class="circuits-list container">${circuits.map((circuit, index) => `<article class="circuit-card"><figure class="circuit-card-photo"><a href="${esc(rel(hubSlug, circuit.slug))}"><img src="${esc(rel(hubSlug, circuit.hero.variants[0].src))}" srcset="${circuit.hero.variants.map(source => `${esc(rel(hubSlug, source.src))} ${source.width}w`).join(', ')}" sizes="(max-width: 359px) calc(100vw - 32px), (max-width: 760px) calc(100vw - 40px), 400px" width="${circuit.hero.width}" height="${circuit.hero.height}" alt="${esc(circuit.hero.alt)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}></a><figcaption class="circuit-card-credit">${attribution(circuit.hero)}</figcaption></figure><div class="circuit-card-copy"><p class="eyebrow">${esc(circuit.metadata[0])} · Guide francophone privé</p><h2><a href="${esc(rel(hubSlug, circuit.slug))}">${esc(circuit.title)}</a></h2><p>${esc(circuit.description)}</p><a class="text-link" href="${esc(rel(hubSlug, circuit.slug))}">Découvrir le programme <span aria-hidden="true">→</span></a></div></article>`).join('') || '<p>Les programmes de visite seront présentés ici.</p>'}</div>`;
  save(hubSlug, 'Circuits et visites privées avec un guide francophone — Avec Jo', 'Découvrez les circuits Avec Jo : itinéraires, visites privées en français et informations pratiques pour préparer votre découverte de Hanoi et du Vietnam.', hubBody, {
    className: 'page-circuits', active: 'circuits', styles: ['assets/circuit.css'],
    image: circuits[0]?.hero.src, lastmod: circuits.map(circuit => circuit.updatedOn).sort().at(-1),
    schema: { '@type': 'ItemList', name: 'Les circuits avec Jo', itemListElement: circuits.map((circuit, index) => ({ '@type': 'ListItem', position: index + 1, name: circuit.title, url: circuit.slug })) }
  });

  for (const circuit of circuits) {
    const slug = circuit.slug;
    const asset = file => esc(rel(slug, file));
    const credit = attribution;
    const photo = (item, hero = false) => `<picture><img src="${asset(item.src)}" srcset="${item.variants.map(source => `${asset(source.src)} ${source.width}w`).join(', ')}" sizes="${esc(item.sizes)}" alt="${esc(item.alt)}" width="${item.width}" height="${item.height}" ${hero ? 'fetchpriority="high" loading="eager"' : 'loading="lazy" decoding="async"'}></picture>`;
    const paragraphs = items => items.map(paragraph => `<p>${esc(paragraph)}</p>`).join('\n');
    const list = items => items.map(item => `<li>${esc(item)}</li>`).join('');
    const sections = [['programme', 'Programme'], ['inclus', 'Inclus'], ['non-inclus', 'Non inclus'], ['conseils', 'Conseils pratiques'], ['reservation', 'Réservation']];
    const body = `
      <header class="circuit-intro container">
        <nav class="breadcrumbs" aria-label="Fil d’Ariane"><ol><li><a href="${asset('')}">Accueil</a></li><li aria-hidden="true">/</li><li><a href="${asset('circuits')}">Circuits</a></li><li aria-hidden="true">/</li><li><span aria-current="page">1 jour à Hanoi</span></li></ol></nav>
        <p class="eyebrow">Circuit privé · Hanoi</p><h1>${esc(circuit.title)}</h1>
        <p class="circuit-lead">${esc(circuit.intro)}</p>
        <ul class="circuit-meta" aria-label="La journée en bref">${list(circuit.metadata)}</ul>
      </header>
      <figure class="circuit-hero">${photo(circuit.hero, true)}<figcaption class="container">${credit(circuit.hero)}</figcaption></figure>
      <nav class="circuit-tabs" aria-label="Dans ce programme"><div class="container"><ul>${sections.map(([id, title]) => `<li><a href="#${id}">${title}</a></li>`).join('')}</ul></div></nav>
      <div class="circuit-content container">
        <section id="programme" class="circuit-programme" aria-labelledby="programme-title"><h2 id="programme-title">Votre programme</h2>
          <h3>Le matin</h3>${paragraphs(circuit.morning)}
          <h3>L’après-midi</h3><div class="circuit-afternoon">${paragraphs(circuit.afternoon)}<figure class="circuit-coffee">${photo(circuit.coffee)}<figcaption>${credit(circuit.coffee)}</figcaption></figure></div>
          <p class="circuit-ending">${esc(circuit.ending)}</p>
        </section>
        <div class="circuit-services">
          <section id="inclus" aria-labelledby="inclus-title"><h2 id="inclus-title">Inclus</h2><ul class="circuit-inclusions">${list(circuit.included)}</ul></section>
          <section id="non-inclus" aria-labelledby="non-inclus-title"><h2 id="non-inclus-title">Non inclus</h2><ul class="circuit-exclusions">${list(circuit.excluded)}</ul></section>
        </div>
        <section id="conseils" aria-labelledby="conseils-title"><h2 id="conseils-title">Conseils pratiques pour votre journée</h2><dl class="circuit-tips">${circuit.tips.map(tip => `<div><dt>${esc(tip.title)}</dt><dd>${esc(tip.text)}</dd></div>`).join('')}</dl></section>
        <section id="reservation" class="circuit-booking" aria-labelledby="reservation-title"><h2 id="reservation-title">Conditions de réservation</h2>${circuit.booking.map(item => `<details${item.open ? ' open' : ''}><summary>${esc(item.title)}</summary><p>${esc(item.text)}</p></details>`).join('')}</section>
      </div>`;
    save(slug, circuit.seoTitle, circuit.description, body, {
      className: 'page-circuit', active: 'circuits', image: circuit.hero.src,
      styles: ['assets/circuit.css'], lastmod: circuit.updatedOn,
      schema: { '@type': 'Service', name: circuit.title, description: circuit.description, serviceType: 'Visite privée avec un guide francophone', areaServed: { '@type': 'City', name: 'Hanoi' } }
    });
  }
  return circuits.map(({ slug, title }) => ({ slug, title }));
}
