# Nouvelle page d'accueil publique SilenceCut

## Objectif

Les visiteurs sans compte arrivent sur une vraie page de présentation. Les personnes connectées continuent d'arriver directement sur l'outil de montage, comme aujourd'hui.

## Ce que verra un visiteur

Barre du haut : logo + nom SilenceCut à gauche, liens « Notre solution », « Résultats », « Nos offres », « FAQ », puis « Connexion » et un bouton plein « Inscription », et enfin le choix de langue avec drapeau (🇫🇷 FR, 🇬🇧 EN, 🇪🇸 ES, 🇩🇪 DE).

Sections, de haut en bas :

1. **Accroche** — grand titre « Crée des montages qui percent » avec les mots forts en dégradé vert → rose → violet, une phrase de sous-titre, puis un encadré « Teste maintenant » avec deux champs de liens et un bouton d'action.
2. **Résultats / schéma** — trois étapes visuelles : tes clips → traitement SilenceCut (rond lumineux avec le logo) → ton montage prêt. Halos colorés en fond.
3. **Notre solution** — trois cartes numérotées 01/02/03 (coller les liens, personnaliser voix + musique + hook, montage automatique) reliées par un fil lumineux, avec un bouton « Crée ton compte » dessous.
4. **Nos offres** — les trois formules existantes (Starter 17 €, Pro 27 €, Elite 47 €) avec la carte Pro mise en avant, liste de ce qui est inclus et ce qui ne l'est pas, bouton vers l'inscription. Les tarifs affichés reprennent ceux déjà en place dans l'app, sans nouveaux prix inventés.
5. **FAQ** — 5 questions dépliables (annulation, usage des vidéos, fonctionnement, compétences requises, plateformes compatibles).
6. **Pied de page** — nom, mention légale courte, liens Connexion / Nos offres / FAQ.

## Comportements

- Le bouton de l'encadré d'accroche mémorise les liens saisis puis envoie vers la création de compte ; après connexion, les liens sont déjà remplis dans l'étape « Clips ».
- Un visiteur déjà connecté qui ouvre l'accueil est redirigé vers le montage (comportement actuel conservé).
- Toute la page est traduite en français, anglais, espagnol et allemand, avec le drapeau affiché juste avant le code de langue.

## Style

Fond sombre, halos verts / roses / violets discrets, dégradé de marque sur les mots clés et les boutons principaux, cartes en verre légèrement bordées. Même famille de polices que l'app. Composition, textes et illustrations propres à SilenceCut — inspiration des captures, pas de copie.

## Détails techniques

- `src/routes/index.tsx` : ne redirige plus systématiquement. Si session → redirection vers `/montage`, sinon rendu de la nouvelle page marketing, avec `head()` dédié (titre, description, og:title, og:description, og:type, twitter:card).
- Nouveaux composants sous `src/components/landing/` : `LandingNav`, `Hero`, `FlowDiagram`, `SolutionSteps`, `PlansSection`, `Faq`, `LandingFooter`.
- `src/routes/__root.tsx` : l'en-tête applicatif actuel n'est affiché que hors page d'accueil publique (la landing porte sa propre barre).
- `src/lib/prefs.tsx` : passage de 2 à 4 langues (fr, en, es, de) + libellé avec drapeau ; les clés manquantes retombent sur le français.
- Les liens saisis sur la landing sont stockés via le store de clips existant (`src/lib/clips-store.ts`) avant redirection vers `/auth`.
- Les formules sont lues depuis `PLANS` dans `src/lib/billing.ts` pour éviter des prix dupliqués.
- Sections en routes distinctes ? Non : page unique avec ancres pour « Notre solution », « Résultats », « FAQ » ; « Nos offres » pointe aussi vers la page `/pricing` existante.
