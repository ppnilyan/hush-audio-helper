# Roadmap

- [x] Récupération TikTok fiable en production (cookies de session + proxy vidéo)
- [x] Remplacer Stripe par PayPal en mode LIVE
  - [x] Packs de crédits en paiement unique PayPal
  - [x] Abonnements Starter / Pro / Elite via PayPal
  - [x] Crédits/abonnements activés uniquement après vérification serveur (capture + webhook)
  - [x] Retirer Stripe du parcours utilisateur, garder le design actuel
  - [ ] Ajouter le secret PAYPAL_WEBHOOK_ID + webhook PayPal vers /api/public/paypal/webhook
