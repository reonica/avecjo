/* Progressive enhancement of the migrated French–Vietnamese glossary. */
(() => {
  'use strict';
  const root = document.querySelector('[data-gfv]');
  if (!root) return;
  const fallback = root.querySelector('[data-gfv-static]');
  const loadStatus = root.querySelector('[data-gfv-status]');
  const baseURL = new URL(root.dataset.gfvBase, location.href);
  const initialDocumentURL = location.href;
  const canonicalBase = new URL(document.querySelector('link[rel="canonical"]').href);
  canonicalBase.pathname = canonicalBase.pathname.replace(/\/page\/\d+\/?$/, '').replace(/\/$/, '');
  canonicalBase.search = ''; canonicalBase.hash = '';
  const PAGE_SIZE = 25;
  const STORAGE_KEY = 'avecjo-glossary-saved-v1';
  const collator = new Intl.Collator('fr', { sensitivity: 'base' });
  const normalize = value => String(value || '').toLocaleLowerCase('fr').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/\s+/g, ' ').trim();
  const pageNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(1, Math.floor(number) || 1) : 1;
  };
  const pathPage = () => {
    const path = location.pathname.slice(baseURL.pathname.length);
    return pageNumber((path.match(/^page\/(\d+)\/?$/) || [])[1]);
  };
  const readURL = () => {
    const params = new URLSearchParams(location.search);
    return {
      q: (params.get('q') || '').slice(0, 200),
      domain: params.get('domain') || '',
      theme: params.get('theme') || params.get('filter') || '',
      page: params.has('p') ? pageNumber(params.get('p')) : pathPage(),
      chosenId: params.get('word') || '',
      savedOnly: params.get('saved') === '1'
    };
  };
  const state = { words: [], saved: new Set(), ...readURL() };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('lazi-glossary-saved-v1') || '[]');
    if (Array.isArray(saved)) state.saved = new Set(saved.filter(id => typeof id === 'string'));
  } catch (_) { /* Browsing remains available when storage is disabled. */ }
  const el = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const button = (label, className, action) => {
    const node = el('button', className, label);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  let app, search, domain, theme, list, count, pager, detail, saveToggle, saveStatus;
  let currentUtterance = null;
  let searchTimer;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollDetail = () => detail.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });

  function preserveRelativeTargets() {
    // The shell was generated for the initial route depth. Keep its links and
    // lazy resources valid when client pagination changes that depth.
    document.querySelectorAll('[href], [src], [poster]').forEach(node => {
      ['href', 'src', 'poster'].forEach(attribute => {
        const value = node.getAttribute(attribute);
        if (!value || /^(?:#|[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return;
        node.setAttribute(attribute, new URL(value, initialDocumentURL).href);
      });
    });
  }
  function syncPageMetadata() {
    const canonical = state.page === 1 ? canonicalBase.href : `${canonicalBase.href}/page/${state.page}`;
    const title = state.page === 1 ? root.dataset.gfvTitle : root.dataset.gfvPageTitle.replace('{page}', state.page);
    const description = state.page === 1 ? root.dataset.gfvDescription : root.dataset.gfvPageDescription.replace('{page}', state.page);
    document.title = title;
    document.querySelector('link[rel="canonical"]').href = canonical;
    const meta = {
      'meta[name="description"]': description,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': description,
      'meta[property="og:url"]': canonical,
      'meta[name="twitter:title"]': title,
      'meta[name="twitter:description"]': description,
      'meta[name="twitter:url"]': canonical
    };
    Object.entries(meta).forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (node) node.content = value;
    });
    const breadcrumb = root.querySelector('.breadcrumbs ol');
    if (breadcrumb) {
      const home = el('li');
      const homeLink = el('a', '', 'Accueil');
      homeLink.href = new URL('../', baseURL).href;
      home.append(homeLink);
      const separator = () => {
        const node = el('li', '', '/');
        node.setAttribute('aria-hidden', 'true');
        return node;
      };
      const glossary = el('li');
      const glossaryLabel = el(state.page === 1 ? 'span' : 'a', '', 'Glossaire franco-vietnamien');
      if (state.page === 1) glossaryLabel.setAttribute('aria-current', 'page'); else glossaryLabel.href = baseURL.href;
      glossary.append(glossaryLabel);
      breadcrumb.replaceChildren(home, separator(), glossary);
      if (state.page > 1) {
        const page = el('li');
        const label = el('span', '', `Page ${state.page}`);
        label.setAttribute('aria-current', 'page');
        page.append(label);
        breadcrumb.append(separator(), page);
      }
    }
    document.querySelectorAll('script[type="application/ld+json"]').forEach(node => {
      try {
        const schema = JSON.parse(node.textContent);
        if (!Array.isArray(schema['@graph'])) return;
        const page = schema['@graph'].find(item => ['WebPage', 'CollectionPage'].includes(item['@type']));
        const breadcrumb = schema['@graph'].find(item => item['@type'] === 'BreadcrumbList');
        if (page) {
          page['@id'] = `${canonical}#webpage`;
          page.url = canonical; page.name = title; page.description = description;
          if (breadcrumb) page.breadcrumb = { '@id': `${canonical}#breadcrumb` };
        }
        if (breadcrumb) {
          const home = breadcrumb.itemListElement[0];
          breadcrumb['@id'] = `${canonical}#breadcrumb`;
          breadcrumb.itemListElement = [home, { '@type': 'ListItem', position: 2, name: 'Glossaire franco-vietnamien', item: canonicalBase.href }];
          if (state.page > 1) breadcrumb.itemListElement.push({ '@type': 'ListItem', position: 3, name: `Page ${state.page}`, item: canonical });
        }
        node.textContent = JSON.stringify(schema).replace(/</g, '\\u003c');
      } catch (_) { /* Other structured-data blocks do not affect the tool. */ }
    });
  }

  function speak(text, status) {
    const value = String(text || '').trim().slice(0, 500);
    if (!value) return;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      status.textContent = 'La lecture vocale n’est pas disponible sur ce navigateur.';
      return;
    }
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(value);
      currentUtterance = utterance;
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      const voices = synth.getVoices().filter(voice => /^fr[-_]FR$/i.test(voice.lang));
      const preferred = voices.find(voice => /henri|male|homme/i.test(voice.name)) || voices[0];
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => { status.textContent = 'Lecture en français…'; };
      utterance.onerror = () => {
        currentUtterance = null;
        status.textContent = 'Lecture vocale indisponible. Vérifiez le volume ou essayez un autre navigateur.';
      };
      utterance.onend = () => {
        currentUtterance = null;
        status.textContent = 'Voix française du navigateur';
      };
      status.textContent = 'Lecture en français…';
      // Mobile Safari requires speak() directly in the original click handler.
      synth.speak(utterance);
      synth.resume();
    } catch (_) {
      currentUtterance = null;
      status.textContent = 'Ce navigateur ne permet pas la lecture vocale.';
    }
  }

  function selectOptions(node, values, placeholder, selected) {
    node.replaceChildren(new Option(placeholder, ''));
    values.forEach(value => node.append(new Option(value, value)));
    node.value = values.includes(selected) ? selected : '';
    return node.value;
  }
  function filteredThemes() {
    return [...new Set(state.words.filter(word => !state.domain || word.domain === state.domain).map(word => word.theme).filter(Boolean))].sort(collator.compare);
  }
  function syncFilters() {
    const domains = [...new Set(state.words.map(word => word.domain).filter(Boolean))].sort(collator.compare);
    state.domain = selectOptions(domain, domains, 'Tous les domaines', state.domain);
    state.theme = selectOptions(theme, filteredThemes(), 'Tous les thèmes', state.theme);
    search.value = state.q;
    saveToggle.setAttribute('aria-pressed', String(state.savedOnly));
  }
  function filteredWords() {
    const terms = normalize(state.q).split(' ').filter(Boolean);
    return state.words.filter(item => (!state.domain || item.domain === state.domain) &&
      (!state.theme || item.theme === state.theme) && (!state.savedOnly || state.saved.has(item.id)) &&
      terms.every(term => item._search.includes(term)));
  }
  function stateURL(page = state.page, chosenId = state.chosenId) {
    const url = new URL(page === 1 ? './' : `page/${page}/`, baseURL);
    const values = { q: state.q, domain: state.domain, theme: state.theme, p: page === 1 ? '' : String(page), word: chosenId, saved: state.savedOnly ? '1' : '' };
    Object.entries(values).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    return url;
  }
  function updateURL(mode = 'push') {
    const url = stateURL();
    if (url.href !== location.href) history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
    syncPageMetadata();
  }
  function addSection(container, label, value) {
    if (!value) return;
    const section = el('section', 'gf-section');
    const text = el('p', '', value);
    text.lang = 'fr';
    section.append(el('h3', 'gf-section-label', label), text);
    container.append(section);
  }
  function safeImageURL(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim());
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function renderDetail(item) {
    detail.replaceChildren();
    if (!item) {
      detail.append(el('p', 'gf-empty', state.savedOnly ? 'Aucun mot enregistré ne correspond à ces filtres. Enregistrez des mots avec l’étoile ou affichez tout le vocabulaire.' : 'Aucun mot ne correspond à votre recherche. Modifiez les filtres ou le mot recherché.'));
      return;
    }
    const header = el('header', 'gf-word-header');
    const headings = el('div', 'gf-headings');
    headings.append(el('h2', 'gf-word-title', item.word));
    const pronunciation = el('p', 'gf-ipa', [item.pronunciation, item.grammar || item.type].filter(Boolean).join(' · '));
    pronunciation.lang = 'fr';
    headings.append(pronunciation);
    const actions = el('div', 'gf-word-actions');
    const audioStatus = el('p', 'gf-audio-status', 'Voix française du navigateur');
    audioStatus.setAttribute('role', 'status');
    const save = button(state.saved.has(item.id) ? '★' : '☆', 'gf-icon-button', () => {
      const wasSaved = state.saved.has(item.id);
      if (wasSaved) state.saved.delete(item.id); else state.saved.add(item.id);
      let stored = true;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.saved])); } catch (_) { stored = false; }
      saveStatus.textContent = `${item.word} : ${wasSaved ? 'retiré des mots enregistrés' : 'mot enregistré'}${stored ? '.' : ' pour cette visite ; le stockage du navigateur est indisponible.'}`;
      if (state.savedOnly) render('replace'); else renderDetail(item);
    });
    save.title = state.saved.has(item.id) ? 'Retirer des mots enregistrés' : 'Enregistrer ce mot';
    save.setAttribute('aria-label', save.title);
    save.setAttribute('aria-pressed', String(state.saved.has(item.id)));
    const play = button('♪ Écouter', 'gf-audio-button', () => speak(item.word, audioStatus));
    play.title = 'Écouter la prononciation française';
    actions.append(save, play);
    header.append(headings, actions);
    detail.append(header, audioStatus);
    const tags = el('div', 'gf-tags');
    [item.domain, item.theme, item.type].filter(Boolean).forEach(tag => tags.append(el('span', 'gf-tag', tag)));
    detail.append(tags);
    const photoURL = safeImageURL(item.imageURL);
    if (photoURL) {
      const figure = el('figure', 'gf-figure');
      const image = el('img');
      image.src = photoURL;
      image.alt = `Illustration de « ${item.word} »`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => figure.remove(), { once: true });
      figure.append(image);
      detail.append(figure);
    }
    const definition = el('section', 'gf-section gf-definition');
    const definitionText = el('p', '', item.definition || 'Définition non renseignée.');
    definitionText.lang = 'fr';
    definition.append(el('h3', 'gf-section-label', 'Définition en français'), definitionText);
    detail.append(definition);
    if (item.example) {
      const example = el('section', 'gf-section gf-example');
      const title = el('div', 'gf-example-title');
      title.append(el('h3', 'gf-section-label', 'Exemple en contexte'), button('♪ Écouter la phrase', 'gf-example-play', () => speak(item.example, audioStatus)));
      const quote = el('blockquote', '', item.example);
      quote.lang = 'fr';
      example.append(title, quote);
      detail.append(example);
    }
    const duo = el('div', 'gf-two-cols');
    addSection(duo, 'Synonymes', item.synonyms);
    addSection(duo, 'Collocations', item.collocations);
    if (duo.childNodes.length) detail.append(duo);
    if (item.vietnamese) {
      const translation = el('details', 'gf-disclosure');
      const text = el('p', 'gf-translation', item.vietnamese);
      text.lang = 'vi';
      translation.append(el('summary', '', 'Voir la traduction vietnamienne'), text);
      detail.append(translation);
    }
    if (item.notes || item.family) {
      const more = el('details', 'gf-disclosure');
      const info = el('div', 'gf-more');
      addSection(info, 'Notes d’usage', item.notes);
      addSection(info, 'Famille lexicale', item.family);
      more.append(el('summary', '', 'Notes d’usage et famille lexicale'), info);
      detail.append(more);
    }
    list.querySelectorAll('button[data-id]').forEach(node => {
      const active = node.dataset.id === item.id;
      node.classList.toggle('is-selected', active);
      node.setAttribute('aria-pressed', String(active));
    });
  }
  function pagerLink(label, page, enabled) {
    if (!enabled) {
      const disabled = button(label, 'gf-page-button', () => {});
      disabled.disabled = true;
      return disabled;
    }
    const link = el('a', 'gf-page-button', label);
    link.href = stateURL(page, '').href;
    link.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      state.page = page;
      state.chosenId = '';
      render();
      list.scrollTop = 0;
      const target = pager.querySelector(page === 1 ? '[data-next]' : '[data-prev]');
      if (target) target.focus({ preventScroll: true });
    });
    return link;
  }
  function render(historyMode = 'push') {
    const found = filteredWords();
    const total = Math.max(1, Math.ceil(found.length / PAGE_SIZE));
    state.page = Math.min(pageNumber(state.page), total);
    const selected = found.find(item => item.id === state.chosenId);
    if (selected) state.page = Math.floor(found.indexOf(selected) / PAGE_SIZE) + 1;
    const pageItems = found.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const chosen = selected || pageItems[0] || null;
    state.chosenId = chosen ? chosen.id : '';
    count.textContent = `${found.length} ${found.length === 1 ? 'mot' : 'mots'} · ${state.page} / ${total}`;
    list.replaceChildren();
    pageItems.forEach(item => {
      const active = item.id === state.chosenId;
      const row = button('', `gf-list-word${active ? ' is-selected' : ''}`, () => {
        state.chosenId = item.id;
        renderDetail(item);
        updateURL();
        if (window.matchMedia('(max-width: 760px)').matches) scrollDetail();
      });
      row.dataset.id = item.id;
      row.setAttribute('aria-pressed', String(active));
      row.setAttribute('aria-controls', 'gf-detail');
      row.append(el('span', 'gf-list-title', item.word), el('span', 'gf-list-meta', [item.grammar || item.type, item.theme || item.domain].filter(Boolean).join(' · ')));
      const wrapper = el('li');
      wrapper.append(row);
      list.append(wrapper);
    });
    if (!pageItems.length) list.append(el('li', 'gf-empty', 'Aucun résultat.'));
    pager.replaceChildren();
    if (total > 1) {
      const previous = pagerLink('← Précédent', state.page - 1, state.page > 1);
      const next = pagerLink('Suivant →', state.page + 1, state.page < total);
      previous.dataset.prev = '';
      next.dataset.next = '';
      pager.append(previous, el('span', 'gf-page-number', `${state.page} / ${total}`), next);
    }
    renderDetail(chosen);
    updateURL(historyMode);
  }
  function filterChange() {
    state.page = 1;
    state.chosenId = '';
    render();
  }
  function initialize(items) {
    state.words = items.map((item, index) => ({ ...item, id: String(item.id || `word-${index}`), _search: normalize(Object.values(item).join(' ')) }))
      .sort((a, b) => collator.compare(a.word, b.word));
    app = el('div', 'gf-interactive');
    app.hidden = true;
    app.innerHTML = `<form class="gf-toolbar" role="search" aria-label="Rechercher dans le glossaire">
      <label class="gf-search-label" for="gf-search">Rechercher un mot</label><div class="gf-search-wrap"><span aria-hidden="true">⌕</span><input id="gf-search" name="q" type="search" maxlength="200" autocomplete="off" placeholder="Un mot français ou sa traduction vietnamienne…"></div>
      <div class="gf-filter-grid"><label for="gf-domain">Domaine<select id="gf-domain" name="domain"><option value="">Tous les domaines</option></select></label><label for="gf-theme">Thème<select id="gf-theme" name="theme"><option value="">Tous les thèmes</option></select></label></div>
      <div class="gf-toolbar-bottom"><button type="reset" class="gf-quiet" id="gf-reset">Effacer les filtres</button><button type="button" class="gf-quiet" id="gf-saved" aria-pressed="false">☆ Mes mots enregistrés</button></div>
      </form><p id="gf-save-status" class="sr-only" role="status" aria-live="polite"></p>
      <div class="gf-layout"><aside class="gf-list-panel" aria-label="Liste de vocabulaire"><div class="gf-panel-top"><strong>Vocabulaire</strong><span id="gf-count" role="status" aria-live="polite"></span></div><ul id="gf-list" class="gf-list" aria-label="Choisissez un mot"></ul><nav id="gf-pager" class="gf-pager" aria-label="Pages du vocabulaire"></nav></aside><section class="gf-detail-panel" id="gf-detail" aria-label="Fiche de vocabulaire" aria-live="polite" aria-atomic="false" lang="fr"></section></div>`;
    fallback.before(app);
    const get = selector => app.querySelector(selector);
    search = get('#gf-search'); domain = get('#gf-domain'); theme = get('#gf-theme');
    list = get('#gf-list'); count = get('#gf-count'); pager = get('#gf-pager'); detail = get('#gf-detail');
    saveToggle = get('#gf-saved'); saveStatus = get('#gf-save-status');
    const form = get('form');
    form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(searchTimer); state.q = search.value.slice(0, 200); filterChange(); });
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.q = search.value.slice(0, 200); filterChange(); }, 250);
    });
    domain.addEventListener('change', () => {
      clearTimeout(searchTimer);
      state.q = search.value.slice(0, 200);
      state.domain = domain.value;
      state.theme = selectOptions(theme, filteredThemes(), 'Tous les thèmes', '');
      filterChange();
    });
    theme.addEventListener('change', () => { clearTimeout(searchTimer); state.q = search.value.slice(0, 200); state.theme = theme.value; filterChange(); });
    form.addEventListener('reset', event => {
      event.preventDefault(); clearTimeout(searchTimer);
      state.q = ''; state.domain = ''; state.theme = ''; state.savedOnly = false;
      syncFilters(); filterChange();
    });
    saveToggle.addEventListener('click', () => {
      clearTimeout(searchTimer); state.q = search.value.slice(0, 200);
      state.savedOnly = !state.savedOnly;
      saveToggle.setAttribute('aria-pressed', String(state.savedOnly));
      filterChange();
    });
    window.addEventListener('popstate', () => {
      clearTimeout(searchTimer);
      Object.assign(state, readURL());
      syncFilters(); render('replace');
    });
    preserveRelativeTargets();
    syncFilters();
    render('replace');
    fallback.hidden = true;
    app.hidden = false;
    document.documentElement.classList.remove('gfv-loading');
    loadStatus.textContent = '';
  }
  loadStatus.textContent = 'Chargement de la recherche et des filtres…';
  fetch(new URL(root.dataset.gfvSource, location.href), { cache: 'no-cache' })
    .then(response => { if (!response.ok) throw Error('Impossible de charger le lexique'); return response.json(); })
    .then(items => {
      if (!Array.isArray(items) || !items.length || items.some(item => !item || typeof item.word !== 'string')) throw Error('Format de données invalide');
      initialize(items);
    }).catch(() => {
      if (app) app.remove();
      fallback.hidden = false;
      document.documentElement.classList.remove('gfv-loading');
      loadStatus.textContent = 'La recherche n’a pas pu être chargée. Vous pouvez lire les mots et parcourir les pages ci-dessous. Actualisez la page pour réessayer.';
    });
})();
