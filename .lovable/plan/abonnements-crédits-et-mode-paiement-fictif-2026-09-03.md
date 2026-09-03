# Abonnements, crédits et mode « paiement fictif »

## Offre (validée ensemble)

10 crédits = 1 vidéo générée.

| Formule | Prix / mois | Crédits / mois | Accès |
| --- | --- | --- | --- |
| Gratuit | 0 € | 10 crédits offerts à l'inscription (une fois) | Mode simple, thème Aurora, musique incluse seule |
| Starter | 17 € | 300 (30 vidéos) | Tout le mode simple, thème Aurora seul, musique incluse seule, pas d'import de musique, pas d'options avancées |
| Pro | 27 € | 600 (60 vidéos) | Options avancées, tous les thèmes, import de musique |
| Elite | 47 € | 1 500 (150 vidéos) | Accès à tout + badge « Elite » + support prioritaire |

Packs de recharge (ouverts à tous, −20 % pour les abonnés) :

| Pack | Prix public | Prix abonné |
| --- | --- | --- |
| 50 crédits | 6,90 € | 5,52 € |
| 100 crédits | 12,90 € | 10,32 € |
| 300 crédits | 34,90 € | 27,92 € |

Règles :
- Les crédits mensuels de l'abonnement sont remis à zéro et re-crédités chaque mois (pas de report). Les crédits achetés en pack n'expirent pas et sont consommés après les crédits mensuels.
- Chaque génération réussie débite 10 crédits ; une génération échouée ne débite rien.
- Sans crédits suffisants : le bouton « Générer » affiche « Plus de crédits » et renvoie vers la page tarifs. La prévisualisation reste libre.
- Un compte est obligatoire pour générer (les crédits sont liés au compte).

## Mode fictif (pour toi uniquement)

- Ton compte reçoit le rôle `admin` en base (je l'attribue dès que tu t'es connecté une première fois : la base ne contient encore aucun compte).
- En tant qu'admin, la page tarifs affiche un bandeau « Mode test — porte-monnaie fictif : 1 000 000 € » ; chaque bouton « S'abonner » / « Acheter » aboutit instantanément (abonnement activé, crédits ajoutés, solde fictif décrémenté, achat marqué `test`).
- Tu peux aussi annuler / changer de formule depuis « Mon abonnement ».
- Pour tous les autres comptes : la page tarifs est visible, mais les boutons affichent « Bientôt disponible ». Ils gardent leurs 10 crédits de bienvenue.
- Le jour où l'on branche le vrai paiement, seul le « moteur d'achat » change : la page, les formules, les crédits et les restrictions restent identiques.

## Ce qui change dans l'app

1. **Page `/pricing`** : 3 cartes de formules (Pro mise en avant), bloc packs de crédits avec le prix barré / prix abonné, FAQ courte, en FR/EN, dans le style du site.
2. **Header** : pastille « 290 crédits » à côté du compte (clic → `/pricing`), badge de formule (Starter / Pro / Elite).
3. **Menu Compte** : « Mon abonnement » (formule, prochain renouvellement, crédits mensuels restants + crédits achetés, historique des achats, annuler / changer).
4. **Génération** : vérification et débit des crédits côté serveur au moment de « Générer » ; message clair si solde insuffisant.
5. **Restrictions par formule** :
   - Thèmes : seuls Pro / Elite peuvent choisir autre chose qu'Aurora (les autres thèmes sont grisés avec cadenas « Pro »).
   - Musique : « Importer ma musique » verrouillée avec cadenas « Pro » pour Gratuit / Starter.
   - Options avancées : l'interrupteur (étape Clips + Paramètres) est verrouillé « Pro » pour Gratuit / Starter ; le mode simple s'applique.
   - Un clic sur un cadenas ouvre `/pricing`.
6. **Nouveaux comptes** : 10 crédits crédités automatiquement à l'inscription.

## Détails techniques

Base de données (une migration) :
- `app_role` enum + table `user_roles` + fonction `has_role()` (modèle sécurisé, rôle hors de la table profil).
- `plans` (id, nom, prix cents, crédits mensuels, drapeaux : options avancées, tous thèmes, import musique).
- `credit_packs` (id, crédits, prix cents).
- `user_subscriptions` (user_id, plan_id, statut, période courante, `monthly_credits_remaining`, `renews_at`).
- `credit_wallets` (user_id, `purchased_credits`, `fake_balance_cents` pour l'admin).
- `credit_transactions` (journal : bienvenue, renouvellement, achat pack, génération, avec `mode = 'test' | 'live'`).
- Trigger sur création d'utilisateur → wallet + 10 crédits + transaction « welcome ».
- GRANT + RLS sur chaque table : lecture de ses propres lignes ; **aucune écriture directe depuis le client** (tout passe par des fonctions serveur).

Fonctions serveur (`src/lib/billing.functions.ts`, `requireSupabaseAuth`, client admin côté serveur après vérification du rôle) :
- `getBillingState` — formule, crédits, drapeaux d'accès.
- `consumeCredits` — débit atomique de 10 crédits (mensuels d'abord, puis achetés) ; appelé au début de `generate()` ; remboursement si l'export échoue.
- `fakeSubscribe`, `fakeBuyPack`, `fakeCancel` — réservées aux admins (vérif `has_role`), simulent l'achat et décrémentent le porte-monnaie fictif.
- Renouvellement mensuel simulé : à la première connexion après `renews_at`, les crédits mensuels sont re-crédités et la date avancée d'un mois.

Front :
- `src/lib/billing.ts` : hook `useBilling()` (React Query) exposant `plan`, `credits`, `can.advanced`, `can.allThemes`, `can.importMusic`, `isAdmin`.
- Nouvelles routes `src/routes/pricing.tsx` et `src/routes/account.tsx`, avec `head()` dédié (titre/description).
- `HeaderActions.tsx` : pastille crédits + badge formule + entrée « Mon abonnement » ; interrupteur options avancées verrouillé selon `can.advanced` ; thèmes verrouillés selon `can.allThemes`.
- `montage.tsx` : import de musique verrouillé selon `can.importMusic` ; `generate()` appelle `consumeCredits` avant l'export ; état « plus de crédits ».
- `advanced-mode.ts` : `setAdvanced(true)` refusé si `can.advanced` est faux (forcé à `false`).
- Traductions FR/EN ajoutées dans `prefs.tsx`.

Hors périmètre (plus tard) : paiement réel, factures, TVA, e-mails de renouvellement.
