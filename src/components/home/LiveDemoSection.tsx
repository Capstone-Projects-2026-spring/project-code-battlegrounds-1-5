import {
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangleFilled,
  IconBolt,
  IconCircleCheckFilled,
  IconCode,
  IconEye,
  IconFlask2,
  IconLoader2,
  IconMessageCircle2,
  IconPlayerPlay,
  IconRefresh,
  IconRocket,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePostHog } from "posthog-js/react";
import classes from "@/styles/comps/LiveDemoSection.module.css";

type PhaseId = "active" | "swap" | "finish";
type TestStatus = "pass" | "fail" | "pending";

type DemoTest = {
  name: string;
  status: TestStatus;
  detail: string;
};

type DemoChatMessage = {
  author: string;
  message: string;
};

type DemoPhase = {
  id: PhaseId;
  tabLabel: string;
  stageLabel: string;
  headline: string;
  detail: string;
  roleHint: string;
  code: string;
  tests: DemoTest[];
  chat: DemoChatMessage[];
};

const PHASE_ORDER: PhaseId[] = ["active", "swap", "finish"];

const DEMO_PHASES: Record<PhaseId, DemoPhase> = {
  active: {
    id: "active",
    tabLabel: "Live",
    stageLabel: "Active",
    headline: "Coder Builds, Tester Validates",
    detail: "Code changes sync live while tester iterates on cases and runs batches.",
    roleHint: "Run All triggers full suite against the latest synced code",
    code: `function solve(nums, target) {\n  const seen = new Map();\n\n  for (let i = 0; i < nums.length; i += 1) {\n    const want = target - nums[i];\n    if (seen.has(want)) return [seen.get(want), i];\n    seen.set(nums[i], i);\n  }\n\n  return [];\n}`,
    tests: [
      { name: "happy path", status: "pass", detail: "0.11s" },
      { name: "duplicate values", status: "pass", detail: "0.13s" },
      { name: "no match", status: "pending", detail: "running" },
    ],
    chat: [
      { author: "tester", message: "Run All is green except no-match path." },
      { author: "coder", message: "Patching empty return handling now." },
    ],
  },
  swap: {
    id: "swap",
    tabLabel: "Swap",
    stageLabel: "Flipping",
    headline: "Role Swap Mid-Match",
    detail: "The game flips responsibilities so both players experience coding and testing pressure.",
    roleHint: "Previous tester now drives implementation while partner hardens test quality",
    code: `function solve(nums, target) {\n  const seen = new Map();\n\n  for (let i = 0; i < nums.length; i += 1) {\n    const want = target - nums[i];\n    if (seen.has(want)) return [seen.get(want), i];\n    seen.set(nums[i], i);\n  }\n\n  // Added after role swap\n  return [-1, -1];\n}`,
    tests: [
      { name: "happy path", status: "pass", detail: "0.10s" },
      { name: "duplicate values", status: "pass", detail: "0.12s" },
      { name: "no match", status: "fail", detail: "expected [] got [-1,-1]" },
    ],
    chat: [
      { author: "system", message: "Role swap complete." },
      { author: "coder", message: "Good catch, reverting fallback value." },
    ],
  },
  finish: {
    id: "finish",
    tabLabel: "Finish",
    stageLabel: "Submitted",
    headline: "Final Submit + Score",
    detail: "Both roles converge on correctness, submit before timeout, and lock the final run.",
    roleHint: "Score rewards fast delivery with clean test outcomes",
    code: `function solve(nums, target) {\n  const seen = new Map();\n\n  for (let i = 0; i < nums.length; i += 1) {\n    const want = target - nums[i];\n    if (seen.has(want)) return [seen.get(want), i];\n    seen.set(nums[i], i);\n  }\n\n  return [];\n}`,
    tests: [
      { name: "happy path", status: "pass", detail: "0.10s" },
      { name: "duplicate values", status: "pass", detail: "0.12s" },
      { name: "no match", status: "pass", detail: "0.09s" },
    ],
    chat: [
      { author: "tester", message: "All tests green. Submit now." },
      { author: "coder", message: "Submitted with 41s left." },
    ],
  },
};

