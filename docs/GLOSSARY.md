# Glossaire franco-vietnamien

The dictionary lives at `/gfv` (the `/gfv/` spelling is also reachable). It uses the shared Avec Jo header, footer, fonts and colours. Firebase normalizes the URL without a trailing slash, consistently with the rest of this site.

## Content and build

`assets/data/glossary.json` is the single content source. It was copied byte-for-byte from the public Lazi Voyage dictionary on 20 October 2026: 900 entries, SHA-256 `64848f5af39a2e0b9f55fdd589bdc515e0216500722adfdf7d7ba36f0836fb7e`.

The source retains all fields, including pronunciation, definition, example, collocations, notes, synonyms, domain, theme, family, Vietnamese translation and image URL. Many entries have an empty domain in the original data; the Domaine filter reflects this source data.

Run `npm run build` after content changes. `tools/glossary.mjs` generates alphabetically ordered pages with 25 complete entries per page, canonical URLs, sitemap entries and Hosting routes. The default dataset produces 36 pages. Static entry pages and pagination remain available without JavaScript and when the interactive data cannot load.

Run `npm run check` to check the existing CMS, local references, SEO, glossary content preservation and public data routing. The `gfv` article slug is reserved to prevent CMS articles from overwriting the dictionary.

## Interaction

`assets/gfv.js` enhances the static content with search, Domaine/Thème filters, a selected word panel, saved words and French pronunciation for words and examples. The vocabulary data, CSS and JavaScript URLs include content fingerprints. Vietnamese translations retain `lang="vi"`; the study interface and French content use `lang="fr"`.

Saved words stay in the current browser and website origin. Browser storage on the old Lazi domain does not automatically transfer to Avec Jo. Pronunciation uses the browser's installed French voices; availability and voice timbre depend on the browser and device. The old Lazi Azure endpoint was unavailable at migration time and is not required by this static site.

## Publishing

Build and check before publishing, then follow `README-FIREBASE.md`. The public data intentionally lives under `assets/data/`: the private build inputs under top-level `data/` are excluded by Firebase Hosting.

Deploy Avec Jo and verify `/gfv` before deploying the Lazi removal. Lazi deliberately has no GFV redirect, as requested. If uploading Lazi manually to cPanel, replacing files from a ZIP does not delete old files: remove the old `gfv/` directory and `data/glossary.json` from the document root as well. Netlify publishes a fresh deploy directory automatically.
