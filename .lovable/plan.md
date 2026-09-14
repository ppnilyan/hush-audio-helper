# Export vidéo continu en qualité maximale

## Objectif
Produire un seul fichier MP4 final, lu dans le bon ordre du début à la fin sur TikTok, WhatsApp et la galerie, sans viser une taille précise.

## Changements
- Enregistrer le montage en un seul flux sur tous les appareils, sans fragments intermédiaires susceptibles de désynchroniser les plans.
- Finaliser systématiquement chaque export par un réencodage complet en H.264, 1080 × 1920, 60 images/seconde et AAC stéréo 48 kHz.
- Remplacer la cible de 250 Mo par un réglage de qualité élevée à taille variable : la taille dépendra uniquement de la durée et du contenu.
- Recréer les horodatages vidéo et audio, forcer une cadence constante et arrêter précisément les deux pistes à la durée du montage.
- Ne plus conserver ni proposer un fichier brut lorsque la finalisation échoue, afin d’éviter qu’une vidéo apparemment terminée soit ensuite corrompue sur TikTok.
- Afficher clairement la phase de finalisation et une erreur exploitable si l’appareil ne peut pas terminer l’encodage.

## Validation
- Vérifier le format final et la durée déclarée.
- Tester le parcours de génération jusqu’à l’historique et le téléchargement.
- Confirmer que le libellé indique bien MP4, 1080p et 60 ips.

## Détail technique
Le fichier final utilisera H.264 High, cadence constante 60 ips, pixels YUV 4:2:0, audio AAC 320 kb/s à 48 kHz, index MP4 placé au début et qualité visuelle pilotée par CRF plutôt que par une taille en mégaoctets.