function statusIcon(status: TestStatus) {
  if (status === "pass") {
    return <IconCircleCheckFilled size={16} className={classes.passIcon} />;
  }
  if (status === "fail") {
    return <IconAlertTriangleFilled size={16} className={classes.failIcon} />;
  }
  return <IconLoader2 size={16} className={classes.pendingIcon} />;
}

export default function LiveDemoSection() {
  const posthog = usePostHog();
  const [activePhase, setActivePhase] = useState<PhaseId>("active");
  const [autoPlay, setAutoPlay] = useState(true);
  const [typedCode, setTypedCode] = useState("");

  const phase = DEMO_PHASES[activePhase];
  const phaseIndex = PHASE_ORDER.indexOf(activePhase);

  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      setActivePhase((current) => {
        const currentIndex = PHASE_ORDER.indexOf(current);
        const nextIndex = (currentIndex + 1) % PHASE_ORDER.length;
        return PHASE_ORDER[nextIndex];
      });
    }, 7000);

    return () => clearInterval(interval);
  }, [autoPlay]);

  useEffect(() => {
    const clearTypedCode = setTimeout(() => {
      setTypedCode("");
    }, 0);

    const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      const showFullCode = setTimeout(() => {
        setTypedCode(phase.code);
      }, 0);

      return () => {
        clearTimeout(clearTypedCode);
        clearTimeout(showFullCode);
      };
    }

    let characterIndex = 0;
    const typingSpeed = 14;

    const typewriter = setInterval(() => {
      characterIndex += 1;
      setTypedCode(phase.code.slice(0, characterIndex));

      if (characterIndex >= phase.code.length) {
        clearInterval(typewriter);
      }
    }, typingSpeed);

    return () => {
      clearTimeout(clearTypedCode);
      clearInterval(typewriter);
    };
  }, [activePhase, phase.code]);

  const isTypingCode = typedCode.length < phase.code.length;

  const handlePhaseChange = (value: string) => {
    const nextPhase = value as PhaseId;
    setActivePhase(nextPhase);
    posthog?.capture("homepage_live_demo_phase_changed", { phase: nextPhase });
  };

  return (
    <Box
      component="section"
      py={88}
      aria-labelledby="live-demo-title"
      className={classes.section}
    >
      <Container size="lg">
        <Stack gap="xl">
          <Stack gap="sm" align="center" ta="center">
            <Badge variant="light" color="console" size="lg">Live Demo</Badge>
            <Title order={2} id="live-demo-title" className={classes.sectionTitle}>
              Watch the Match Loop in Motion
            </Title>
            <Text size="lg" c="dimmed" maw={760}>
              This walkthrough mirrors the real arena flow: matchmaking, mirrored editor sync,
              tester-driven validation, timed role swaps, and final submission pressure.
            </Text>
          </Stack>

          <Paper withBorder radius="lg" p="xl" className={classes.demoShell}>
            <Stack gap="lg">
              <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                <Group gap="sm">
                  <Badge variant="filled" color="console" leftSection={<IconBolt size={14} />}>
                    {phase.stageLabel}
                  </Badge>
                  <Text fw={600}>{phase.headline}</Text>
                </Group>

                <Group gap="sm">
                  <Button
                    size="xs"
                    variant={autoPlay ? "filled" : "light"}
                    onClick={() => setAutoPlay((current) => !current)}
                    leftSection={autoPlay ? <IconRefresh size={14} /> : <IconPlayerPlay size={14} />}
                  >
                    {autoPlay ? "Pause autoplay" : "Resume autoplay"}
                  </Button>
                </Group>
              </Group>

              <Text c="dimmed" size="sm">{phase.detail}</Text>

              <SegmentedControl
                fullWidth
                size="sm"
                value={activePhase}
                onChange={handlePhaseChange}
                onClick={() => setAutoPlay(false)}
                data={PHASE_ORDER.map((phaseId) => ({
                  label: DEMO_PHASES[phaseId].tabLabel,
                  value: phaseId,
                }))}
                className={classes.phaseControl}
                data-testid="home-live-demo-phase-control"
              />

              <Group justify="space-between" align="center" wrap="wrap" gap="sm" className={classes.syncMeta}>
                <Text size="xs" c="dimmed">{phase.roleHint}</Text>
              </Group>

              <Grid gutter="md" align="stretch">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper withBorder radius="md" p="md" className={`${classes.workspacePane} ${classes.editorPane}`}>
                    <Group justify="space-between" mb="xs">
                      <Group gap={6}>
                        <IconCode size={16} />
                        <Text fw={700} size="sm">Coder Editor</Text>
                      </Group>
                      <Badge variant="light" color="console">Write Lane</Badge>
                    </Group>

                    <Box className={classes.codeWindow}>
                      <pre>
                        {typedCode}
                        {isTypingCode && <span className={classes.caret}>|</span>}
                      </pre>
                    </Box>

                    <Text size="sm" mt="sm" c="dimmed">
                      Primary stream where the coder pushes implementation updates.
                    </Text>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Paper
                    withBorder
                    radius="md"
                    p="md"
                    className={`${classes.workspacePane} ${classes.editorPane} ${classes.mirrorPane}`}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap={6}>
                        <IconEye size={16} />
                        <Text fw={700} size="sm">Tester Mirror</Text>
                      </Group>
                      <Badge variant="light" color="blue">Read Only</Badge>
                    </Group>

                    <Box className={`${classes.codeWindow} ${classes.mirrorWindow}`}>
                      <pre>
                        {typedCode}
                        {isTypingCode && <span className={classes.caret}>|</span>}
                      </pre>
                    </Box>

                    <Text size="sm" mt="sm" c="dimmed">
                      Mirrored stream where testers watch every character appear in real time.
                    </Text>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 7 }}>
                  <Paper withBorder radius="md" p="md" className={classes.workspacePane}>
                    <Group justify="space-between" mb="sm">
                      <Group gap={6}>
                        <IconFlask2 size={16} />
                        <Text fw={700} size="sm">Tester Console</Text>
                      </Group>
                      <Badge variant="light" color="cyan">Run All</Badge>
                    </Group>

                    <Stack gap={8}>
                      {phase.tests.map((test) => (
                        <Group
                          key={test.name}
                          justify="space-between"
                          className={[
                            classes.testRow,
                            test.status === "pass" ? classes.testPass : "",
                            test.status === "fail" ? classes.testFail : "",
                          ].join(" ")}
                        >
                          <Group gap={8}>
                            {statusIcon(test.status)}
                            <Text size="sm" fw={600}>{test.name}</Text>
                          </Group>
                          <Text size="xs" c="dimmed">{test.detail}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 5 }}>
                  <Paper withBorder radius="md" p="md" className={classes.workspacePane}>
                    <Group gap={6} mb="sm">
                      <IconMessageCircle2 size={16} />
                      <Text fw={700} size="sm">Team Chat</Text>
                    </Group>

                    <Stack gap={6}>
                      {phase.chat.map((message, index) => (
                        <Box key={`${message.author}-${index}`} className={classes.chatBubble}>
                          <Text size="xs" fw={700} className={classes.chatAuthor}>
                            {message.author}
                          </Text>
                          <Text size="sm">{message.message}</Text>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>

              <Group justify="space-between" align="end" wrap="wrap" gap="sm">
                <Stack gap={6} className={classes.loopTrack}>
                  <Text size="sm" fw={700}>Gameplay Loop</Text>
                  <Group gap="xs" wrap="wrap">
                    {PHASE_ORDER.map((phaseId, index) => (
                      <Badge
                        key={phaseId}
                        variant={phaseId === activePhase ? "filled" : "light"}
                        color={index <= phaseIndex ? "console" : "gray"}
                      >
                        {index + 1}. {DEMO_PHASES[phaseId].tabLabel}
                      </Badge>
                    ))}
                  </Group>
                </Stack>

                <Button
                  component={Link}
                  href="/matchmaking"
                  rightSection={<IconRocket size={16} />}
                  onClick={() => posthog?.capture("homepage_live_demo_cta_clicked")}
                >
                  Try a Real Match
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
