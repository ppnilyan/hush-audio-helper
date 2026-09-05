import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = ["aurora", "ocean", "sunset", "sakura", "citrus"] as const;
export type ThemeId = (typeof THEMES)[number];

export const LANGS = ["fr", "en", "es", "de"] as const;
export type Lang = (typeof LANGS)[number];

/** Drapeau + libellé court affichés dans le sélecteur de langue. */
export const LANG_META: Record<Lang, { flag: string; label: string; locale: string }> = {
  fr: { flag: "🇫🇷", label: "FR", locale: "fr-FR" },
  en: { flag: "🇬🇧", label: "EN", locale: "en-US" },
  es: { flag: "🇪🇸", label: "ES", locale: "es-ES" },
  de: { flag: "🇩🇪", label: "DE", locale: "de-DE" },
};

const THEME_KEY = "sc.theme";
const LANG_KEY = "sc.lang";

type PrefsCtx = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof fr) => string;
};

const fr = {
  montage: "Montage",
  history: "Historique",
  account: "Mon compte",
  settings: "Paramètres",
  faq: "FAQ",
  signIn: "Se connecter",
  signOut: "Se déconnecter",
  signedInAs: "Connecté en tant que",
  notSignedIn: "Vous n'êtes pas connecté.",
  appTheme: "Thème de l'application",
  language: "Langue",
  french: "Français",
  english: "English",
  close: "Fermer",
  settingsDesc: "Personnalisez l'apparence et la langue de l'application.",
  faqDesc: "Questions fréquentes et réponses.",
  themeAurora: "Aurora (vert → violet)",
  themeOcean: "Océan (cyan → indigo)",
  themeSunset: "Coucher de soleil (ambre → rose)",
  themeSakura: "Sakura (rose → violet)",
  themeCitrus: "Agrume (lime → turquoise)",
} as const;

const en: Record<keyof typeof fr, string> = {
  montage: "Editor",
  history: "History",
  account: "My account",
  settings: "Settings",
  faq: "FAQ",
  signIn: "Sign in",
  signOut: "Sign out",
  signedInAs: "Signed in as",
  notSignedIn: "You are not signed in.",
  appTheme: "App theme",
  language: "Language",
  french: "Français",
  english: "English",
  close: "Close",
  settingsDesc: "Customize the look and language of the app.",
  faqDesc: "Frequently asked questions and answers.",
  themeAurora: "Aurora (green → violet)",
  themeOcean: "Ocean (cyan → indigo)",
  themeSunset: "Sunset (amber → pink)",
  themeSakura: "Sakura (pink → violet)",
  themeCitrus: "Citrus (lime → teal)",
};

const es: Record<keyof typeof fr, string> = {
  montage: "Editor",
  history: "Historial",
  account: "Mi cuenta",
  settings: "Ajustes",
  faq: "FAQ",
  signIn: "Iniciar sesión",
  signOut: "Cerrar sesión",
  signedInAs: "Conectado como",
  notSignedIn: "No has iniciado sesión.",
  appTheme: "Tema de la aplicación",
  language: "Idioma",
  french: "Français",
  english: "English",
  close: "Cerrar",
  settingsDesc: "Personaliza la apariencia y el idioma de la aplicación.",
  faqDesc: "Preguntas frecuentes y respuestas.",
  themeAurora: "Aurora (verde → violeta)",
  themeOcean: "Océano (cian → índigo)",
  themeSunset: "Atardecer (ámbar → rosa)",
  themeSakura: "Sakura (rosa → violeta)",
  themeCitrus: "Cítrico (lima → turquesa)",
};

const de: Record<keyof typeof fr, string> = {
  montage: "Editor",
  history: "Verlauf",
  account: "Mein Konto",
  settings: "Einstellungen",
  faq: "FAQ",
  signIn: "Anmelden",
  signOut: "Abmelden",
  signedInAs: "Angemeldet als",
  notSignedIn: "Du bist nicht angemeldet.",
  appTheme: "App-Design",
  language: "Sprache",
  french: "Français",
  english: "English",
  close: "Schließen",
  settingsDesc: "Passe Aussehen und Sprache der App an.",
  faqDesc: "Häufig gestellte Fragen und Antworten.",
  themeAurora: "Aurora (grün → violett)",
  themeOcean: "Ozean (cyan → indigo)",
  themeSunset: "Sonnenuntergang (amber → pink)",
  themeSakura: "Sakura (pink → violett)",
  themeCitrus: "Zitrus (lime → türkis)",
};

const dict: Record<Lang, Record<keyof typeof fr, string>> = { fr, en, es, de };

