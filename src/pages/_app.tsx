import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import "@/styles/globals.css";

import type { AppProps } from "next/app";
import { createTheme, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

const theme = createTheme({
  /** Put your mantine theme override here */
});

export default function App({ Component, pageProps }: AppProps) {

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

  return (
    <PostHogProvider client={posthog}>
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <Notifications position="bottom-right" autoClose={5000} />
        <Component {...pageProps} />
      </MantineProvider>
    </PostHogProvider>
  );
}
