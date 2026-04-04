import { useEffect } from "react";
import Head from "next/head";
import { Container } from "@mantine/core";
import dynamic from "next/dynamic";
import { usePostHog } from "posthog-js/react";

// Code splitting for performance
const HeroSection = dynamic(() => import("@/components/home/HeroSection"), {
  ssr: true,
});
const HowItWorksSection = dynamic(() => import("@/components/home/HowItWorksSection"));
const DifficultySection = dynamic(() => import("@/components/home/DifficultySection"));
// const StatsSection = dynamic(() => import("@/components/home/StatsSection"));
const CTASection = dynamic(() => import("@/components/home/CTASection"));
const JoinGameSection = dynamic(() => import("@/components/home/JoinGameSection"));

export default function Home() {
  const posthog = usePostHog();

  useEffect(() => {
    posthog?.capture("homepage_viewed");
  }, [posthog]);

  return (
    <>
      <Head>
        <title>Code Battlegrounds - Master Pair Programming Through Competition</title>
        <meta 
          name="description" 
          content="Learn collaborative coding through real-time pair programming battles. Code together, test together, win together. Join thousands of developers mastering teamwork." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Code Battlegrounds - Competitive Pair Programming" />
        <meta property="og:description" content="Master pair programming through real-time coding challenges" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        {/* Hero - Above the fold, critical content */}
        <HeroSection />

        {/* Stats - Social proof */}
        {/* <StatsSection /> */}

        {/* How It Works - Education */}
        <HowItWorksSection />

        {/* Main CTA - Difficulty Selection */}
        <DifficultySection />

        {/* Secondary - Join by Game ID */}
        <Container size="lg" py="xl">
          <JoinGameSection />
        </Container>

        {/* Final CTA */}
        <CTASection />
      </main>
    </>
  );
}
