# Nouvelle étape : Musique de fond

Ajout d'une 5e étape « Musique de fond », placée juste après « Voix off » et
avant « Prévisualisation ».

## Ce que contient l'étape

- **Aucune musique** (option par défaut désactivable) — choix vide.
- **Piste incluse** : le morceau fourni (« Mysterious and Sad »), proposé dans
  une case cliquable. Il fait 5 min 54 à l'origine : la lecture est limitée à
  2 minutes maximum, et coupée avant si la voix off est plus courte.
- **Importer ma musique** : zone d'import de fichier audio (mp3, wav, m4a, ogg)
  depuis l'ordinateur, comme pour la voix off.
- **Volume** : réglage par défaut à −30 dB (musique très en retrait derrière la
  voix), ajustable de −40 dB à 0 dB.
- Lecteur audio pour écouter la piste choisie avant de continuer.

## Comportement

- La musique démarre en même temps que la voix off et **s'arrête toujours
  exactement à la fin de la voix off** (la voix reste l'horloge maîtresse du
  montage), avec un fondu de sortie court pour éviter la coupure sèche.
- Si la voix dure plus de 2 minutes, la musique s'arrête quand même à 2 min.
- Étape optionnelle : on peut passer à la prévisualisation sans musique.
- La musique est audible en prévisualisation comme dans la vidéo générée.

## Détails techniques

- La piste fournie est hébergée en asset CDN (`lovable-assets`) et référencée
  par un pointeur JSON dans `src/assets/` — le binaire n'entre pas dans le repo.
- Nouveau store `src/lib/music-store.ts` sur le modèle de `voiceover-store.ts`
  (piste courante : source incluse ou fichier importé, gain en dB).
- `STEPS` de `src/routes/montage.tsx` passe à 5 entrées ; la navigation, les
  index d'étapes et les gardes (`canNext`) sont décalés en conséquence.
- Mixage : dans `generate()`, le graphe Web Audio existant reçoit une seconde
  source (`createMediaElementSource` sur la musique) branchée sur un
  `GainNode` (`gain = 10^(dB/20)`, soit ≈ 0,0316 à −30 dB) puis sur le même
  `MediaStreamDestination`. Même graphe côté prévisualisation.
- Arrêt de la musique : `min(durée voix, 120 s)` via la boucle de timeline
  existante, plus `pause()` sur le même point d'arrêt que la voix.
- Le gain en dB et le choix de piste incluse sont ajoutés à `MontageSettings`
  (`src/lib/settings.ts`, avec `normalizeSettings`) pour être sauvegardés sur le
  compte comme les autres réglages ; un fichier importé reste local à la session.
- Tous les libellés passent par le système de traduction FR/EN existant
  (`usePrefs`), style repris des étapes actuelles.
