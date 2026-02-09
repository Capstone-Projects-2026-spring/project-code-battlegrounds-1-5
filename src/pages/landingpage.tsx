import React from 'react';
import Navbar from '@/components/Navbar';
import Broadstats from '@/components/Broadstats'
import DifficultyGrid from '@/components/DifficultyGrid'

export default function LandingPage() {
  return (
    <div>
      <Navbar 
        links={[
          "Time",
          "Players",
          "Tournament"
        ]}
        title = "Code BattleGrounds"
      />
      <DifficultyGrid />
      <Broadstats />
    </div>
  );
}
