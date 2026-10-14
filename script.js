(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scrollBehavior = () => reducedMotion.matches ? "auto" : "smooth";
  const normalize = (value) => String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").replace(/œ/gi, "oe").replace(/æ/gi, "ae")
    .toLocaleLowerCase("fr").trim();
  const slugify = (value) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  function initMenu() {
    const toggle = $(".mobile-menu-toggle");
    const nav = $(".mobile-nav");
    if (!toggle || !nav) return;
    if (!nav.id) nav.id = "mobile-navigation";
    toggle.setAttribute("aria-controls", nav.id);

    function setOpen(open, restoreFocus = false) {
      nav.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
      document.body.classList.toggle("menu-open", open);
      if (restoreFocus) toggle.focus({ preventScroll: true });
    }

    setOpen(false);
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false, true);
      }
    });
    document.addEventListener("pointerdown", (event) => {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });
    window.addEventListener("resize", () => {
      if (getComputedStyle(toggle).display === "none") setOpen(false);
    }, { passive: true });
  }

  function initCarousels() {
    const tracks = new Set();
    $$("[data-carousel], .topics-track").forEach((candidate) => {
      tracks.add(candidate.matches(".feedback-track, .topics-track, [data-carousel-track]")
        ? candidate
        : $(".feedback-track, .topics-track, [data-carousel-track]", candidate) || candidate);
    });

    tracks.forEach((track) => {
      const container = track.closest("[data-carousel-container], .feedback-section, .topics-section") || track.parentElement;
      const prev = $("[data-carousel-prev]", container);
      const next = $("[data-carousel-next]", container);
      const cards = Array.from(track.children).filter((child) => child.nodeType === 1);
      if (!cards.length) return;
      track.setAttribute("tabindex", "0");
      track.setAttribute("role", "region");
      if (!track.getAttribute("aria-label")) {
        track.setAttribute("aria-label", track.classList.contains("topics-track") ? "Thèmes de voyage" : "Photos des voyageurs");
      }

      const cardOffset = (card) => card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
      function updateControls() {
        const maximum = Math.max(0, track.scrollWidth - track.clientWidth);
        if (prev) prev.disabled = maximum <= 1 || track.scrollLeft <= 2;
        if (next) next.disabled = maximum <= 1 || track.scrollLeft >= maximum - 2;
        track.classList.toggle("is-scrollable", maximum > 1);
      }

      function move(direction) {
        const offsets = cards.map(cardOffset);
        let target;
        if (direction > 0) target = offsets.find((offset) => offset > track.scrollLeft + 4);
        else target = offsets.slice().reverse().find((offset) => offset < track.scrollLeft - 4);
        if (target === undefined) target = direction > 0 ? track.scrollWidth - track.clientWidth : 0;
        track.scrollTo({ left: target, behavior: scrollBehavior() });
      }

      if (prev) prev.addEventListener("click", () => move(-1));
      if (next) next.addEventListener("click", () => move(1));
      track.addEventListener("keydown", (event) => {
        if (event.target !== track || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      });
      track.addEventListener("scroll", updateControls, { passive: true });
      if ("ResizeObserver" in window) new ResizeObserver(updateControls).observe(track);
      else window.addEventListener("resize", updateControls, { passive: true });
      updateControls();
    });
  }

  function parseTags(value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((tag) => String(tag || "").trim()).filter(Boolean);
    } catch (_) { /* Migrated pages can also store tags separated by semicolons. */ }
    return String(value || "").split(/[;,|]/).map((tag) => tag.trim()).filter(Boolean);
  }

  function initBlog() {
    const grid = $(".post-grid");
    const cards = grid ? $$(".post-card", grid) : [];
    if (!grid || !cards.length) return;
    const search = $("#blog-search");
    const filters = $$(".filter-button[data-category]");
    const status = $("#filter-status");
    const empty = $("#empty-results");
    const pagination = $("[data-pagination]");
    // Related articles and legacy link grids remain ordinary static links.
    if (!search && !filters.length && !pagination && !grid.hasAttribute("data-archive")) return;
    const pageSize = 12;
    const defaults = { category: grid.dataset.category || "", tag: grid.dataset.tag || "" };
    const legacyTagRoute = /\/blog(?:\/index\.html)?\/?$/.test(window.location.pathname);
    const index = cards.map((card) => ({
      card,
      category: normalize(card.dataset.category),
      text: normalize(card.dataset.search || card.textContent),
      tags: parseTags(card.dataset.tags).map(normalize)
    }));
    const tagLabels = new Map(cards.flatMap((card) => parseTags(card.dataset.tags).map((tag) => [normalize(tag), tag])));
    let state;
    let inputTimer;

    function readState() {
      const params = new URLSearchParams(window.location.search);
      const requestedPage = Number.parseInt(params.get("page") || "1", 10);
      const keyword = params.get("keyword") || "";
      // The former site uses keyword links for tags. Preserve that meaning only for an exact known tag.
      const legacyTag = legacyTagRoute && !params.has("q") && !params.has("tag") && !defaults.tag
        ? tagLabels.get(normalize(keyword)) || ""
        : "";
      return {
        q: params.get("q") ?? keyword,
        category: params.get("category") ?? params.get("cat") ?? defaults.category,
        tag: params.get("tag") ?? (legacyTag || defaults.tag),
        legacyTag,
        page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
      };
    }

    function writeState(mode) {
      if (!mode) return;
      const url = new URL(window.location.href);
      ["q", "keyword", "category", "cat", "tag", "page"].forEach((key) => url.searchParams.delete(key));
      if (state.q.trim()) url.searchParams.set(state.legacyTag ? "keyword" : "q", state.q.trim());
      if (state.category && state.category !== defaults.category) url.searchParams.set("category", state.category);
      if (state.tag && state.tag !== defaults.tag && !state.legacyTag) url.searchParams.set("tag", state.tag);
      if (state.page > 1) url.searchParams.set("page", String(state.page));
      window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
    }

    function clearLegacyTag() {
      if (!state.legacyTag) return;
      state.legacyTag = "";
      state.tag = defaults.tag;
    }

    function paginationButton(label, page, options = {}) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pagination-button";
      button.textContent = label;
      button.disabled = Boolean(options.disabled);
      if (options.label) button.setAttribute("aria-label", options.label);
      if (options.current) {
        button.classList.add("is-current");
        button.setAttribute("aria-current", "page");
      }
      button.addEventListener("click", () => {
        if (page === state.page) return;
        state.page = page;
        render("push");
        grid.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      });
      return button;
    }

    function renderPagination(totalPages) {
      if (!pagination) return;
      pagination.replaceChildren();
      pagination.hidden = totalPages < 2;
      if (totalPages < 2) return;
      pagination.setAttribute("aria-label", "Pages des articles");
      pagination.append(paginationButton("← Précédent", state.page - 1, { disabled: state.page === 1 }));
      const visible = new Set([1, totalPages, state.page - 1, state.page, state.page + 1]);
      if (totalPages <= 7) for (let page = 1; page <= totalPages; page += 1) visible.add(page);
      let previous = 0;
      Array.from(visible).filter((page) => page > 0 && page <= totalPages).sort((a, b) => a - b).forEach((page) => {
        if (previous && page - previous > 1) {
          const dots = document.createElement("span");
          dots.className = "pagination-ellipsis";
          dots.textContent = "…";
          dots.setAttribute("aria-hidden", "true");
          pagination.append(dots);
        }
        pagination.append(paginationButton(String(page), page, { current: page === state.page, label: `Page ${page}` }));
        previous = page;
      });
      pagination.append(paginationButton("Suivant →", state.page + 1, { disabled: state.page === totalPages }));
    }

    function render(mode) {
      const terms = state.legacyTag ? [] : normalize(state.q).split(/\s+/).filter(Boolean);
      const category = normalize(state.category);
      const tag = normalize(state.tag);
      const results = index.filter((entry) =>
        (!category || category === "all" || category === "tous" || slugify(entry.category) === slugify(category)) &&
        (!tag || entry.tags.some((value) => value === tag || slugify(value) === slugify(tag))) &&
        terms.every((term) => entry.text.includes(term))
      );
      const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
      state.page = Math.min(state.page, totalPages);
      const visible = new Set(results.slice((state.page - 1) * pageSize, state.page * pageSize).map((entry) => entry.card));
      cards.forEach((card) => { card.hidden = !visible.has(card); });
      filters.forEach((button) => {
        const value = normalize(button.dataset.category);
        const active = slugify(value) === slugify(category) || (!category && ["", "all", "tous"].includes(value));
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (search && search.value !== state.q) search.value = state.q;
      if (status) {
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        const label = tag && (tagLabels.get(tag) || Array.from(tagLabels).find(([value]) => slugify(value) === slugify(tag))?.[1] || state.tag);
        status.textContent = (results.length
          ? `${results.length} article${results.length > 1 ? "s" : ""}${totalPages > 1 ? ` · page ${state.page} sur ${totalPages}` : ""}`
          : "Aucun article ne correspond à votre recherche.") + (label ? ` · Sujet : ${label}` : "");
      }
      if (empty) empty.hidden = results.length > 0;
      renderPagination(totalPages);
      writeState(mode);
    }

    state = readState();
    render();
    if (search) {
      search.addEventListener("input", () => {
        window.clearTimeout(inputTimer);
        clearLegacyTag();
        inputTimer = window.setTimeout(() => {
          state.q = search.value;
          state.page = 1;
          render("replace");
        }, 150);
      });
      const form = search.closest("form");
      if (form) form.addEventListener("submit", (event) => {
        event.preventDefault();
        window.clearTimeout(inputTimer);
        if (search.value !== state.q) clearLegacyTag();
        state.q = search.value;
        state.page = 1;
        render("push");
      });
    }
    filters.forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      window.clearTimeout(inputTimer);
      clearLegacyTag();
      if (search) state.q = search.value;
      const value = button.dataset.category;
      state.category = ["all", "tous"].includes(normalize(value)) ? "" : value;
      state.page = 1;
      render("push");
    }));
    $$("[data-clear-filters]").forEach((button) => button.addEventListener("click", (event) => {
      event.preventDefault();
      window.clearTimeout(inputTimer);
      state = { q: "", category: defaults.category, tag: defaults.tag, legacyTag: "", page: 1 };
      render("push");
      if (search) search.focus({ preventScroll: true });
    }));
    window.addEventListener("popstate", () => {
      window.clearTimeout(inputTimer);
      state = readState();
      render();
    });
  }

  function initArticle() {
    const content = $(".article-content");
    const toc = $("[data-toc]");
    if (!content) return;
    const headings = $$("h2, h3", content).filter((heading) => heading.textContent.trim());
    const used = new Set();
    headings.forEach((heading, position) => {
      const base = heading.id || slugify(heading.textContent) || `section-${position + 1}`;
      let id = base;
      let suffix = 2;
      while (used.has(id) || (document.getElementById(id) && document.getElementById(id) !== heading)) {
        id = `${base}-${suffix++}`;
      }
      heading.id = id;
      used.add(id);
    });
    if (toc) {
      const list = document.createElement("ol");
      list.className = "toc-list";
      headings.forEach((heading) => {
        const item = document.createElement("li");
        if (heading.tagName === "H3") item.className = "toc-subitem";
        const link = document.createElement("a");
        link.href = `#${encodeURIComponent(heading.id)}`;
        link.textContent = heading.textContent.trim();
        item.append(link);
        list.append(item);
      });
      toc.replaceChildren(list);
      if (!headings.length) (toc.closest(".article-toc") || toc).hidden = true;
      if (headings.length && "IntersectionObserver" in window) {
        const links = $$("a", toc);
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            links.forEach((link) => {
              if (decodeURIComponent(link.hash.slice(1)) === entry.target.id) link.setAttribute("aria-current", "location");
              else link.removeAttribute("aria-current");
            });
          });
        }, { rootMargin: "-15% 0px -65% 0px", threshold: 0 });
        headings.forEach((heading) => observer.observe(heading));
      }
    }
    const progress = $("[data-reading-progress]");
    if (progress) {
      let scheduled = false;
      const update = () => {
        const rect = content.getBoundingClientRect();
        const travelled = window.innerHeight - rect.top;
        const amount = Math.min(1, Math.max(0, travelled / (rect.height + window.innerHeight)));
        if (progress.tagName === "PROGRESS") {
          progress.max = 1;
          progress.value = amount;
        } else progress.style.setProperty("--reading-progress", `${amount * 100}%`);
        scheduled = false;
      };
      window.addEventListener("scroll", () => {
        if (!scheduled) {
          scheduled = true;
          window.requestAnimationFrame(update);
        }
      }, { passive: true });
      window.addEventListener("resize", update, { passive: true });
      update();
    }
  }

  function initLightbox() {
    const dialog = $("#photo-lightbox");
    const image = dialog && $("[data-lightbox-image]", dialog);
    const caption = dialog && $("[data-lightbox-caption]", dialog);
    const close = dialog && $("[data-lightbox-close]", dialog);
    const previous = dialog && $("[data-lightbox-prev]", dialog);
    const next = dialog && $("[data-lightbox-next]", dialog);
    if (!dialog || !image || typeof dialog.showModal !== "function") return;
    let gallery = [];
    let current = 0;
    let lastTrigger;
    function display(index) {
      current = (index + gallery.length) % gallery.length;
      const trigger = gallery[current];
      const thumbnail = $("img", trigger);
      const explicit = trigger.dataset.lightbox;
      image.src = trigger.dataset.lightboxSrc || trigger.dataset.src ||
        (explicit && explicit !== "true" ? explicit : "") || (thumbnail && (thumbnail.currentSrc || thumbnail.src)) || "";
      image.alt = trigger.dataset.alt || (thumbnail && thumbnail.alt) || "Photo de voyage";
      const text = trigger.dataset.caption ||
        (trigger.closest("figure") && $("figcaption", trigger.closest("figure"))?.textContent.trim()) || image.alt;
      if (caption) caption.textContent = `${text} · ${current + 1} / ${gallery.length}`;
      if (previous) previous.disabled = gallery.length < 2;
      if (next) next.disabled = gallery.length < 2;
    }
    $$("[data-lightbox]").forEach((trigger) => trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const root = trigger.closest("[data-gallery], .photo-grid, .album-grid") || document;
      gallery = $$("[data-lightbox]", root);
      if (!gallery.includes(trigger)) gallery = [trigger];
      lastTrigger = trigger;
      display(gallery.indexOf(trigger));
      if (!dialog.open) dialog.showModal();
      document.body.classList.add("lightbox-open");
      if (close) close.focus({ preventScroll: true });
    }));
    if (close) close.addEventListener("click", () => dialog.close());
    if (previous) previous.addEventListener("click", () => display(current - 1));
    if (next) next.addEventListener("click", () => display(current + 1));
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        display(current + (event.key === "ArrowRight" ? 1 : -1));
      }
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("lightbox-open");
      image.removeAttribute("src");
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    });
  }

  function initContact() {
    const form = $("[data-contact-form]");
    if (!form) return;
    const status = $("#form-status");
    if (status) {
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.hidden = false;
      status.textContent = "Ce formulaire prépare un e-mail. Vous l’enverrez ensuite depuis votre messagerie.";
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const read = (...names) => names.map((name) => values.get(name)).find((value) => typeof value === "string" && value.trim())?.trim() || "";
      const mailLink = $(".contact-details a[href^='mailto:']");
      const recipient = form.dataset.email || (mailLink && mailLink.getAttribute("href").slice(7).split("?")[0]) || "goavecjo@gmail.com";
      const body = [
        `Nom : ${read("name", "nom", "full-name")}`,
        `E-mail : ${read("email", "e-mail")}`,
        `Téléphone : ${read("phone", "telephone", "tel") || "Non indiqué"}`,
        "",
        read("message", "project", "projet")
      ].join("\n");
      const href = `mailto:${recipient}?subject=${encodeURIComponent("Mon projet de voyage au Vietnam")}&body=${encodeURIComponent(body)}`;
      if (status) {
        status.hidden = false;
        const explanation = document.createElement("p");
        explanation.textContent = "Votre message n’a pas été envoyé. Ouvrez votre messagerie, puis envoyez l’e-mail préparé :";
        const link = document.createElement("a");
        link.href = href;
        link.className = "text-link";
        link.textContent = "Ouvrir mon e-mail préparé →";
        status.replaceChildren(explanation, link);
        link.focus({ preventScroll: true });
      } else window.location.href = href;
    });
  }

  function initUtilities() {
    const top = $("#back-to-top");
    if (top) {
      const update = () => { top.hidden = window.scrollY < 400; };
      top.addEventListener("click", () => window.scrollTo({ top: 0, behavior: scrollBehavior() }));
      window.addEventListener("scroll", update, { passive: true });
      update();
    }
    $$("[data-copy-link]").forEach((button) => {
      const original = button.innerHTML;
      let resetTimer;
      let copying = false;
      button.addEventListener("click", async () => {
        if (copying) return;
        copying = true;
        window.clearTimeout(resetTimer);
        let copied = false;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(window.location.href);
            copied = true;
          } else {
            const textarea = document.createElement("textarea");
            textarea.value = window.location.href;
            textarea.setAttribute("readonly", "");
            textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
            document.body.append(textarea);
            try {
              textarea.select();
              copied = document.execCommand("copy");
            } finally {
              textarea.remove();
              button.focus({ preventScroll: true });
            }
          }
        } catch (_) { copied = false; }
        copying = false;
        button.textContent = copied ? "Lien copié ✓" : "Copiez l’adresse dans votre navigateur";
        const status = $("[data-copy-status]");
        if (status) status.textContent = copied ? "Le lien de cet article a été copié." : "La copie automatique est indisponible. Vous pouvez copier l’adresse dans votre navigateur.";
        resetTimer = window.setTimeout(() => { button.innerHTML = original; }, 3000);
      });
    });
  }

  function init() {
    initMenu();
    initCarousels();
    initBlog();
    initArticle();
    initLightbox();
    initContact();
    initUtilities();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
