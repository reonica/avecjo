# Circuits Avec Jo

The `/circuits` hub lists the tours stored under `content/circuits/`. It currently contains the one-day Hanoi visit at `/circuits/1-jour-a-hanoi` and the half-day visit at `/circuits/une-demi-journee-a-hanoi`. The hub and both detail pages use the shared header, footer, Newsreader/Inter fonts and colour palette. The main navigation links to the hub, and each tour's own breadcrumb returns to it. Canonical URLs follow `site.domain` in `data/content.json`.

## Content and provenance

The circuit renderer reads every JSON file in `content/circuits/`, renders its detail page and adds a matching card to the hub. The hub presents actual source tours without decorative examples or placeholders. Each filename must match its slug, for example `1-jour-a-hanoi.json` for `circuits/1-jour-a-hanoi`.

`content/circuits/1-jour-a-hanoi.json` comes from the owner-supplied Avec Jo booking confirmation, `260809LD.html`. The public page removes private travellers, fixed booking dates, reservation status, prices and payment details. Preserve the seven programme times: 08h30, 09h30, 10h30, 12h30, 13h30, 15h00 and 16h00. The source also mentions a possible train passage around 09h15 and an approximate finish at 16h00–16h30. Do not turn these into guaranteed train access or an interior mausoleum visit. Individual stop durations are not specified in the source.

The full-day tour includes a private French-speaking guide, one street-food item and one drink. Entry tickets, local transport, cyclo-pousse, water puppets, the restaurant meal and payment fees remain excluded. Keep the distinction between included street food and an excluded restaurant lunch.

`content/circuits/une-demi-journee-a-hanoi.json` comes from the owner's additional programme: a walk in the Vieux Quartier, Đồng Xuân market, the old house at 87 Mã Mây, a local dessert and a Hanoi coffee speciality. The selectable four-hour windows are 09h00–13h00 and 14h00–18h00. Do not split these alternatives into mandatory morning and afternoon visits or invent intermediate stop times. The reservation terms remain the same as the full-day tour. Both programmes start from the traveller's hotel in the Vieux Quartier; preserve this qualification in summary metadata, programme prose and practical meeting information.

The later reference PDF, *Hanoï en 1 jour*, informs the spacious typography, prose presentation and parallel included/excluded lists. It describes another operator's tour, so its chauffeur, vehicle, lunch, tickets, water bottles and additional visits are not part of these programmes.

Attraction names in programme paragraphs use semantic `<strong>` emphasis. Each programme section declares a `highlights` array containing the exact plain-text names that appear in its own `paragraphs`. The renderer matches these names literally and escapes both the emphasized name and the surrounding prose. Keep the JSON free of HTML; add or update a highlight when changing a place name. Formatting must preserve the original sentences, stop times, service boundaries and end-of-tour information.

Use real photographs only. Each current tour has two local photographs with responsive variants, source links, author credits and licence information. The half-day tour uses different photographs from the full-day tour; each hub card reuses its own tour's main photograph. Preserve this provenance when changing images, and do not substitute AI-generated illustrations or photographs. Source and licence records are kept in `docs/circuit-photo-sources.json`. Programme photographs are separate from shared header/footer logos.

## Search and AI discovery

The existing `/guide-francophone-hanoi` page remains the main service page for the topic `guide francophone Hanoi`. The `/circuits` catalogue helps visitors compare real programmes, while each tour page answers a distinct duration and itinerary intent. Search titles, descriptions and visible introductions describe the French-speaking guide service and Hanoi naturally; each page retains its own title, summary and canonical route. Avoid repeating the exact keyword in every heading or adding services that are not in the owner's programme.

Contextual links connect the Hanoi guide page, the catalogue and the two tours. A visitor can move from the guide service to a specific programme and compare the half-day and full-day options. Keep these links in the page's relevant visible content rather than relying only on shared menus or breadcrumbs. The tour pages retain the five approved sections: programme, included services, excluded services, practical advice and reservation conditions.

