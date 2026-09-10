import { createFileRoute } from "@tanstack/react-router";

import { Faq } from "@/components/landing/Faq";
import { FlowDiagram } from "@/components/landing/FlowDiagram";
import { Hero } from "@/components/landing/Hero";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { PlansSection } from "@/components/landing/PlansSection";
import { ShowcaseSection } from "@/components/landing/ShowcaseSection";
import { SolutionSteps } from "@/components/landing/SolutionSteps";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SilenceCut — Montages TikTok verticaux automatisés" },
      {
        name: "description",
        content:
          "Colle plusieurs liens TikTok et récupère un montage vertical HD : blancs coupés, hook, voix off et musique de fond, prêt à publier.",
      },
      { property: "og:title", content: "SilenceCut — Montages TikTok verticaux automatisés" },
      {
        property: "og:description",
        content:
          "Plusieurs vidéos TikTok deviennent un seul montage vertical prêt à publier et monétiser.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div>
      <LandingNav />
      <main>
        <Hero />
        <ShowcaseSection />
        <FlowDiagram />
        <SolutionSteps />
        <PlansSection />
        <Faq />
      </main>
      <LandingFooter />
    </div>
  );
}

