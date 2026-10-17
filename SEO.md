# SEO et contenu lisible par les moteurs de recherche et les assistants IA

Mise à jour : 16 octobre 2026. Domaine canonique conservé : `https://www.guidehanoi.com`.

## Pages principales

| Intention | Page principale |
| --- | --- |
| guide francophone vietnam | `/` ; présentation de l’accompagnement sur `/guide-francophone-vietnam` |
| guide francophone hanoi | `/guide-francophone-hanoi` |
| guide francophone ninh binh | `/guide-francophone-ninh-binh` |
| guide francophone tam coc | `/guide-francophone-tam-coc` |
| guide francophone mai chau | `/mai-chau-phu-tho` (URL historique conservée) |
| guide francophone pu luong | `/pu-luong` |
| guide francophone ha giang | `/ha-giang-loop` (URL historique conservée) |
| guide francophone cao bang | `/cao-bang` |
| guide francophone nord vietnam | `/guide-francophone-nord-vietnam` |

Les trois nouvelles URL sont Ninh Binh, Tam Coc et Nord Vietnam. Les autres pages de services utilisent les chemins existants. Leurs contenus abordent des besoins distincts : visite urbaine, choix des sites de Ninh Binh, étape locale de Tam Coc, marche rurale, transport à Ha Giang ou patrimoine à Cao Bang. Les conditions et disponibilités sont à confirmer directement avec Joseph.

## Sources à modifier

- `data/seo.json` : titres, descriptions, pages de services, questions visibles, liens vers les articles et carte des mots-clés.
- `tools/seo.mjs` : graphes JSON-LD (TravelAgency, Person, WebSite, WebPage, BlogPosting, Service et BreadcrumbList).
- `tools/build.mjs` : templates partagés, hero, footer, archives et sitemap.
- `style.css` : présentation des nouvelles pages et des liens.

Le hero et le footer utilisent les ancres demandées vers `https://guidehanoi.com/`. Les métadonnées gardent le domaine canonique `www` du site original. Le domaine sans `www` doit rediriger vers `www` au niveau de l’hébergement lors du changement DNS.

## Indexation et contenu

Les 28 corps d’articles, leurs 537 titres et leurs 9 tableaux restent identiques à la migration. Les titres SEO et descriptions de neuf articles sont corrigés séparément, sans réécrire leurs textes. Des liens de contexte relient les articles aux pages d’accompagnement.

À la demande du propriétaire, toutes les pages publiques générées autorisent désormais l’indexation avec `index,follow`, y compris les anciennes pages sans corps de contenu, la recherche, l’album vide et la page de confirmation. Le générateur ne les exclut plus automatiquement à cause d’un contenu vide. Les pages d’administration, la réponse 404 et les fichiers techniques de redirection conservent `noindex`.

La galerie historique `/photos-clients-avec-jo` retrouve sa propre URL canonique. Les 123 pages publiques ont chacune une URL canonique et figurent dans le sitemap XML, qui conserve le domaine `https://www.guidehanoi.com`. Autoriser l’indexation ne garantit pas que les moteurs indexeront chaque page.

Les archives de catégories et de tags contiennent dès le HTML initial uniquement leurs articles pertinents. Les URL historiques `blog?keyword=...` restent fonctionnelles. Les cartes d’articles associés n’embarquent plus le texte intégral de chaque article dans leurs attributs de recherche. CSS et JavaScript ont un identifiant de version pour éviter de conserver un ancien asset après déploiement.

## Informations de confiance

Les coordonnées, le nom Joseph, les langues et les zones de voyage proviennent de la présentation publique du site et des destinations demandées. Aucune note, certification, durée d’expérience, disponibilité garantie ou grille tarifaire n’a été inventée. La signature éditoriale des articles est l’organisation Avec Jo ; elle ne réattribue pas les récits des voyageurs à une personne différente.

Les questions pratiques sont visibles dans les pages. Elles ne sont pas présentées comme une promesse de résultat enrichi FAQ. Aucun fichier spécial « IA » n’est nécessaire pour les fonctionnalités génératives de Google Search.

## Vérification et publication

```sh
node tools/build.mjs
node tools/validate.mjs
node tools/validate-seo.mjs
```

Les rapports se trouvent dans `migration/validation.json` et `migration/seo-validation.json`. La vérification locale couvre les liens, les corps d’articles, les routes Firebase, les métadonnées, les graphes JSON-LD, les questions et les ancres partagées. Les contrôles responsive et de navigation sont consignés dans `migration/seo-browser-checks.json`.

Après le commit GitHub, dans Cloud Shell et dans le dossier `avecjo` :

```sh
git pull origin main
export FIREBASE_HOSTING_UPLOAD_CONCURRENCY=5
firebase deploy --only hosting --project PROJECT_ID_CUA_BAN
```

Remplacer `PROJECT_ID_CUA_BAN` par le Project ID Firebase réellement utilisé. Le Site ID aperçu dans une URL d’upload ne suffit pas à prouver le Project ID si plusieurs sites sont configurés. Cette tâche ne modifie ni les identifiants Firebase ni le DNS.

Quand le domaine définitif est en ligne :

1. Vérifier la redirection domaine nu → `www`, HTTPS et les anciens chemins.
2. Vérifier le domaine dans Google Search Console, puis soumettre `https://www.guidehanoi.com/sitemap.xml`.
3. Inspecter la Home et les pages principales, et tester les données structurées sur la version publiée.
4. Mesurer les requêtes, impressions et clics dans Search Console, et les demandes de contact effectivement reçues. Les modifications ne constituent pas une garantie de classement ni de citation par une IA.

## Références officielles consultées

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/appearance/structured-data/local-business
- https://developers.google.com/search/docs/essentials/spam-policies
- https://schema.org/Service
- https://schema.org/ContactPoint
