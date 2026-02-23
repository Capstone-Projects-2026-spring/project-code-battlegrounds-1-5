import React from 'react';
import NavBar from '@/components/Navbar'
import { Container, Grid, Image, Stack, Text, Title } from '@mantine/core';
import Broadstats from '@/components/Broadstats';


export default function GameTutorial() {

    
    return(<>
    {/* Navbar with links (TODO: Make them work) */}
        <NavBar 
            links={[
                "Home", 
                "How to Play",
                "Leaderboard",
                "Play"
            ]} title="Code Battlegrounds"
        />
        {/* Container with main page content*/}
        <Container fluid px={'xl'}>
            <Stack gap={'xl'}>
                <Title size={'4.5rem'}>How to Play</Title>
                <Text size='lg'>
                    Welcome to Code Battlegrounds! Before you get started
                    on your journey to coding greatness, it's important to 
                    familiarize yourself with the game itself. Here, we'll give you
                    an introductory guide to playing <em>Code Battlegrounds</em>, 
                    so you can get to battling it out without feeling lost.
                </Text>
                {/* Grid positions images left and text right */}
                <Grid gutter={'lg'} align='center' my={"lg"}>
                    <Grid.Col span={{ base: 12, sm: 6}}>
                        <Image src={"https://imgs.search.brave.com/CaXwtdqts1HbsCkHk5P0dXRDz0FYnKZUUWlxiaF1j40/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly90aHVt/YnMuZHJlYW1zdGlt/ZS5jb20vYi9hZ2ls/ZS1wYWlyLXByb2dy/YW1taW5nLWV4dHJl/bWUtY29kaW5nLWFn/aWxlLXBhaXItcHJv/Z3JhbW1pbmctZXh0/cmVtZS1jb2Rpbmct/YnVzaW5lc3Mtc29m/dHdhcmUtMjgxOTE4/Mzg3LmpwZw"}
                            alt='Image of pair coding' radius={'md'}
                        />    
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6}}>
                        <Stack gap={'md'}>
                            <Title order={2}>Team Roles</Title>
                            <Text>
                                Code Battlegrounds is a game where you'll team up with
                                a partner to take on other teams in 2v2 competitive pair 
                                programming. As such, it's important to familiarize yourself 
                                with the roles that each member plays when playing <em>Code Battlegrounds</em>. 
                            </Text>
                            <Title order={4}><em>The Coder</em></Title>
                            <Text>
                                As the Coder, your job is to write the actual code that will be run and tested.
                                You'll work alongside the Quality Tester to ensure that your code runs without issues 
                                and that it successfully passes the coding challenge. You'll have to work fast though, 
                                as the timer will count down to zero. The better you do, the more points your team will get!
                            </Text>
                            <Title order={4}><em>The Quality Tester</em></Title>
                            <Text>
                                As the Quality Tester, your job is to write tests, ensuring the Coder's 
                                code passes all tests and edge cases. You'll be the one hard at work checking for correctness
                                in the code and letting the coder know what went wrong and what to fix or improve. The less errors
                                in your partner's code, the more tests it will pass and the more points you'll both get!
                            </Text>
                        </Stack>
                    </Grid.Col>
                </Grid>

                {/* Grid Positions text left and images right */}
                <Grid gutter={'lg'} align='center'>
                    <Grid.Col span={{base: 12, sm: 6}}>
                        <Stack gap={'md'}>
                            <Title order={2}>Coding & Testing Interfaces</Title>
                            <Text>
                                Now it's time to get familiar with the environment
                                you'll be working in. The Interface allows you to view the coding
                                challenge, code, and interact with your partner. Let's look at some key features.
                            </Text>
                            <Title order={3}><em>Problem Window</em></Title>
                            <Text>
                                The Problem Window allows you to view the problem you are 
                                attempting to solve. Here you can see the problem details and the 
                                requirements for the solution.
                            </Text>
                            <Title order={3}><em>Chatbox</em></Title>
                            <Text>
                                This is where both the Quality Tester and the Coder can see each other's 
                                messages and more effectively communicate with each other.
                            </Text>
                            <Title order={3}><em>Code Window</em></Title>
                            <Text>
                                This is where you'll write your code if you're the Coder.
                                The Tester will be able to see the code here.
                            </Text>
                            <Title order={3}><em>Coder Dashboard</em></Title>
                            <Text>
                                This is the Coder's Dashboard, where the Coder can communicate 
                                with the Quality Tester using quick, predefined messages.
                            </Text>
                            <Title order={3}><em>Testing Window & Terminal Output</em></Title>
                            <Text>
                                This is where you'll write test cases if you're the Quality Tester.
                                Alternatively, you can switch to Terminal view to see the test case output.
                            </Text>
                        </Stack>
                    </Grid.Col>
                    <Grid.Col span={{base: 12, sm: 6}}>
                        {/* TODO: Replace with actual dashboard/interface */}
                        <Image src={"https://imgs.search.brave.com/aRx_eA9tdZq38hW05jq564qPzDJg2nzYXCGwSZQ80CQ/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5kYXRhY2FtcC5j/b20vbGVnYWN5L3Yx/NzE1NzM4ODM5L2lt/YWdlX2QxMmJiNWMx/NDAucG5n"} 
                            alt='Placeholder, please replace' radius={'md'}
                        />
                    </Grid.Col>
                </Grid>
                <Title order={1} my={'1.5rem'}>
                    We hope that you found this guide useful in beginning your journey on 
                    the code battlefield. Good luck, and may you rise to the occasion and become Coding Champions!
                </Title>
                <Broadstats />
            </Stack>
        </Container>
    </>);
}