# Crédits & abonnement pour SilenceCut

Oui, c'est tout à fait possible. Voici comment je le mettrais en place.

## Le modèle retenu

- 1 vidéo générée = 10 crédits.
- Nouveau compte : 10 crédits offerts (soit 1 vidéo d'essai).
- Abonnement Pro : 17 €/mois, recharge automatique de crédits à chaque cycle.
- Packs de crédits à l'unité pour les utilisateurs qui ne veulent pas s'abonner.

Reste à fixer avant la mise en place : le nombre de crédits inclus dans le Pro
mensuel (ex. 500 crédits = 50 vidéos) et le contenu des packs (ex. 100 / 300 / 1000
crédits). Je peux partir sur des valeurs par défaut et tu ajustes ensuite.

## Parcours utilisateur

1. L'utilisateur voit son solde de crédits dans le header, à côté de « Mon compte ».
2. À l'étape 4 (Prévisualisation), le bouton « Générer la vidéo » affiche le coût
   (« 10 crédits »).
3. Si le solde est insuffisant, le bouton bascule sur « Obtenir des crédits » et
   ouvre la page Tarifs.
4. Page Tarifs : Gratuit / Pro 17 € par mois / packs de crédits, avec paiement
   sécurisé hébergé.
5. Après paiement, retour sur l'app avec le solde mis à jour et un message de
   confirmation.
6. Une page « Mon compte » liste le solde, l'abonnement en cours, l'historique des
   débits et un lien de gestion de l'abonnement (annulation, moyen de paiement).

Les crédits ne sont débités qu'après une génération réussie ; si le montage
échoue, ils sont remboursés automatiquement.

## Prérequis

- Les paiements intégrés Lovable nécessitent un plan Lovable payant (Pro ou
  supérieur) sur ton espace de travail. Sans cela, l'activation ne fera rien.
- Un environnement de test est créé d'abord : tu pourras tester tout le parcours
  sans argent réel. Le passage en réel demande une vérification du compte.

## Détails techniques

Base de données (Lovable Cloud, RLS activée, GRANT sur chaque table) :

- `user_credits` — solde par utilisateur, crédits offerts à l'inscription via
  trigger sur nouvel utilisateur.
- `credit_transactions` — journal immuable (achat, recharge mensuelle, débit
  génération, remboursement) pour audit et affichage historique.
- `subscriptions` — statut d'abonnement, plan, période courante, identifiant
  client côté fournisseur.

Serveur (TanStack `createServerFn`, jamais côté client) :

- `getBalance` / `getSubscription` — lecture protégée par `requireSupabaseAuth`.
- `consumeCredits` — fonction SQL atomique `spend_credits(user_id, amount)` en
  `SECURITY DEFINER` qui vérifie et décrémente en une transaction (impossible de
  passer en négatif ou de tricher côté client).
- `refundCredits` — en cas d'échec de génération.
- `createCheckout` — crée la session de paiement pour l'abonnement ou un pack.
- Webhook sous `src/routes/api/public/` avec vérification de signature : crédite
  le compte à l'achat, recharge au renouvellement, met à jour le statut à
  l'annulation ou l'échec de paiement.

Interface :

- Badge de solde dans le header (`src/components/HeaderActions.tsx`).
- Garde de crédits sur l'étape 4 de `src/routes/montage.tsx`.
- Nouvelle route `/pricing` et section abonnement dans le compte.
- Tous les libellés passent par le système de traduction FR/EN existant, et le
  style reprend les thèmes actuels (dégradé vert → violet).

## Ordre de réalisation

1. Activer les paiements intégrés (Stripe) sur le projet.
2. Créer les produits : abonnement Pro 17 €/mois + packs de crédits.
3. Migration base de données (tables, RLS, GRANT, trigger de bienvenue, fonction
   de débit atomique).
4. Fonctions serveur + webhook.
5. Interface : badge de solde, page Tarifs, garde à la génération, page compte.
6. Test complet du parcours en environnement de test.