const Ctx = createContext<PrefsCtx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("aurora");
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemeId | null;
    const storedLang = localStorage.getItem(LANG_KEY) as Lang | null;
    if (storedTheme && THEMES.includes(storedTheme)) setThemeState(storedTheme);
    if (storedLang && LANGS.includes(storedLang)) setLangState(storedLang);
  }, []);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  };
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  };

  return (
    <Ctx.Provider
      value={{ theme, setTheme, lang, setLang, t: (key) => dict[lang][key] ?? fr[key] }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePrefs(): PrefsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}

export const THEME_LABEL_KEYS: Record<ThemeId, keyof typeof fr> = {
  aurora: "themeAurora",
  ocean: "themeOcean",
  sunset: "themeSunset",
  sakura: "themeSakura",
  citrus: "themeCitrus",
};

/** Petites pastilles de prévisualisation (dégradé) pour chaque thème. */
export const THEME_SWATCH: Record<ThemeId, string> = {
  aurora: "linear-gradient(120deg, oklch(0.78 0.19 155), oklch(0.72 0.19 350), oklch(0.68 0.2 305))",
  ocean: "linear-gradient(120deg, oklch(0.8 0.14 195), oklch(0.7 0.15 240), oklch(0.62 0.19 275))",
  sunset: "linear-gradient(120deg, oklch(0.83 0.16 80), oklch(0.72 0.19 30), oklch(0.68 0.2 350))",
  sakura: "linear-gradient(120deg, oklch(0.82 0.12 350), oklch(0.72 0.19 330), oklch(0.66 0.2 300))",
  citrus: "linear-gradient(120deg, oklch(0.88 0.19 120), oklch(0.82 0.15 160), oklch(0.75 0.14 195))",
};

/* ---------------- Traduction du contenu (source française) ---------------- */

/** Dictionnaire FR → EN pour tout le contenu de l'application. */
export const FR_EN: Record<string, string> = {
  "Montage vertical": "Vertical edit",
  "Clips TikTok + voix off": "TikTok clips + voiceover",
  Connecté: "Signed in",
  "Réglages sauvegardés ✓": "Settings saved ✓",
  "Se déconnecter": "Sign out",
  "Se connecter pour sauvegarder réglages, presets et historique":
    "Sign in to save your settings, presets and history",
  Montage: "Editor",
  Historique: "History",
  "Les vidéos générées restent disponibles 5 heures sur votre compte, depuis n'importe quel appareil.":
    "Generated videos stay available for 5 hours on your account, from any device.",
  "Les vidéos générées restent disponibles 5 heures sur cet appareil. Connectez-vous pour lier votre historique à votre compte.":
    "Generated videos stay available for 5 hours on this device. Sign in to link your history to your account.",
  "Aucune vidéo pour l'instant.": "No video yet.",
  "Télécharger le": "Download the",
  Supprimer: "Delete",
  restantes: "left",
  Clips: "Clips",
  "Durées & effets": "Durations & effects",
  "Voix off": "Voiceover",
  Prévisualisation: "Preview",
  "Ajoutez vos clips": "Add your clips",
  "Collez vos liens TikTok à la suite : chaque lien libère automatiquement le champ suivant et se télécharge en HD au fur et à mesure.":
    "Paste your TikTok links one after another: each link automatically opens the next field and downloads in HD as you go.",
  "Téléchargement…": "Downloading…",
  "En attente…": "Pending…",
  "Prêt ✓": "Ready ✓",
  Réessayer: "Retry",
  "Importer un fichier": "Import a file",
  "Fait partie des 3 clips les plus vus — utilisé dans l'intro":
    "One of the 3 most-viewed clips — used in the intro",
  Top: "Top",
  vues: "views",
  "Qualité SD — cliquez pour tenter une récupération en HD":
    "SD quality — click to try fetching it in HD",
  "Tenter de récupérer en HD": "Try to fetch in HD",
  "Indisponible (import manuel)": "Unavailable (manual import)",
  Retirer: "Remove",
  "Aucun clip pour l'instant.": "No clip yet.",
  "Ajoutez au moins 2 clips pour continuer.": "Add at least 2 clips to continue.",
  "Connectez-vous ou créez un compte pour continuer.": "Sign in or create an account to continue.",
  "Durées et effets": "Durations and effects",
  "Réglez l'intro (3 clips les plus vus) puis les effets appliqués à tout le montage.":
    "Set the intro (3 most-viewed clips) then the effects applied to the whole edit.",
  "Durée du clip": "Duration of clip",
  "dans l'intro": "in the intro",
  "Intro totale": "Total intro",
  "Effet miroir": "Mirror effect",
  "Zoom / recadrage": "Zoom / crop",
  "Vitesse de lecture": "Playback speed",
  Luminosité: "Brightness",
  Contraste: "Contrast",
  Saturation: "Saturation",
  "Bande floue — haut": "Blurred band — top",
  "Bande floue — bas": "Blurred band — bottom",
  "Intensité du flou": "Blur intensity",
  Presets: "Presets",
  "Connectez-vous": "Sign in",
  "pour enregistrer vos presets et retrouver vos réglages automatiquement.":
    "to save your presets and restore your settings automatically.",
  "Vos réglages sont sauvegardés automatiquement, même sans preset.":
    "Your settings are saved automatically, even without a preset.",
  "Aucun preset enregistré.": "No preset saved.",
  "Nom du preset": "Preset name",
  "Enregistrer les réglages actuels": "Save current settings",
  "Voix off / Audio": "Voiceover / Audio",
  "Choisissez comment votre audio doit être intégré au montage.":
    "Choose how your audio should be added to the edit.",
  "Ajouter l'audio": "Add the audio",
  "L'audio est utilisé tel quel, sans modification.": "The audio is used as is, unchanged.",
  "Ajouter l'audio et supprimer les blancs": "Add the audio and remove the silences",
  "Les silences sont coupés jusqu'à la durée cible choisie.":
    "Silences are cut until the chosen target duration.",
  "Intervalle des blancs à supprimer": "Range of silences to remove",
  "Sensibilité de détection": "Detection sensitivity",
  "Durée cible — minutes": "Target duration — minutes",
  Secondes: "Seconds",
  Cible: "Target",
  "Traitement…": "Processing…",
  "Choisir le fichier audio": "Choose the audio file",
  "mesure…": "measuring…",
  aucune: "none",
  "Montage final": "Final edit",
  séquences: "sequences",
  "Durée calée exactement sur la voix off.": "Duration matches the voiceover exactly.",
  "Écart de": "Off by",
  "Analyse de la voix off…": "Analyzing the voiceover…",
  Arrêter: "Stop",
  Prévisualiser: "Preview",
  "Génération…": "Generating…",
  "Générer la vidéo": "Generate the video",
  "La vidéo générée est ajoutée automatiquement à l'historique.":
    "The generated video is automatically added to the history.",
  "← Précédent": "← Back",
  "Suivant →": "Next →",
  "Vidéo illisible": "Unreadable video",
  "Téléchargement impossible": "Download failed",
  "Ce lien n'a pas pu être récupéré. Importez la vidéo manuellement.":
    "This link could not be fetched. Import the video manually.",
  "Téléchargement HD impossible": "HD download failed",
  "Vidéo HD illisible": "Unreadable HD video",
  "La qualité HD n'a pas pu être récupérée.": "HD quality could not be retrieved.",
  "La génération a échoué.": "Generation failed.",
  "Impossible de lire ce fichier audio. Essayez un MP3 ou un WAV.":
    "This audio file could not be read. Try an MP3 or a WAV.",
  "Enregistrement du preset impossible.": "Could not save the preset.",
  "Audio ajouté tel quel": "Audio added as is",
  "blanc(s) supprimé(s) sur": "silence(s) removed out of",
  "détecté(s)": "detected",
  "durée cible non atteinte": "target duration not reached",
  // Auth
  "Se connecter": "Sign in",
  "Créer un compte": "Create an account",
  "Créer mon compte": "Create my account",
  "Vos presets, vos derniers réglages et votre historique sont sauvegardés sur votre compte.":
    "Your presets, latest settings and history are saved to your account.",
  "E-mail": "Email",
  "Mot de passe": "Password",
  "Continuer avec Google": "Continue with Google",
  "Pas encore de compte ? Créer un compte": "No account yet? Create one",
  "J'ai déjà un compte": "I already have an account",
  "Compte créé. Vérifiez votre boîte mail si une confirmation est demandée.":
    "Account created. Check your inbox if a confirmation is required.",
  "Connexion impossible.": "Sign-in failed.",
  "Connexion Google impossible.": "Google sign-in failed.",
  // Facturation
  "Tarifs": "Pricing",
  "Une formule, des vidéos à la chaîne": "One plan, videos on repeat",
  "10 crédits = 1 vidéo générée. Les crédits mensuels se renouvellent chaque mois ; les crédits achetés en pack n'expirent jamais.":
    "10 credits = 1 generated video. Monthly credits renew every month; credits bought in packs never expire.",
  "Votre solde": "Your balance",
  "crédits": "credits",
  "crédits / mois": "credits / month",
  "vidéos": "videos",
  "vidéos / mois": "videos / month",
  "mois": "month",
  "Montage automatique complet (mode simple)": "Full automatic editing (simple mode)",
  "Musique incluse « Mysterious and Sad »": "Included track “Mysterious and Sad”",
  "Importer ma propre musique": "Import my own music",
  "Tous les thèmes de l'application": "All app themes",
  "Thème Aurora uniquement": "Aurora theme only",
  "Options avancées (durées, effets, détection des blancs, volume)":
    "Advanced options (durations, effects, silence detection, volume)",
  "sur les packs de crédits": "on credit packs",
  "Badge Elite + support prioritaire": "Elite badge + priority support",
  "Le plus choisi": "Most popular",
  "Se connecter pour commencer": "Sign in to get started",
  "Formule actuelle": "Current plan",
  "Bientôt disponible": "Coming soon",
  "Changer pour cette formule": "Switch to this plan",
  "S'abonner": "Subscribe",
  "Mode test — porte-monnaie fictif": "Test mode — fake wallet",
  "Aucun paiement réel : chaque achat est instantané et marqué « test ». Les autres comptes voient « Bientôt disponible ».":
    "No real payment: every purchase is instant and marked “test”. Other accounts see “Coming soon”.",
  "Solde fictif insuffisant.": "Insufficient fake balance.",
  "Action impossible.": "Action failed.",
  "Achat test effectué ✓": "Test purchase done ✓",
  "Recharger des crédits": "Top up credits",
  "Sans engagement. Les abonnés bénéficient de −20 % sur tous les packs.":
    "No commitment. Subscribers get 20% off every pack.",
  "abonné": "subscriber",
  "Acheter": "Buy",
  "Que se passe-t-il quand je n'ai plus de crédits ?": "What happens when I run out of credits?",
  "Vous pouvez toujours préparer et prévisualiser votre montage. Seul le bouton « Générer la vidéo » demande 10 crédits.":
    "You can still prepare and preview your edit. Only the “Generate video” button costs 10 credits.",
  "Les crédits non utilisés sont-ils reportés ?": "Do unused credits roll over?",
  "Les crédits mensuels de l'abonnement sont remis à zéro à chaque renouvellement. Les crédits achetés en pack n'expirent jamais et sont utilisés après les crédits mensuels.":
    "Monthly subscription credits reset at each renewal. Pack credits never expire and are used after monthly credits.",
  "Puis-je changer de formule ?": "Can I change plans?",
  "Oui, à tout moment depuis « Mon abonnement ». La nouvelle formule s'applique immédiatement.":
    "Yes, anytime from “My subscription”. The new plan applies immediately.",
  "Et sans abonnement ?": "And without a subscription?",
  "Chaque nouveau compte reçoit 10 crédits offerts, soit une vidéo d'essai, et peut acheter des packs de crédits.":
    "Every new account gets 10 free credits — one trial video — and can buy credit packs.",
  "Mon abonnement": "My subscription",
  "Connectez-vous pour voir votre formule et vos crédits.": "Sign in to see your plan and credits.",
  "Compte": "Account",
  "Formule": "Plan",
  "Gratuit": "Free",
  "Renouvellement le": "Renews on",
  "Résilié — accès jusqu'au": "Canceled — access until",
  "test": "test",
  "Crédits mensuels restants": "Monthly credits left",
  "sur": "of",
  "Crédits achetés": "Purchased credits",
  "n'expirent jamais": "never expire",
  "Total": "Total",
  "Changer de formule / recharger": "Change plan / top up",
  "Voir les formules": "See plans",
  "Annuler l'abonnement": "Cancel subscription",
  "Crédits de bienvenue": "Welcome credits",
  "Renouvellement mensuel": "Monthly renewal",
  "Abonnement": "Subscription",
  "Pack de crédits": "Credit pack",
  "Génération vidéo": "Video generation",
  "Remboursement": "Refund",
  "Annulation": "Cancellation",
  "Aucun mouvement pour l'instant.": "No activity yet.",
  "Connectez-vous pour générer une vidéo (10 crédits offerts à l'inscription).":
    "Sign in to generate a video (10 free credits on sign-up).",
  "Plus de crédits : rechargez ou abonnez-vous pour générer cette vidéo.":
    "Out of credits: top up or subscribe to generate this video.",
  "Plus de crédits — recharger": "Out of credits — top up",
  "crédits par vidéo": "credits per video",
  "solde": "balance",
  "Recharger le solde": "Top up your balance",
  "Disponible avec les formules Pro et Elite.": "Available with the Pro and Elite plans.",
  // Page d'accueil publique
  "Notre solution": "How it works",
  "Résultats": "Results",
  "Nos offres": "Plans",
  "Guide du montage TikTok": "TikTok editing guide",
  "Connexion": "Log in",
  "Inscription": "Sign up",
  "Crée des montages qui": "Create edits that",
  "percent": "hit hard",
  "Transforme plusieurs vidéos TikTok en un seul montage vertical, prêt à être publié et monétisé.":
    "Turn several TikTok videos into one vertical edit, ready to post and monetize.",
  "Teste maintenant": "Try it now",
  "Colle le lien de ta première vidéo": "Paste the link of your first video",
  "Colle un deuxième lien": "Paste a second link",
  "Commencer gratuitement": "Start for free",
  "Passer au montage": "Open editor",
  "10 crédits offerts à l'inscription, soit une vidéo d'essai. Aucune carte bancaire demandée.":
    "10 free credits on sign-up — one trial video. No card required.",
  "Tes clips": "Your clips",
  "Ton montage prêt": "Your finished edit",
  "Plusieurs liens TikTok collés en quelques secondes.":
    "Several TikTok links pasted in seconds.",
  "Coupe des blancs, hook, effets, voix off et musique.":
    "Silence cutting, hook, effects, voiceover and music.",
  "Une vidéo verticale HD, prête à publier.": "One vertical HD video, ready to post.",
  "Trois étapes, aucun logiciel de montage": "Three steps, no editing software",
  "Colle tes liens": "Paste your links",
  "Ajoute les liens de tes vidéos préférées : chacun se télécharge en HD automatiquement.":
    "Add the links of your favourite videos: each one downloads in HD automatically.",
  "Personnalise": "Customize",
  "Voix off, musique de fond, hook d'accroche, durées et effets : tout est réglable, ou laissé en automatique.":
    "Voiceover, background music, hook, durations and effects: adjust everything, or leave it automatic.",
  "Récupère ta vidéo": "Get your video",
  "Le montage se génère tout seul et reste disponible 5 heures dans ton historique.":
    "The edit renders on its own and stays available for 5 hours in your history.",
  "Crée ton compte": "Create your account",
  "Choisis ton rythme de publication": "Pick your publishing pace",
  "Questions fréquentes": "Frequently asked questions",
  "Puis-je annuler à tout moment ?": "Can I cancel anytime?",
  "Oui. L'abonnement est sans engagement et s'arrête à la fin du mois en cours.":
    "Yes. The subscription has no commitment and stops at the end of the current month.",
  "Que deviennent mes vidéos ?": "What happens to my videos?",
  "Elles restent 5 heures dans ton historique, le temps de les télécharger, puis sont supprimées.":
    "They stay 5 hours in your history, long enough to download them, then they are deleted.",
  "Faut-il savoir monter ?": "Do I need editing skills?",
  "Non. Le mode simple ne demande que des liens ; le mode avancé est là si tu veux tout régler.":
    "No. Simple mode only asks for links; advanced mode is there if you want full control.",
  "Quelles plateformes sont compatibles ?": "Which platforms are supported?",
  "Le format vertical généré convient à TikTok, Reels et Shorts.":
    "The vertical format works for TikTok, Reels and Shorts.",
  "Est-ce que les vidéos sont bien monétisables ?": "Are the videos really monetizable?",
  "Oui : le montage combine plusieurs sources, une voix off et une musique de fond, ce qui en fait une vidéo transformée éligible au programme de récompenses TikTok.":
    "Yes: the edit combines several sources, a voiceover and background music, which makes it a transformed video eligible for the TikTok rewards program.",
  "Montage vertical automatisé pour les créateurs.": "Automated vertical editing for creators.",
  "Tous droits réservés.": "All rights reserved.",
  "Ajoute au moins un lien pour commencer.": "Add at least one link to get started.",
  "Colle tes liens, récupère un TikTok monétisable en quelques minutes.":
    "Paste your links, get a monetizable TikTok in minutes.",
  "Ce qui change concrètement avant et après SilenceCut":
    "What actually changes before and after SilenceCut",
  "Avant": "Before",
  "Après": "After",
  "Des heures passées à découper à la main": "Hours spent cutting clips by hand",
  "Des vidéos brutes que la plateforme ne récompense pas":
    "Raw videos the platform will not reward",
  "Une publication par semaine, quand tu trouves le temps":
    "One post a week, whenever you find the time",
  "Un montage vertical prêt en quelques minutes": "A vertical edit ready in minutes",
  "Une vidéo transformée, éligible aux récompenses TikTok":
    "A transformed video, eligible for TikTok rewards",
  "Plusieurs publications par jour, sans y penser":
    "Several posts a day, without thinking about it",
  "pour un montage complet": "for a full edit",
  "= une vidéo prête à publier": "= one video ready to post",
  "suffisent pour commencer": "are enough to start",
  "Publie et encaisse": "Post and get paid",
  "Tu récupères une vidéo verticale transformée, prête à être publiée et récompensée.":
    "You get a transformed vertical video, ready to be posted and rewarded.",
  "Pourquoi mes vidéos deviennent monétisables ?": "Why do my videos become monetizable?",
  "Le montage assemble plusieurs sources, ajoute un hook, une voix off et une musique de fond : le résultat est une vidéo transformée, celle que le programme de récompenses TikTok accepte.":
    "The edit combines several sources and adds a hook, a voiceover and background music: the result is a transformed video, the kind the TikTok rewards program accepts.",
  "Combien de vidéos puis-je publier par jour ?": "How many videos can I post per day?",
  "Autant que tes crédits le permettent : une vidéo coûte 10 crédits, donc une formule à 600 crédits représente environ 60 montages par mois.":
    "As many as your credits allow: one video costs 10 credits, so a 600-credit plan is about 60 edits a month.",
  "Combien de temps pour récupérer un montage ?": "How long does an edit take?",
  "Environ trois minutes entre le collage des liens et le téléchargement du fichier vertical HD.":
    "About three minutes from pasting the links to downloading the vertical HD file.",
};


/** Dictionnaire FR → ES (page publique en priorité). */
export const FR_ES: Record<string, string> = {
  "Notre solution": "Cómo funciona",
  "Résultats": "Resultados",
  "Nos offres": "Planes",
  "Guide du montage TikTok": "Guía de edición para TikTok",
  "Connexion": "Iniciar sesión",
  "Inscription": "Registrarse",
  "Crée des montages qui": "Crea montajes que",
  "percent": "impactan",
  "Transforme plusieurs vidéos TikTok en un seul montage vertical, prêt à être publié et monétisé.":
    "Convierte varios vídeos de TikTok en un único montaje vertical, listo para publicar y monetizar.",
  "Teste maintenant": "Pruébalo ahora",
  "Colle le lien de ta première vidéo": "Pega el enlace de tu primer vídeo",
  "Colle un deuxième lien": "Pega un segundo enlace",
  "Commencer gratuitement": "Empezar gratis",
  "Passer au montage": "Abrir editor",
  "10 crédits offerts à l'inscription, soit une vidéo d'essai. Aucune carte bancaire demandée.":
    "10 créditos de regalo al registrarte, un vídeo de prueba. Sin tarjeta bancaria.",
  "Tes clips": "Tus clips",
  "Ton montage prêt": "Tu montaje listo",
  "Plusieurs liens TikTok collés en quelques secondes.":
    "Varios enlaces de TikTok pegados en segundos.",
  "Coupe des blancs, hook, effets, voix off et musique.":
    "Corte de silencios, hook, efectos, voz en off y música.",
  "Une vidéo verticale HD, prête à publier.": "Un vídeo vertical en HD, listo para publicar.",
  "Trois étapes, aucun logiciel de montage": "Tres pasos, sin programas de edición",
  "Colle tes liens": "Pega tus enlaces",
  "Ajoute les liens de tes vidéos préférées : chacun se télécharge en HD automatiquement.":
    "Añade los enlaces de tus vídeos favoritos: cada uno se descarga en HD automáticamente.",
  "Personnalise": "Personaliza",
  "Voix off, musique de fond, hook d'accroche, durées et effets : tout est réglable, ou laissé en automatique.":
    "Voz en off, música de fondo, hook, duraciones y efectos: todo ajustable o en automático.",
  "Récupère ta vidéo": "Recibe tu vídeo",
  "Le montage se génère tout seul et reste disponible 5 heures dans ton historique.":
    "El montaje se genera solo y queda disponible 5 horas en tu historial.",
  "Crée ton compte": "Crea tu cuenta",
  "Choisis ton rythme de publication": "Elige tu ritmo de publicación",
  "Questions fréquentes": "Preguntas frecuentes",
  "Puis-je annuler à tout moment ?": "¿Puedo cancelar cuando quiera?",
  "Oui. L'abonnement est sans engagement et s'arrête à la fin du mois en cours.":
    "Sí. La suscripción no tiene compromiso y termina al final del mes en curso.",
  "Que deviennent mes vidéos ?": "¿Qué pasa con mis vídeos?",
  "Elles restent 5 heures dans ton historique, le temps de les télécharger, puis sont supprimées.":
    "Permanecen 5 horas en tu historial para descargarlos y luego se eliminan.",
  "Faut-il savoir monter ?": "¿Hace falta saber editar?",
  "Non. Le mode simple ne demande que des liens ; le mode avancé est là si tu veux tout régler.":
    "No. El modo simple solo pide enlaces; el modo avanzado está ahí si quieres controlarlo todo.",
  "Quelles plateformes sont compatibles ?": "¿Qué plataformas son compatibles?",
  "Le format vertical généré convient à TikTok, Reels et Shorts.":
    "El formato vertical funciona en TikTok, Reels y Shorts.",
  "Est-ce que les vidéos sont bien monétisables ?": "¿Los vídeos se pueden monetizar?",
  "Oui : le montage combine plusieurs sources, une voix off et une musique de fond, ce qui en fait une vidéo transformée éligible au programme de récompenses TikTok.":
    "Sí: el montaje combina varias fuentes, una voz en off y música de fondo, lo que lo convierte en un vídeo transformado elegible para el programa de recompensas de TikTok.",
  "Montage vertical automatisé pour les créateurs.":
    "Montaje vertical automatizado para creadores.",
  "Tous droits réservés.": "Todos los derechos reservados.",
  "Ajoute au moins un lien pour commencer.": "Añade al menos un enlace para empezar.",
  "crédits / mois": "créditos / mes",
  "vidéos / mois": "vídeos / mes",
  "mois": "mes",
  "Le plus choisi": "El más elegido",
  "Colle tes liens, récupère un TikTok monétisable en quelques minutes.":
    "Pega tus enlaces y consigue un TikTok monetizable en minutos.",
  "Ce qui change concrètement avant et après SilenceCut":
    "Lo que cambia de verdad antes y después de SilenceCut",
  "Avant": "Antes",
  "Après": "Después",
  "Des heures passées à découper à la main": "Horas cortando clips a mano",
  "Des vidéos brutes que la plateforme ne récompense pas":
    "Vídeos en bruto que la plataforma no recompensa",
  "Une publication par semaine, quand tu trouves le temps":
    "Una publicación por semana, cuando encuentras tiempo",
  "Un montage vertical prêt en quelques minutes": "Un montaje vertical listo en minutos",
  "Une vidéo transformée, éligible aux récompenses TikTok":
    "Un vídeo transformado, elegible para las recompensas de TikTok",
  "Plusieurs publications par jour, sans y penser": "Varias publicaciones al día, sin esfuerzo",
  "pour un montage complet": "para un montaje completo",
  "= une vidéo prête à publier": "= un vídeo listo para publicar",
  "suffisent pour commencer": "bastan para empezar",
  "Publie et encaisse": "Publica y cobra",
  "Tu récupères une vidéo verticale transformée, prête à être publiée et récompensée.":
    "Recibes un vídeo vertical transformado, listo para publicar y ser recompensado.",
  "Pourquoi mes vidéos deviennent monétisables ?": "¿Por qué mis vídeos son monetizables?",
  "Le montage assemble plusieurs sources, ajoute un hook, une voix off et une musique de fond : le résultat est une vidéo transformée, celle que le programme de récompenses TikTok accepte.":
    "El montaje combina varias fuentes y añade hook, voz en off y música de fondo: el resultado es un vídeo transformado, el que acepta el programa de recompensas de TikTok.",
  "Combien de vidéos puis-je publier par jour ?": "¿Cuántos vídeos puedo publicar al día?",
  "Autant que tes crédits le permettent : une vidéo coûte 10 crédits, donc une formule à 600 crédits représente environ 60 montages par mois.":
    "Tantos como permitan tus créditos: un vídeo cuesta 10 créditos, así que un plan de 600 créditos son unos 60 montajes al mes.",
  "Combien de temps pour récupérer un montage ?": "¿Cuánto tarda un montaje?",
  "Environ trois minutes entre le collage des liens et le téléchargement du fichier vertical HD.":
    "Unos tres minutos desde pegar los enlaces hasta descargar el archivo vertical en HD.",
};


/** Dictionnaire FR → DE (page publique en priorité). */
export const FR_DE: Record<string, string> = {
  "Notre solution": "So funktioniert es",
  "Résultats": "Ergebnisse",
  "Nos offres": "Tarife",
  "Guide du montage TikTok": "TikTok-Schnittanleitung",
  "Connexion": "Anmelden",
  "Inscription": "Registrieren",
  "Crée des montages qui": "Erstelle Schnitte, die",
  "percent": "einschlagen",
  "Transforme plusieurs vidéos TikTok en un seul montage vertical, prêt à être publié et monétisé.":
    "Verwandle mehrere TikTok-Videos in einen vertikalen Schnitt, bereit zum Posten und Monetarisieren.",
  "Teste maintenant": "Jetzt testen",
  "Colle le lien de ta première vidéo": "Füge den Link deines ersten Videos ein",
  "Colle un deuxième lien": "Füge einen zweiten Link ein",
  "Commencer gratuitement": "Kostenlos starten",
  "Passer au montage": "Editor öffnen",
  "10 crédits offerts à l'inscription, soit une vidéo d'essai. Aucune carte bancaire demandée.":
    "10 Gratis-Credits bei der Anmeldung – ein Testvideo. Keine Kreditkarte nötig.",
  "Tes clips": "Deine Clips",
  "Ton montage prêt": "Dein fertiger Schnitt",
  "Plusieurs liens TikTok collés en quelques secondes.":
    "Mehrere TikTok-Links in Sekunden eingefügt.",
  "Coupe des blancs, hook, effets, voix off et musique.":
    "Stille schneiden, Hook, Effekte, Voiceover und Musik.",
  "Une vidéo verticale HD, prête à publier.": "Ein vertikales HD-Video, bereit zum Posten.",
  "Trois étapes, aucun logiciel de montage": "Drei Schritte, keine Schnittsoftware",
  "Colle tes liens": "Links einfügen",
  "Ajoute les liens de tes vidéos préférées : chacun se télécharge en HD automatiquement.":
    "Füge die Links deiner Lieblingsvideos ein: jedes wird automatisch in HD geladen.",
  "Personnalise": "Anpassen",
  "Voix off, musique de fond, hook d'accroche, durées et effets : tout est réglable, ou laissé en automatique.":
    "Voiceover, Hintergrundmusik, Hook, Längen und Effekte: alles einstellbar oder automatisch.",
  "Récupère ta vidéo": "Video abholen",
  "Le montage se génère tout seul et reste disponible 5 heures dans ton historique.":
    "Der Schnitt entsteht automatisch und bleibt 5 Stunden in deinem Verlauf.",
  "Crée ton compte": "Konto erstellen",
  "Choisis ton rythme de publication": "Wähle dein Veröffentlichungstempo",
  "Questions fréquentes": "Häufige Fragen",
  "Puis-je annuler à tout moment ?": "Kann ich jederzeit kündigen?",
  "Oui. L'abonnement est sans engagement et s'arrête à la fin du mois en cours.":
    "Ja. Das Abo ist unverbindlich und endet zum Ende des laufenden Monats.",
  "Que deviennent mes vidéos ?": "Was passiert mit meinen Videos?",
  "Elles restent 5 heures dans ton historique, le temps de les télécharger, puis sont supprimées.":
    "Sie bleiben 5 Stunden im Verlauf zum Herunterladen und werden dann gelöscht.",
  "Faut-il savoir monter ?": "Brauche ich Schnitt-Erfahrung?",
  "Non. Le mode simple ne demande que des liens ; le mode avancé est là si tu veux tout régler.":
    "Nein. Der einfache Modus braucht nur Links; der erweiterte Modus ist für volle Kontrolle da.",
  "Quelles plateformes sont compatibles ?": "Welche Plattformen werden unterstützt?",
  "Le format vertical généré convient à TikTok, Reels et Shorts.":
    "Das vertikale Format passt zu TikTok, Reels und Shorts.",
  "Est-ce que les vidéos sont bien monétisables ?": "Sind die Videos monetarisierbar?",
  "Oui : le montage combine plusieurs sources, une voix off et une musique de fond, ce qui en fait une vidéo transformée éligible au programme de récompenses TikTok.":
    "Ja: der Schnitt kombiniert mehrere Quellen, ein Voiceover und Hintergrundmusik – ein transformiertes Video, das für das TikTok-Belohnungsprogramm infrage kommt.",
  "Montage vertical automatisé pour les créateurs.":
    "Automatisierter vertikaler Schnitt für Creator.",
  "Tous droits réservés.": "Alle Rechte vorbehalten.",
  "Ajoute au moins un lien pour commencer.": "Füge mindestens einen Link hinzu.",
  "crédits / mois": "Credits / Monat",
  "vidéos / mois": "Videos / Monat",
  "mois": "Monat",
  "Le plus choisi": "Am beliebtesten",
  "Colle tes liens, récupère un TikTok monétisable en quelques minutes.":
    "Links einfügen, in Minuten ein monetarisierbares TikTok erhalten.",
  "Ce qui change concrètement avant et après SilenceCut":
    "Was sich mit SilenceCut konkret ändert",
  "Avant": "Vorher",
  "Après": "Nachher",
  "Des heures passées à découper à la main": "Stunden manuelles Schneiden",
  "Des vidéos brutes que la plateforme ne récompense pas":
    "Rohe Videos, die die Plattform nicht belohnt",
  "Une publication par semaine, quand tu trouves le temps":
    "Ein Post pro Woche, wenn du Zeit findest",
  "Un montage vertical prêt en quelques minutes": "Ein vertikaler Schnitt in wenigen Minuten",
  "Une vidéo transformée, éligible aux récompenses TikTok":
    "Ein transformiertes Video, geeignet für TikTok-Belohnungen",
  "Plusieurs publications par jour, sans y penser": "Mehrere Posts pro Tag, ganz nebenbei",
  "pour un montage complet": "für einen kompletten Schnitt",
  "= une vidéo prête à publier": "= ein Video bereit zum Posten",
  "suffisent pour commencer": "genügen für den Start",
  "Publie et encaisse": "Posten und verdienen",
  "Tu récupères une vidéo verticale transformée, prête à être publiée et récompensée.":
    "Du bekommst ein transformiertes vertikales Video, bereit zum Posten und Belohnen.",
  "Pourquoi mes vidéos deviennent monétisables ?": "Warum sind meine Videos monetarisierbar?",
  "Le montage assemble plusieurs sources, ajoute un hook, une voix off et une musique de fond : le résultat est une vidéo transformée, celle que le programme de récompenses TikTok accepte.":
    "Der Schnitt kombiniert mehrere Quellen und ergänzt Hook, Voiceover und Hintergrundmusik: das Ergebnis ist ein transformiertes Video, wie es das TikTok-Belohnungsprogramm akzeptiert.",
  "Combien de vidéos puis-je publier par jour ?": "Wie viele Videos kann ich pro Tag posten?",
  "Autant que tes crédits le permettent : une vidéo coûte 10 crédits, donc une formule à 600 crédits représente environ 60 montages par mois.":
    "So viele, wie deine Credits erlauben: ein Video kostet 10 Credits, ein 600-Credits-Tarif sind also rund 60 Schnitte pro Monat.",
  "Combien de temps pour récupérer un montage ?": "Wie lange dauert ein Schnitt?",
  "Environ trois minutes entre le collage des liens et le téléchargement du fichier vertical HD.":
    "Etwa drei Minuten vom Einfügen der Links bis zum Download der vertikalen HD-Datei.",
};


const CONTENT: Partial<Record<Lang, Record<string, string>>> = {
  en: FR_EN,
  es: FR_ES,
  de: FR_DE,
};

/** Traduit une chaîne écrite en français vers la langue active. */
export function useTr() {
  const { lang } = usePrefs();
  return (s: string) => CONTENT[lang]?.[s] ?? s;
}

/** Locale utilisée pour les dates et les nombres. */
export function useLocale() {
  const { lang } = usePrefs();
  return LANG_META[lang].locale;
}
