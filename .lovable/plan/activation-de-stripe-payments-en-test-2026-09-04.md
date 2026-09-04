# Activation de Stripe Payments en test

## Objectif
Activer le système Payments intégré de Lovable avec Stripe, **uniquement en environnement test**, sans toucher à la page Tarifs, aux abonnements et aux boutons existants du projet.

## État actuel (vérifié)
- Plan Lovable : Pro (actif) — prérequis rempli.
- Aucune intégration de paiement (Stripe, Paddle ou Shopify) n'est détectée dans le projet.
- Le pays vendeur confirmé est la France.
- Le système actuel de crédits et d'abonnements repose sur un mode fictif côté base ; la bascule vers Stripe Payments remplacera uniquement le moteur d'achat, pas les formules affichées.

## Étapes

1. **Activer Stripe Payments intégré**
   - Utiliser l'outil Lovable `enable_stripe_payments`.
   - Cela crée immédiatement un environnement de test (sandbox) sans compte Stripe préalable.

2. **Configurer la gestion fiscale par défaut**
   - Pays vendeur : France.
   - Produit : service numérique (génération de vidéos) — éligible au traitement complet de conformité.
   - Par défaut : activer le mode `managed_payments` pour que Stripe gère la conformité fiscale, la fraude, les litiges et le support transactionnel (~80 pays, +3,5 % par transaction).
   - L'utilisateur pourra modifier ce choix par transaction ou le désactiver plus tard.

3. **Vérifier l'environnement test créé**
   - Confirmer que le mode test est actif et que les clés/point de terminaison de test sont en place.
   - Ne pas créer de produits ni ne modifier le front pour l'instant.

## Livrable attendu
- Stripe Payments est activé en test sur le projet.
- L'environnement sandbox est prêt à recevoir les produits et le flux de paiement.
- Aucune modification de `src/routes/pricing.tsx`, `src/lib/billing.ts`, `src/lib/billing.functions.ts` ni des boutons d'achat existants.

## Notes
- Les paiements en direct nécessiteront une étape de réclamation de compte / vérification Stripe.
- Le passage à Stripe ne changera pas les prix, les crédits ou les restrictions de formules déjà définis dans le code et la base.
