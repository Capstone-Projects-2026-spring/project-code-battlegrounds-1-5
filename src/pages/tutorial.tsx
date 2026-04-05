import NavBar from '@/components/Navbar'
import { Badge, Box, Button, Container, Grid, Group, Image, Paper, Stack, Text, Title } from '@mantine/core';
import { usePostHog } from 'posthog-js/react';
import { useEffect, useState } from 'react';
import styles from '@/styles/Tutorial.module.css';

export default function GameTutorial() {

    const posthog = usePostHog();
    const [activeStep, setActiveStep] = useState(0);
    const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set([0]));

    useEffect(() => {
        posthog.capture("tutorial_viewed");
    }, [posthog]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const stepIndex = parseInt(entry.target.getAttribute('data-step') || '0');
                        setVisibleSections(prev => new Set(prev).add(stepIndex));
                        setActiveStep(stepIndex);
                    }
                });
            },
            { threshold: 0.3 }
        );

        const sections = document.querySelectorAll('[data-step]');
        sections.forEach((section) => observer.observe(section));

        return () => observer.disconnect();
    }, []);

    const steps = [
        { id: 0, label: 'Intro' },
        { id: 1, label: 'Roles' },
        { id: 2, label: 'Interface' },
        { id: 3, label: 'Ready!' }
    ];

    return(<>
        <NavBar 
            links={[
                "Home", 
                "How to Play",
                "Leaderboard",
                "Play"
            ]} title="Code Battlegrounds"
        />
        
        <Box className={styles.tutorialPage}>
            <div className={styles.content}>
                <Container fluid px={'xl'}>
                    {/* Progress Bar */}
                    <Paper className={styles.progressBar}>
                        <div className={styles.progressSteps}>
                            {steps.map((step, index) => (
                                <div 
                                    key={step.id}
                                    className={`${styles.progressStep} ${
                                        activeStep === step.id ? styles.active : ''
                                    } ${activeStep > step.id ? styles.completed : ''}`}
                                >
                                    <div className={styles.progressStepNumber}>
                                        {activeStep > step.id ? '✓' : step.id + 1}
                                    </div>
                                    <div className={styles.progressStepLabel}>{step.label}</div>
                                    {index < steps.length - 1 && (
                                        <div className={styles.progressLine} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </Paper>

                    <Stack gap={'xl'}>
                        {/* Header Section */}
                        <div className={styles.header} data-step="0">
                            <Title className={styles.mainTitle}>How to Play</Title>
                            <Text className={styles.intro}>
                                Welcome to Code Battlegrounds! Before you get started
                                on your journey to coding greatness, it's important to 
                                familiarize yourself with the game itself. Here, we'll give you
                                an introductory guide to playing <em>Code Battlegrounds</em>, 
                                so you can get to battling it out without feeling lost.
                            </Text>
                        </div>

                        {/* Step 1: Team Roles */}
                        <div 
                            className={`${styles.stepSection} ${visibleSections.has(1) ? styles.visible : ''}`}
                            data-step="1"
                        >
                            <div className={styles.stepHeader}>
                                <div className={styles.stepNumber}>1</div>
                                <Title className={styles.stepTitle}>Team Roles</Title>
                            </div>

                            <Grid gutter={'lg'} align='center'>
                                <Grid.Col span={{ base: 12, sm: 6}}>
                                    <div className={styles.imageContainer}>
                                        <Image 
                                            src={"https://imgs.search.brave.com/CaXwtdqts1HbsCkHk5P0dXRDz0FYnKZUUWlxiaF1j40/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly90aHVt/YnMuZHJlYW1zdGlt/ZS5jb20vYi9hZ2ls/ZS1wYWlyLXByb2dy/YW1taW5nLWV4dHJl/bWUtY29kaW5nLWFn/aWxlLXBhaXItcHJv/Z3JhbW1pbmctZXh0/cmVtZS1jb2Rpbmct/YnVzaW5lc3Mtc29m/dHdhcmUtMjgxOTE4/Mzg3LmpwZw"}
                                            alt='Image of pair coding'
                                        />
                                    </div>
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, sm: 6}}>
                                    <div className={styles.contentCard}>
                                        <Stack gap={'md'}>
                                            <Text size="lg">
                                                Code Battlegrounds is a game where you'll team up with
                                                a partner to take on other teams in 2v2 competitive pair 
                                                programming. As such, it's important to familiarize yourself 
                                                with the roles that each member plays when playing <em>Code Battlegrounds</em>. 
                                            </Text>
                                            
                                            <div className={styles.roleCard}>
                                                <div className={styles.roleTitle}>
                                                    <span className={styles.roleIcon}>💻</span>
                                                    The Coder
                                                </div>
                                                <Text>
                                                    As the Coder, your job is to write the actual code that will be run and tested.
                                                    You'll work alongside the Quality Tester to ensure that your code runs without issues 
                                                    and that it successfully passes the coding challenge. You'll have to work fast though, 
                                                    as the timer will count down to zero. The better you do, the more points your team will get!
                                                </Text>
                                            </div>

                                            <div className={styles.roleCard}>
                                                <div className={styles.roleTitle}>
                                                    <span className={styles.roleIcon}>🔍</span>
                                                    The Quality Tester
                                                </div>
                                                <Text>
                                                    As the Quality Tester, your job is to write tests, ensuring the Coder's 
                                                    code passes all tests and edge cases. You'll be the one hard at work checking for correctness
                                                    in the code and letting the coder know what went wrong and what to fix or improve. The less errors
                                                    in your partner's code, the more tests it will pass and the more points you'll both get!
                                                </Text>
                                            </div>

                                            {/* Terminal Block Example */}
                                            <div className={styles.terminalBlock}>
                                                <div className={styles.terminalHeader}>
                                                    <div className={styles.terminalDots}>
                                                        <div className={styles.terminalDot}></div>
                                                        <div className={styles.terminalDot}></div>
                                                        <div className={styles.terminalDot}></div>
                                                    </div>
                                                    <div className={styles.terminalTitle}>team_strategy.py</div>
                                                </div>
                                                <div className={styles.terminalContent}>
                                                    <span className={styles.codeComment}># Successful team strategy</span>{'\n'}
                                                    <span className={styles.codeKeyword}>def</span> <span className={styles.codeHighlight}>win_match</span>():{'\n'}
                                                    {'    '}<span className={styles.codeComment}># Coder writes efficient solution</span>{'\n'}
                                                    {'    '}solution = <span className={styles.codeString}>"fast & correct"</span>{'\n'}
                                                    {'    '}{'\n'}
                                                    {'    '}<span className={styles.codeComment}># Tester validates edge cases</span>{'\n'}
                                                    {'    '}tests = <span className={styles.codeString}>"comprehensive"</span>{'\n'}
                                                    {'    '}{'\n'}
                                                    {'    '}<span className={styles.codeKeyword}>return</span> <span className={styles.codeHighlight}>victory</span> <span className={styles.codeComment}># 🏆</span>
                                                </div>
                                            </div>
                                        </Stack>
                                    </div>
                                </Grid.Col>
                            </Grid>
                        </div>

                        {/* Step 2: Interface Features */}
                        <div 
                            className={`${styles.stepSection} ${visibleSections.has(2) ? styles.visible : ''}`}
                            data-step="2"
                        >
                            <div className={styles.stepHeader}>
                                <div className={styles.stepNumber}>2</div>
                                <Title className={styles.stepTitle}>Coding & Testing Interfaces</Title>
                            </div>

                            <Grid gutter={'lg'} align='center'>
                                <Grid.Col span={{base: 12, sm: 6}}>
                                    <div className={styles.contentCard}>
                                        <Stack gap={'md'}>
                                            <Text size="lg">
                                                Now it's time to get familiar with the environment
                                                you'll be working in. The Interface allows you to view the coding
                                                challenge, code, and interact with your partner. Let's look at some key features.
                                            </Text>

                                            <div className={styles.featureGrid}>
                                                <div className={styles.featureCard}>
                                                    <div className={styles.featureIcon}>📋</div>
                                                    <div className={styles.featureTitle}>Problem Window</div>
                                                    <div className={styles.featureDescription}>
                                                        View the problem you are attempting to solve with all details and requirements.
                                                    </div>
                                                </div>

                                                <div className={styles.featureCard}>
                                                    <div className={styles.featureIcon}>💬</div>
                                                    <div className={styles.featureTitle}>Chatbox</div>
                                                    <div className={styles.featureDescription}>
                                                        Real-time communication between Quality Tester and Coder for effective collaboration.
                                                    </div>
                                                </div>

                                                <div className={styles.featureCard}>
                                                    <div className={styles.featureIcon}>⌨️</div>
                                                    <div className={styles.featureTitle}>Code Window</div>
                                                    <div className={styles.featureDescription}>
                                                        Where the Coder writes the solution. Tester can view code in real-time.
                                                    </div>
                                                </div>

                                                <div className={styles.featureCard}>
                                                    <div className={styles.featureIcon}>🎛️</div>
                                                    <div className={styles.featureTitle}>Coder Dashboard</div>
                                                    <div className={styles.featureDescription}>
                                                        Quick communication hub with predefined messages for efficient teamwork.
                                                    </div>
                                                </div>

                                                <div className={styles.featureCard}>
                                                    <div className={styles.featureIcon}>🧪</div>
                                                    <div className={styles.featureTitle}>Testing Window</div>
                                                    <div className={styles.featureDescription}>
                                                        Write and run test cases to validate the Coder's solution.
                                                    </div>
                                                </div>

                                                <div className={styles.featureCard}>
                                                    <div className={styles.featureIcon}>🖥️</div>
                                                    <div className={styles.featureTitle}>Terminal Output</div>
                                                    <div className={styles.featureDescription}>
                                                        View test execution results and debug information in real-time.
                                                    </div>
                                                </div>
                                            </div>
                                        </Stack>
                                    </div>
                                </Grid.Col>
                                <Grid.Col span={{base: 12, sm: 6}}>
                                    <div className={styles.imageContainer}>
                                        <Image 
                                            src={"https://imgs.search.brave.com/aRx_eA9tdZq38hW05jq564qPzDJg2nzYXCGwSZQ80CQ/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5kYXRhY2FtcC5j/b20vbGVnYWN5L3Yx/NzE1NzM4ODM5L2lt/YWdlX2QxMmJiNWMx/NDAucG5n"} 
                                            alt='Interface preview'
                                        />
                                    </div>

                                    {/* Terminal Block for Interface Demo */}
                                    <div className={styles.terminalBlock} style={{ marginTop: '1.5rem' }}>
                                        <div className={styles.terminalHeader}>
                                            <div className={styles.terminalDots}>
                                                <div className={styles.terminalDot}></div>
                                                <div className={styles.terminalDot}></div>
                                                <div className={styles.terminalDot}></div>
                                            </div>
                                            <div className={styles.terminalTitle}>test_output.log</div>
                                        </div>
                                        <div className={styles.terminalContent}>
                                            <span className={styles.codeHighlight}>{'>'} Running tests...</span>{'\n'}
                                            {'\n'}
                                            <span className={styles.codeString}>✓ test_basic_case</span> <span className={styles.codeComment}>PASSED</span>{'\n'}
                                            <span className={styles.codeString}>✓ test_edge_case</span> <span className={styles.codeComment}>PASSED</span>{'\n'}
                                            <span className={styles.codeString}>✓ test_performance</span> <span className={styles.codeComment}>PASSED</span>{'\n'}
                                            {'\n'}
                                            <span className={styles.codeHighlight}>All tests passed! 🎉</span>{'\n'}
                                            <span className={styles.codeComment}>Time: 142ms</span>
                                        </div>
                                    </div>
                                </Grid.Col>
                            </Grid>
                        </div>

                        {/* Call to Action */}
                        <div 
                            className={`${styles.stepSection} ${visibleSections.has(3) ? styles.visible : ''}`}
                            data-step="3"
                        >
                            <div className={styles.ctaSection}>
                                <Title className={styles.ctaTitle}>
                                    Ready to Enter the Matrix?
                                </Title>
                                <Text className={styles.ctaText}>
                                    We hope that you found this guide useful in beginning your journey on 
                                    the code battlefield. Good luck, and may you rise to the occasion and become Coding Champions!
                                </Text>
                                <Group justify="center" gap="md">
                                    <Button 
                                        size="lg" 
                                        color="console.4"
                                        className={styles.ctaButton}
                                        component="a"
                                        href="/play"
                                    >
                                        Start Playing
                                    </Button>
                                    <Button 
                                        size="lg" 
                                        variant="outline"
                                        color="console.4"
                                        className={styles.ctaButton}
                                        component="a"
                                        href="/leaderboard"
                                    >
                                        View Leaderboard
                                    </Button>
                                </Group>
                            </div>
                        </div>
                    </Stack>
                </Container>
            </div>
        </Box>
    </>);
}