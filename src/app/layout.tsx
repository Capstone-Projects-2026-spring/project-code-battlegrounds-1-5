import '@mantine/core/styles.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';

export const metadata = {
  title: 'Code BattleGrounds',
  description: 'Competitive coding platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* 1. This script prevents the hydration mismatch */}
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        {/* 2. The provider wraps your entire app */}
        <MantineProvider defaultColorScheme="auto">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
