import {
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Overlay,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
  Transition,
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
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
  name: string;
  role: "Coder" | "Tester" | "System";
  message: string;
};

type StreamedChatMessage = DemoChatMessage & {
  id: number;
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
};

type LaneConfig = {
  title: string;
  badgeText: string;
  badgeColor: string;
  description: string;
  icon: ReactNode;
  isMirror: boolean;
};

const PHASE_AUTOPLAY_DURATION_MS = 7000;
const SWAP_ROLE_APPLY_DELAY_MS = 1300;
const SWAP_OVERLAY_DURATION_MS = 2600;
const SWAP_OVERLAY_FADE_MS = 320;
const TYPEWRITER_SPEED_MS = 14;
const CHAT_STREAM_INTERVAL_MS = 1500;

const PHASE_ORDER: PhaseId[] = ["active", "swap", "finish"];

const DEMO_PHASES: Record<PhaseId, DemoPhase> = {
  active: {
    id: "active",
    tabLabel: "Live",
    stageLabel: "Active",
    headline: "Coder Builds, Tester Validates",
    detail: "Code changes sync live while tester iterates on cases and runs batches.",
    roleHint: "Run All triggers full suite against the latest synced code",
    code: `function solution(nums, target) {\n  const seen = new Map();\n\n  for (let i = 0; i < nums.length; i += 1) {\n    const want = target - nums[i];\n    if (seen.has(want)) return [seen.get(want), i];\n    seen.set(nums[i], i);\n  }\n\n  return [];\n}`,
    tests: [
      { name: "happy path", status: "pass", detail: "0.11s" },
      { name: "duplicate values", status: "pass", detail: "0.13s" },
      { name: "no match", status: "pending", detail: "running" },
    ],
  },
  swap: {
    id: "swap",
    tabLabel: "Swap",
    stageLabel: "Flipping",
    headline: "Role Swap Mid-Match",
    detail: "The game flips responsibilities so both players experience coding and testing pressure.",
    roleHint: "Previous tester now drives implementation while partner hardens test quality",
    code: `function solution(nums, target) {\n  const seen = new Map();\n\n  for (let i = 0; i < nums.length; i += 1) {\n    const want = target - nums[i];\n    if (seen.has(want)) return [seen.get(want), i];\n    seen.set(nums[i], i);\n  }\n\n  // Added after role swap\n  return [-1, -1];\n}`,
    tests: [
      { name: "happy path", status: "pass", detail: "0.10s" },
      { name: "duplicate values", status: "pass", detail: "0.12s" },
      { name: "no match", status: "fail", detail: "expected [] got [-1,-1]" },
    ],
  },
  finish: {
    id: "finish",
    tabLabel: "Finish",
    stageLabel: "Submitted",
    headline: "Final Submit + Score",
    detail: "Both roles converge on correctness, submit before timeout, and lock the final run.",
    roleHint: "Score rewards fast delivery with clean test outcomes",
    code: `function solution(nums, target) {\n  const seen = new Map();\n\n  for (let i = 0; i < nums.length; i += 1) {\n    const want = target - nums[i];\n    if (seen.has(want)) return [seen.get(want), i];\n    seen.set(nums[i], i);\n  }\n\n  return [];\n}`,
    tests: [
      { name: "happy path", status: "pass", detail: "0.10s" },
      { name: "duplicate values", status: "pass", detail: "0.12s" },
      { name: "no match", status: "pass", detail: "0.09s" },
    ],
  },
};

