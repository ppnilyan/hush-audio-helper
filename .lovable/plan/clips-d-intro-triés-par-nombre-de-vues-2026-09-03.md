# Clips d'intro triés par nombre de vues

## Objectif

Quand on colle un lien TikTok, récupérer le nombre de vues de la vidéo. Les 3 clips les plus vus sont placés en premier — ce sont eux qui alimentent les 3 coupes rapides de l'intro. À partir du 4e clip, l'ordre actuel (ordre d'ajout) est conservé.

## Fonctionnement actuel (constaté)

- `src/lib/tiktok.functions.ts` (`resolveTikTok`) appelle l'API tikwm.com et renvoie `playUrl`, `title`, `duration`. L'API tikwm fournit aussi `play_count` (vues), aujourd'hui ignoré.
- `ClipInfo` (`src/lib/montage.ts`) n'a pas de champ vues.
- `buildTimeline` utilise `clips[0..2]` pour l'intro : l'ordre du tableau `clips` détermine donc les 3 premières coupes.
- Les clips importés manuellement (fichier) n'ont pas de vues connues.

## Changements

1. **Récupérer les vues** — `tiktok.functions.ts` : lire `data.play_count` dans la réponse tikwm et le renvoyer (`views`).
2. **Stocker les vues** — `montage.ts` : ajouter `views?: number` à `ClipInfo`.
3. **Propager** — `montage.tsx` : lors du téléchargement d'un lien TikTok, transmettre `views` à `addFromUrl` (paramètre optionnel ; les fichiers importés restent sans vues).
4. **Tri** — nouvelle fonction `orderByViews(clips)` dans `montage.ts` : les 3 clips avec le plus de vues passent en tête (tri décroissant), tous les autres gardent leur ordre d'ajout. Les clips sans vues comptent pour 0, donc jamais dans le top 3 sauf si aucune vue connue. Tri stable et recalculé en direct à chaque ajout/suppression.
5. **Appliquer le tri** — dans `montage.tsx`, utiliser `orderedClips` partout où la timeline est construite et jouée (`buildTimeline`, `runTimeline`, prévisualisation). La suppression par id et la liste affichée continuent de fonctionner.
6. **UI** — dans la liste des clips :
   - afficher le nombre de vues formaté (ex. « 1,2 M vues ») quand il est connu ;
   - badge « Top » sur les 3 clips qui entrent dans l'intro.
   - pas de changement sur l'intro elle-même (durée, effets, montage identiques).

## Hors périmètre

- Pas de backend/base de données : tout reste côté navigateur.
- Pas de changement sur la coupe des blancs (page d'accueil).

## Technique

- tikwm `play_count` peut être absent ou en chaîne : conversion robuste en nombre, `undefined` sinon.
- Le tri est un `useMemo` dérivé de `clips` — aucun état supplémentaire à synchroniser.