For search engines and AI-assisted discovery, the useful information is the same visible, crawlable French HTML: itinerary, duration, departure information, inclusions, exclusions and booking terms. Shared structured data identifies the existing Avec Jo provider, a `CollectionPage` and actual `ItemList` for the catalogue, a `Service` for each tour, and page-specific breadcrumbs. JSON-LD must agree with the visible copy and keep the same canonical domain. Do not invent prices, offers, ratings, reviews or FAQ content for richer markup. These changes improve clarity and machine readability; they do not promise ranking or inclusion in an AI-generated answer.

## Shared mobile layout

The mobile menu keeps the main `Circuits` link alongside the site's main destinations. It omits the three category links `Circuits Vietnam`, `Conseils Voyage` and `Incontournables Vietnam`. The corresponding category pages and footer links remain available.

The hub and detail pages use the same floating WhatsApp contact link and back-to-top button as the rest of the site, including on mobile. Check these controls at narrow widths and after scrolling; the back-to-top button follows the shared site's scroll behaviour.

## Future CMS integration

Circuit content is separated from the renderer in structured JSON, ready for a future circuit-editing module. Fields cover the title, tour-specific `breadcrumbTitle`, `seoTitle`, SEO description, introduction, summary `metadata`, ordered `programme` sections, photographs and credits, included/excluded lists, practical advice and reservation disclosures. Each programme section contains a `title`, plain-text `paragraphs` and exact-name `highlights`; this supports a full-day morning/afternoon structure or a single half-day itinerary without hardcoded day labels. `hero` and `programmePhoto` hold the two photograph records and responsive variants. `updatedOn` records a substantive content revision and supplies the generated sitemap's modification date.

There is currently no circuit editor in the admin interface. Its existing article module remains unchanged. A future CMS module should edit these circuit JSON sources and run the shared build so the hub, detail pages, Hosting routes and sitemaps stay consistent. Do not treat circuits as blog articles or edit their generated HTML through the article editor.

## Reservation terms

The owner clarified the cancellation policy on 21 October 2026: cancellation more than 30 days before the visit receives a full refund of the advance/deposit; at 30 days or less, the advance/deposit is not refunded. The public French wording explicitly covers the 30-day boundary and refers to the deposit, not the whole tour price. It replaces the contradictory schedule in the original booking confirmation. Both tours use this policy. No deposit percentage or tour price is published.

## Build and update

1. Edit the circuit JSON rather than the generated HTML. Keep search titles, descriptions, visible introductions, programme, included/excluded services, practical advice and reservation text consistent. Maintain the programme's exact-name `highlights` and `updatedOn` when making a substantive change. Add a JSON file only for an actual tour with its own matching slug and approved content.
2. Maintain the two local programme photographs, meaningful alternative text and source credits. Use different photographs for the two existing Hanoi programmes.
3. Run `npm run build`. `tools/circuits.mjs` generates the hub and tour pages through the shared layout; `tools/build.mjs` registers their Hosting rewrites, build manifest and XML/HTML sitemaps. `assets/circuit.css` is loaded only by the hub and circuit detail pages.
4. Run `npm run check`. `tests/circuit.test.mjs` checks the public routes, catalogue aggregation, shared navigation, distinct search metadata, contextual Hanoi guide links, provider/service relationships, semantic attraction-name emphasis, source text and service boundaries, both half-day time windows, distinct local photographs, tour-specific breadcrumbs, departure information, booking policy and native navigation/disclosure controls. An isolated temporary third-tour fixture verifies aggregation without creating a public example tour. `tests/circuit-emphasis.test.mjs` covers literal matching, overlapping names, escaping and the absence of highlights.
5. Review the hub and both tours at desktop and mobile widths before publishing. Check card links, mobile menu, floating controls, text spacing, photographs, programme anchors and reservation disclosures. Then follow `README-FIREBASE.md` for publishing.

The circuit test can be run alone with `node --test tests/circuit.test.mjs`. It captures circuit generation in memory and reads generated files; it does not run the full build or publish the site.