const GLOBAL_CHAT_MESSAGES: DemoChatMessage[] = [
  { name: "Maya", role: "Tester", message: "Kicking off baseline suite now." },
  { name: "Noah", role: "Coder", message: "Got it. I am wiring the map-based lookup." },
  { name: "Maya", role: "Tester", message: "Happy path is green in 0.11s." },
  { name: "Noah", role: "Coder", message: "Pushing edge-case guard for empty arrays." },
  { name: "Atlas", role: "System", message: "Role swap warning: 10 seconds." },
  { name: "Maya", role: "Tester", message: "Duplicate-value case passes after your patch." },
  { name: "Noah", role: "Coder", message: "Nice. Checking no-match return shape next." },
  { name: "Atlas", role: "System", message: "Roles swapped. New coder assigned." },
  { name: "Noah", role: "Tester", message: "I see [-1, -1]; expected empty array." },
  { name: "Maya", role: "Coder", message: "Copy that. Reverting fallback output." },
  { name: "Noah", role: "Tester", message: "Re-run complete. All tests are green." },
  { name: "Maya", role: "Coder", message: "Submitting final answer with 41 seconds left." },
];

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
  const [swapOverlayVisible, setSwapOverlayVisible] = useState(false);
  const [swapTypingLocked, setSwapTypingLocked] = useState(false);
  const [laneSwapApplied, setLaneSwapApplied] = useState(false);
  const [chatFeed, setChatFeed] = useState<StreamedChatMessage[]>([]);
  const [chatSessionId, setChatSessionId] = useState(0);
  const swapTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const chatCursorRef = useRef(0);
  const chatMessageIdRef = useRef(0);

  const phase = DEMO_PHASES[activePhase];
  const phaseIndex = PHASE_ORDER.indexOf(activePhase);

  const clearSwapTimers = useCallback(() => {
    swapTimersRef.current.forEach((timerId) => {
      clearTimeout(timerId);
    });
    swapTimersRef.current = [];
  }, []);

  const transitionToPhase = useCallback((nextPhase: PhaseId) => {
    clearSwapTimers();

    if (nextPhase === "swap") {
      setActivePhase("swap");
      setSwapOverlayVisible(true);
      setSwapTypingLocked(true);
      setLaneSwapApplied(false);

      const applySwapTimer = setTimeout(() => {
        setLaneSwapApplied(true);
      }, SWAP_ROLE_APPLY_DELAY_MS);

      const hideOverlayTimer = setTimeout(() => {
        setSwapOverlayVisible(false);
      }, SWAP_OVERLAY_DURATION_MS);

      const unlockTypingTimer = setTimeout(() => {
        setSwapTypingLocked(false);
      }, SWAP_OVERLAY_DURATION_MS + SWAP_OVERLAY_FADE_MS);

      swapTimersRef.current = [applySwapTimer, hideOverlayTimer, unlockTypingTimer];
      return;
    }

    setSwapOverlayVisible(false);
    setSwapTypingLocked(false);
    if (nextPhase === "active") {
      setLaneSwapApplied(false);
      setChatFeed([]);
      chatCursorRef.current = 0;
      chatMessageIdRef.current = 0;
      setChatSessionId((current) => current + 1);
    }
    setActivePhase(nextPhase);
  }, [clearSwapTimers]);

  useEffect(() => {
    if (!autoPlay) return;

    const autoAdvanceTimer = setTimeout(() => {
      const currentIndex = PHASE_ORDER.indexOf(activePhase);
      const nextPhase = PHASE_ORDER[(currentIndex + 1) % PHASE_ORDER.length];
      transitionToPhase(nextPhase);
    }, PHASE_AUTOPLAY_DURATION_MS);

    return () => {
      clearTimeout(autoAdvanceTimer);
    };
  }, [activePhase, autoPlay, transitionToPhase]);

  useEffect(() => {
    return () => {
      clearSwapTimers();
    };
  }, [clearSwapTimers]);

  useEffect(() => {
    const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const streamInterval = prefersReducedMotion ? CHAT_STREAM_INTERVAL_MS * 2 : CHAT_STREAM_INTERVAL_MS;

    const chatIntervalId = setInterval(() => {
      const nextMessage = GLOBAL_CHAT_MESSAGES[chatCursorRef.current];
      if (!nextMessage) {
        clearInterval(chatIntervalId);
        return;
      }

      setChatFeed((previousMessages) => [
        ...previousMessages,
        {
          ...nextMessage,
          id: chatMessageIdRef.current,
        },
      ]);

      chatCursorRef.current += 1;
      chatMessageIdRef.current += 1;
    }, streamInterval);

    return () => {
      clearInterval(chatIntervalId);
    };
  }, [chatSessionId]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [chatFeed.length]);

  useEffect(() => {
    if (activePhase === "swap" && (swapOverlayVisible || swapTypingLocked)) {
      return;
    }

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

    const typewriter = setInterval(() => {
      characterIndex += 1;
      setTypedCode(phase.code.slice(0, characterIndex));

      if (characterIndex >= phase.code.length) {
        clearInterval(typewriter);
      }
    }, TYPEWRITER_SPEED_MS);

    return () => {
      clearTimeout(clearTypedCode);
      clearInterval(typewriter);
    };
  }, [activePhase, phase.code, swapOverlayVisible, swapTypingLocked]);

  const isTypingCode = typedCode.length < phase.code.length;

  const coderLane: LaneConfig = {
    title: "Coder Editor",
    badgeText: "Write Lane",
    badgeColor: "console",
    description: "Primary stream where the coder pushes implementation updates.",
    icon: <IconCode size={16} />,
    isMirror: false,
  };

  const testerLane: LaneConfig = {
    title: "Tester Mirror",
    badgeText: "Read Only",
    badgeColor: "blue",
    description: "Mirrored stream where testers watch every character appear in real time.",
    icon: <IconEye size={16} />,
    isMirror: true,
  };

  const leftLane = laneSwapApplied ? testerLane : coderLane;
  const rightLane = laneSwapApplied ? coderLane : testerLane;

  const renderEditorPane = (lane: LaneConfig) => {
    return (
      <Paper
        withBorder
        radius="md"
        p="md"
        className={`${classes.workspacePane} ${classes.editorPane} ${lane.isMirror ? classes.mirrorPane : ""}`}
      >
        <Transition
          mounted={swapOverlayVisible}
          transition="fade"
          duration={SWAP_OVERLAY_FADE_MS}
          timingFunction="ease"
        >
          {(transitionStyles) => (
            <Box style={transitionStyles}>
              <Overlay
                className={classes.roleSwapOverlay}
                backgroundOpacity={0.5}
                blur={2}
              />
              <Box className={classes.roleSwapLabel}>
                <Badge
                  variant="filled"
                  color="orange"
                  leftSection={<IconRefresh size={12} />}
                >
                  Swapping Roles
                </Badge>
                <Text size="xs" fw={700} c="white">
                  {laneSwapApplied ? "Lane reassigned" : "Reassigning editor lanes..."}
                </Text>
              </Box>
            </Box>
          )}
        </Transition>

        <Group justify="space-between" mb="xs">
          <Group gap={6}>
            {lane.icon}
            <Text fw={700} size="sm">{lane.title}</Text>
          </Group>
          <Badge variant="light" color={lane.badgeColor}>{lane.badgeText}</Badge>
        </Group>

        <Box className={`${classes.codeWindow} ${lane.isMirror ? classes.mirrorWindow : ""}`}>
          <pre>
            {typedCode}
            {isTypingCode && <span className={classes.caret}>|</span>}
          </pre>
        </Box>

        <Text size="sm" mt="sm" c="dimmed">
          {lane.description}
        </Text>
      </Paper>
    );
  };

  const handlePhaseChange = (value: string) => {
    const nextPhase = value as PhaseId;
    setAutoPlay(false);
    transitionToPhase(nextPhase);
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
              Watch a Match in Motion
            </Title>
            <Text size="lg" c="dimmed" maw={760}>
              This walkthrough mirrors the real arena flow: matchmaking, mirrored editor sync, tester-driven validation, timed role swaps, and final submission pressure.
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
                data={PHASE_ORDER.map((phaseId) => ({
                  label: DEMO_PHASES[phaseId].tabLabel,
                  value: phaseId,
                }))}
                className={classes.phaseControl}
                data-testid="home-live-demo-phase-control"
              />

              <Group justify="space-between" align="center" wrap="wrap" gap="sm" className={classes.syncMeta}>
                <Text size="xs" c="dimmed">{phase.roleHint}</Text>
                {swapOverlayVisible && (
                  <Badge variant="filled" color="yellow">Role swap underway</Badge>
                )}
              </Group>

              <Grid gutter="md" align="stretch">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  {renderEditorPane(leftLane)}
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                  {renderEditorPane(rightLane)}
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

                    <Box ref={chatContainerRef} className={classes.chatStream}>
                      <Stack gap={6} className={classes.chatStack}>
                        {chatFeed.map((message) => (
                          <Box key={message.id} className={`${classes.chatBubble} ${classes.chatBubbleEnter}`}>
                            <Text size="xs" fw={700} className={classes.chatAuthor}>
                              {message.name} ({message.role})
                            </Text>
                            <Text size="sm">{message.message}</Text>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
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
