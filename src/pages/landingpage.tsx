import React from 'react';
import { Stack, Box } from '@mantine/core'; //
import Navbar from '@/components/Navbar';
import Broadstats from '@/components/Broadstats';
import DifficultyGrid from '@/components/DifficultyGrid';

export default function LandingPage() {
  return (
    /* Stack creates a flex column. 
       h="100vh" ensures the page is at least the height of the screen.
       gap={0} prevents unwanted spacing between the header and the grid.
    */
    <Stack h="100vh" gap={0}>
      <Navbar 
        links={[
          "Time",
          "Players",
          "Tournament"
        ]}
        title="Code BattleGrounds"
      />
      
      {/* Wrapping the grid in a Box with flex: 1 
          forces this section to grow and fill all empty space,
          naturally pushing Broadstats to the bottom.
      */}
      <Box style={{ flex: 1 }}>
        <DifficultyGrid />
      </Box>
      
      <Broadstats />
    </Stack>
  );
}