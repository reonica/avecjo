/** Reproducible static fallback and progressive enhancement for the bilingual glossary. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const PAGE_SIZE = 25;
const fingerprint = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 12);

export function buildGlossary({ save, rel, esc }) {
  const words = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/glossary.json'), 'utf8')).slice();
  // Compare the word field, keeping the original dataset byte-for-byte on disk.
  words.sort((a, b) => a.word.localeCompare(b.word, 'fr', { sensitivity: 'base' }));
  const total = Math.max(1, Math.ceil(words.length / PAGE_SIZE));
  const titleFor = page => `Glossaire franco-vietnamien${page !== 1 ? ` — Page ${page}` : ''} — Avec Jo`;
  const descriptionFor = page => `Glossaire franco-vietnamien${page !== 1 ? `, page ${page}` : ''} : ${words.length} mots et expressions avec définitions, traductions, exemples, synonymes et notes d’usage.`;
  const versions = Object.fromEntries(['assets/gfv.css', 'assets/gfv.js', 'assets/data/glossary.json'].map(file => [file, fingerprint(file)]));
  const asset = (slug, file) => `${rel(slug, file)}?v=${versions[file]}`;
  // Run before the static cards can paint. If the interactive script cannot load,
  // restore the readable static glossary instead of leaving a permanent loader.
  const loading = `<script>
    document.documentElement.classList.add('gfv-loading');
    document.querySelector('[data-gfv-status]').textContent = 'Chargement du glossaire…';
    setTimeout(() => {
      if (!document.documentElement.classList.contains('gfv-loading')) return;
      document.documentElement.classList.remove('gfv-loading');
      document.querySelector('[data-gfv-status]').textContent = 'La recherche prend plus de temps que prévu. Vous pouvez lire les mots et parcourir les pages ci-dessous.';
    }, 8000);
  </script>`;
  const section = (label, value, className = '') => value ? `<section class="gf-section ${className}"><h3 class="gf-section-label">${esc(label)}</h3><p lang="fr">${esc(value)}</p></section>` : '';
  const card = item => `<article class="gf-static-word gf-detail-panel" id="${esc(item.id)}" lang="fr">
    <header class="gf-word-header"><div class="gf-headings"><h2 class="gf-word-title">${esc(item.word)}</h2><p class="gf-ipa">${esc([item.pronunciation, item.grammar || item.type].filter(Boolean).join(' · '))}</p></div></header>
    <div class="gf-tags">${[item.domain, item.theme, item.type].filter(Boolean).map(label => `<span class="gf-tag">${esc(label)}</span>`).join('')}</div>
    ${section('Définition en français', item.definition, 'gf-definition')}
    ${item.example ? `<section class="gf-section gf-example"><h3 class="gf-section-label">Exemple en contexte</h3><blockquote lang="fr">${esc(item.example)}</blockquote></section>` : ''}
    <div class="gf-two-cols">${section('Synonymes', item.synonyms)}${section('Collocations', item.collocations)}</div>
    ${item.vietnamese ? `<details class="gf-disclosure"><summary>Voir la traduction vietnamienne</summary><p class="gf-translation" lang="vi">${esc(item.vietnamese)}</p></details>` : ''}
    ${item.notes || item.family ? `<details class="gf-disclosure"><summary>Notes d’usage et famille lexicale</summary><div class="gf-more">${section('Notes d’usage', item.notes)}${section('Famille lexicale', item.family)}</div></details>` : ''}
  </article>`;
  const slugFor = page => page === 1 ? 'gfv' : `gfv/page/${page}`;
  const pager = (slug, page) => {
    const visible = new Set([1, total, page - 1, page, page + 1].filter(n => n >= 1 && n <= total));
    let previous = 0;
    const links = [...visible].sort((a, b) => a - b).map(n => {
      const gap = previous && n > previous + 1 ? '<span aria-hidden="true">…</span>' : '';
      previous = n;
      return `${gap}<a href="${esc(rel(slug, `${slugFor(n)}/`))}"${n === page ? ' aria-current="page"' : ''} aria-label="Page ${n}">${n}</a>`;
    }).join('');
    return `<nav class="gf-static-pager" aria-label="Pages du glossaire">${page > 1 ? `<a href="${esc(rel(slug, `${slugFor(page - 1)}/`))}" rel="prev">← Précédent</a>` : ''}${links}${page < total ? `<a href="${esc(rel(slug, `${slugFor(page + 1)}/`))}" rel="next">Suivant →</a>` : ''}</nav>`;
  };
  for (let page = 1; page <= total; page++) {
    const slug = slugFor(page);
    const title = titleFor(page);
    const description = descriptionFor(page);
    const content = `<div class="container gf-app" data-gfv data-gfv-page="${page}" data-gfv-base="${esc(rel(slug, 'gfv/'))}" data-gfv-source="${esc(asset(slug, 'assets/data/glossary.json'))}" data-gfv-title="${esc(titleFor(1))}" data-gfv-page-title="${esc(titleFor('{page}'))}" data-gfv-description="${esc(descriptionFor(1))}" data-gfv-page-description="${esc(descriptionFor('{page}'))}" lang="fr">
        <header class="page-heading gf-intro"><nav class="breadcrumbs" aria-label="Fil d’Ariane"><ol><li><a href="${esc(rel(slug))}">Accueil</a></li><li aria-hidden="true">/</li><li>${page > 1 ? `<a href="${esc(rel(slug, 'gfv/'))}">Glossaire franco-vietnamien</a></li><li aria-hidden="true">/</li><li><span aria-current="page">Page ${page}</span>` : '<span aria-current="page">Glossaire franco-vietnamien</span>'}</li></ol></nav><p class="eyebrow">Les mots pour découvrir le Vietnam</p><h1>Glossaire <em>franco-vietnamien.</em></h1><p class="gf-intro-vi" lang="vi">Từ điển Pháp–Việt</p><p>Apprenez le français à travers les définitions, les exemples en contexte et les synonymes. Ouvrez la traduction vietnamienne lorsque vous en avez besoin.</p></header>
        <p class="gf-load-status" data-gfv-status role="status" aria-live="polite"></p>
        ${loading}
        <div data-gfv-static><p class="gf-static-count">${words.length} mots · Page ${page} / ${total}</p><noscript><p>Parcourez le glossaire avec les liens de pagination. Activez JavaScript pour rechercher, filtrer et enregistrer vos mots.</p></noscript><div class="gf-static-grid">${words.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(card).join('')}</div>${pager(slug, page)}</div>
        <p class="gf-source">Un lexique français–vietnamien pour le voyage, la culture et la vie quotidienne.</p>
      </div><script src="${esc(asset(slug, 'assets/gfv.js'))}" defer></script>`;
    save(slug, title, description, content, { active: 'gfv', className: 'glossary-page', styles: ['assets/gfv.css'], inlineStyles: true });
  }
  return { entries: words.length, pages: total, pageSize: PAGE_SIZE };
}
