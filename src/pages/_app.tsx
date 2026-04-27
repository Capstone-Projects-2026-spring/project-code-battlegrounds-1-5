import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import "@/styles/globals.css";

import type { AppProps } from "next/app";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { FriendshipProvider } from "@/contexts/FriendshipContext";
import { PartyProvider } from "@/contexts/PartyContext";

import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import { useRouter } from 'next/router';

import HeaderSimple from "@/components/Navbar";
import { MatchmakingProvider } from "@/contexts/MatchmakingContext";
import { SocketProvider } from "@/contexts/SocketContext";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap"
});
const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  display: "swap"
});

const theme = createTheme({
  /** Put your mantine theme override here */
  primaryColor: "console",
  defaultRadius: "xs",
  respectReducedMotion: true,
  primaryShade: 4,
  colors: {
    console: [
      "#e1ffd7",
      "#c8f8b8",
      "#a2eb89",
      "#71d349",
      "#31b000", // primary
      "#008e00",
      "#007400",
      "#005a00",
      "#004000",
      "#002800",
      "#001200"
    ]
  },

  headings: {
    fontFamily: spaceGrotesk.style.fontFamily
  },
  fontFamily: sourceSans3.style.fontFamily
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  const showNavbar = router.pathname !== '/' && router.pathname !== '/login' && router.pathname !== '/signup';

  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      ui_host: "https://us.posthog.com",
      defaults: '2026-01-30',
      person_profiles: "always",
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug();
      }
    });
  }, []);

  useEffect(() => {
    const storedGame = localStorage.getItem("stored_game");
    if(!storedGame) return;

    if(storedGame) {
      console.log("Found stored game!", storedGame);
      router.replace(`/game/${storedGame}`);
    }
  }, [router]);

  return (
    <PostHogProvider client={posthog}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <SocketProvider>
          <PartyProvider>
            <MatchmakingProvider>
              <FriendshipProvider>
                {showNavbar && (
                  <HeaderSimple
                    title="Code BattleGrounds"
                    links={["Dashboard", "Matchmaking", "Settings"]}
                  />
                )}
                <Notifications position="bottom-right" autoClose={5000} />
                <Component {...pageProps} />
              </FriendshipProvider>
            </MatchmakingProvider>
          </PartyProvider>
        </SocketProvider>
      </MantineProvider>
    </PostHogProvider>
  );
}