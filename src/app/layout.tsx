// src/app/layout.tsx
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
// Import Mantine's global CSS (required for v7)
import '@mantine/core/styles.css'; 

export const metadata = {
  title: 'Code BattleGrounds',
  description: 'Real-time multiplayer coding challenges',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider defaultColorScheme="dark">
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}

