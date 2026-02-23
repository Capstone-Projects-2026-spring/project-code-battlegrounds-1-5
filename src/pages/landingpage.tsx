import React from 'react';
import { Stack, Box, Button, Center, Loader } from '@mantine/core'; //
import Navbar from '@/components/Navbar';
import Broadstats from '@/components/Broadstats';
import DifficultyGrid from '@/components/DifficultyGrid';
import { useRouter } from 'next/router';

export default function LandingPage() {
 
  const router = useRouter(); // Next router used for navigation AKA redirecting page
  const [loading, setLoading] = React.useState(false); // State to manage loading state of the button

  /**
   * handleCreateRoom is called when the user clicks the "Create Game Room" button.
   * It sends a POST request to the /api/rooms/create endpoint to create a new game room.
   * If successful, it redirects the user to the new game room page using the returned gameId.
   * If there's an error, it shows an alert with the error message.
   */
  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rooms/create', { method: 'POST'});
      const data = await response.json();
      if (response.ok) {
        router.push(`/playGame/${data.gameId}`); // Redirect to the new game room page using the returned gameId
      } else {
        alert(data.message || 'Failed to create game room'); // Show error message from the server if available, otherwise show a generic error message
      }
    } catch (error) {
      alert('Failed to create game room');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Center the button to create the game room */}
      <Center mb='lg'>
        <Button 
          onClick={handleCreateRoom} 
          size='lg' 
          loading={loading} 
          disabled={loading} 
        >
          Create A NewGame Room
        </Button>
      </Center>
      
      <Broadstats />
    </Stack>
  );
}