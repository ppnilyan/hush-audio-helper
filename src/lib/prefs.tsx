import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = ["aurora", "ocean", "sunset", "sakura", "citrus"] as const;
export type ThemeId = (typeof THEMES)[number];

export type Lang = "fr" | "en";

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
  themeAurora: "Aurora (green → violet)",
  themeOcean: "Ocean (cyan → indigo)",
  themeSunset: "Sunset (amber → pink)",
  themeSakura: "Sakura (pink → violet)",
  themeCitrus: "Citrus (lime → teal)",
};

const dict = { fr, en };

const Ctx = createContext<PrefsCtx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("aurora");
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemeId | null;
    const storedLang = localStorage.getItem(LANG_KEY) as Lang | null;
    if (storedTheme && THEMES.includes(storedTheme)) setThemeState(storedTheme);
    if (storedLang === "fr" || storedLang === "en") setLangState(storedLang);
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
  "Disponible avec les formules Pro et Elite.": "Available with the Pro and Elite plans.",
};

/** Traduit une chaîne écrite en français vers la langue active. */
export function useTr() {
  const { lang } = usePrefs();
  return (s: string) => (lang === "en" ? (FR_EN[s] ?? s) : s);
}

/** Locale utilisée pour les dates et les nombres. */
export function useLocale() {
  const { lang } = usePrefs();
  return lang === "en" ? "en-US" : "fr-FR";
}
