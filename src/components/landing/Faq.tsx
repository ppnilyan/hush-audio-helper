import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTr } from "@/lib/prefs";

const QUESTIONS = [
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui. L'abonnement est sans engagement et s'arrête à la fin du mois en cours.",
  },
  {
    q: "Que deviennent mes vidéos ?",
    a: "Elles restent 5 heures dans ton historique, le temps de les télécharger, puis sont supprimées.",
  },
  {
    q: "Faut-il savoir monter ?",
    a: "Non. Le mode simple ne demande que des liens ; le mode avancé est là si tu veux tout régler.",
  },
  {
    q: "Quelles plateformes sont compatibles ?",
    a: "Le format vertical généré convient à TikTok, Reels et Shorts.",
  },
  {
    q: "Est-ce que les vidéos sont bien monétisables ?",
    a: "Oui : le montage combine plusieurs sources, une voix off et une musique de fond, ce qui en fait une vidéo transformée éligible au programme de récompenses TikTok.",
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
        <Accordion type="single" collapsible className="panel mt-10 px-5">
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
