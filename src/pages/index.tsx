import { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import dynamic from "next/dynamic";
import { usePostHog } from "posthog-js/react";
import { authClient } from "@/lib/auth-client";
import { useDisclosure } from "@mantine/hooks";
import { Avatar } from "@mantine/core";

// Code splitting for performance
const HeroSection = dynamic(() => import("@/components/home/HeroSection"), {
  ssr: true,
});
const HowItWorksSection = dynamic(() => import("@/components/home/HowItWorksSection"), {
  ssr: true
});
const LiveDemoSection = dynamic(() => import("@/components/home/LiveDemoSection"), {
  ssr: true
});
// const StatsSection = dynamic(() => import("@/components/home/StatsSection"));
const CTASection = dynamic(() => import("@/components/home/CTASection"), {
  ssr: true
});

const SidePanel = dynamic(() => import("@/components/sidebar/SidePanel"), {
  ssr: false
});

export default function Home() {
  const posthog = usePostHog();
  const { data: session } = authClient.useSession();
  const [sidePanelOpened, { toggle: toggleSidePanel, close: closeSidePanel }] = useDisclosure(false);

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

        {session && (
          <>
            <Avatar
              name={session.user.name}
              size="md"
              radius="xl"
              color="var(--mantine-color-console-4)"
              alt="Open side panel"
              onClick={toggleSidePanel}
              style={{
                position: "fixed",
                top: "1rem",
                right: "1rem",
                zIndex: 200,
                cursor: "pointer",
              }}
            />
            <SidePanel opened={sidePanelOpened} onClose={closeSidePanel} />
          </>
        )}

        {/* Hero - Above the fold, critical content */}
        <HeroSection />

        {/* Stats - Social proof */}
        {/* <StatsSection /> */}

        {/* How It Works - Education */}
        <HowItWorksSection />

        {/* Live Gameplay Demo */}
        <LiveDemoSection />

        {/* Secondary - Join by Game ID
        <Container size="lg" py="xl">
          <JoinGameSection />
        </Container> */}

        {/* Final CTA */}
        <CTASection />
      </main>
    </>
  );
}