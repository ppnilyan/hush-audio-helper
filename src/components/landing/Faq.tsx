import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTr } from "@/lib/prefs";

const QUESTIONS = [
  {
    q: "Pourquoi mes vidéos deviennent monétisables ?",
    a: "Le montage assemble plusieurs sources, ajoute un hook, une voix off et une musique de fond : le résultat est une vidéo transformée, celle que le programme de récompenses TikTok accepte.",
  },
  {
    q: "Combien de vidéos puis-je publier par jour ?",
    a: "Autant que tes crédits le permettent : une vidéo coûte 10 crédits, donc une formule à 600 crédits représente environ 60 montages par mois.",
  },
  {
    q: "Combien de temps pour récupérer un montage ?",
    a: "Environ trois minutes entre le collage des liens et le téléchargement du fichier vertical HD.",
  },
  {
    q: "Faut-il savoir monter ?",
    a: "Non. Le mode simple ne demande que des liens ; le mode avancé est là si tu veux tout régler.",
  },
  {
    q: "Que deviennent mes vidéos ?",
    a: "Elles restent 5 heures dans ton historique, le temps de les télécharger, puis sont supprimées.",
  },
  {
    q: "Quelles plateformes sont compatibles ?",
    a: "Le format vertical généré convient à TikTok, Reels et Shorts.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui. L'abonnement est sans engagement et s'arrête à la fin du mois en cours.",
  },
];

export function Faq() {
  const tr = useTr();

  return (
    <section id="faq" className="px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-center text-3xl font-bold tracking-tight">
          {tr("Questions fréquentes")}
        </h2>
        <Accordion type="single" collapsible className="card-hover-soft panel mt-10 px-5">
          {QUESTIONS.map((item, i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger className="text-left text-base">{tr(item.q)}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {tr(item.a)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
