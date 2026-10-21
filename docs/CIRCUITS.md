# Circuits Avec Jo

The `/circuits` hub lists the tours stored under `content/circuits/`. It currently contains one tour, the one-day Hanoi visit at `/circuits/1-jour-a-hanoi`, without additional invented or placeholder tours. Both pages use the shared header, footer, Newsreader/Inter fonts and colour palette. The main navigation links to the hub, and each tour's breadcrumb returns to it. Canonical URLs follow `site.domain` in `data/content.json`.

## Content and provenance

`content/circuits/1-jour-a-hanoi.json` is the editable source. The itinerary and service boundaries come from the owner-supplied Avec Jo booking confirmation, `260809LD.html`. The public page removes the private travellers, fixed booking date, reservation status, prices and payment details.

The circuit renderer reads every JSON file in `content/circuits/`, renders its detail page and adds a matching card to the hub. The hub presents real available source content; adding decorative example tours would misrepresent the catalogue. Each filename must match its slug, for example `1-jour-a-hanoi.json` for `circuits/1-jour-a-hanoi`.

The later reference PDF, *Hanoï en 1 jour*, informs the spacious typography, prose presentation and parallel included/excluded lists. It describes another operator's tour, so its chauffeur, vehicle, lunch, tickets, water bottles and additional visits are not part of this circuit.

Preserve the seven programme times: 08h30, 09h30, 10h30, 12h30, 13h30, 15h00 and 16h00. The source also mentions a possible train passage around 09h15 and an approximate finish at 16h00–16h30. Do not turn these into guaranteed train access or an interior mausoleum visit. Individual stop durations are not specified in the source.

The included services are a private French-speaking guide, one street-food item and one drink. Entry tickets, local transport, cyclo-pousse, water puppets, the restaurant meal and payment fees remain excluded. Keep the distinction between the included street food and the excluded restaurant lunch.

Use real photographs only. The current tour has two photographs with local responsive variants, source links, author credits and licence information; its hub card reuses its main photograph. Preserve this provenance when changing images, and do not substitute AI-generated illustrations or photographs. The two programme photographs are separate from shared header/footer logos.

## Future CMS integration

Circuit content is separated from the renderer in structured JSON, ready for a future circuit-editing module. Fields cover the title and SEO description, introduction, summary metadata, morning/afternoon paragraphs, photographs and credits, included/excluded lists, practical advice and reservation disclosures.

There is currently no circuit editor in the admin interface. Its existing article module remains unchanged. A future CMS module should edit these circuit JSON sources and run the shared build so the hub, detail pages, Hosting routes and sitemaps stay consistent. Do not treat circuits as blog articles or edit their generated HTML through the article editor.

## Reservation terms awaiting clarification

The original confirmation contradicts itself about cancellation refunds and a non-refundable deposit; it also omits the exact 14-day boundary. The owner will clarify these rules. Until then, do not publish a cancellation-day schedule, deposit percentage, non-refundable-deposit promise or monetary amount. The page states only that cancellation and refund conditions are supplied before reservation confirmation. This is an honest public statement, not a promise of a specific refund policy.

## Build and update

1. Edit the circuit JSON rather than the generated HTML. Keep its descriptions, programme, included/excluded services, practical advice and reservation text consistent. Add a new JSON file only for an actual tour with its own matching slug and approved content.
2. Maintain the two local programme photographs and meaningful alternative text. The shared header/footer logos are separate from these two photographs.
3. Run `npm run build`. `tools/circuits.mjs` generates the hub and tour pages through the shared layout; `tools/build.mjs` registers their Hosting rewrites, build manifest and XML/HTML sitemaps. `assets/circuit.css` is loaded only by the hub and circuit detail pages.
4. Run `npm run check`. `tests/circuit.test.mjs` checks both public routes, catalogue aggregation, shared navigation, source service boundaries, real local photographs and native navigation/disclosure controls. An isolated temporary fixture verifies aggregation of multiple JSON tours without creating public example tours.
5. Review the hub and tour at desktop and mobile widths before publishing. Check card links, text spacing, both photographs, programme anchor links and the reservation disclosure. Then follow `README-FIREBASE.md` for publishing.

The circuit test can be run alone with `node --test tests/circuit.test.mjs`. It captures circuit generation in memory and reads generated files; it does not run the full build or publish the site.
