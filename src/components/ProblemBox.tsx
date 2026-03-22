import { ActionIcon, Paper, ScrollArea, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconEyeOff } from "@tabler/icons-react";

export interface ActiveProblem {
    id: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
}

interface ProblemBoxProps {
    problem?: ActiveProblem | null;
    onToggleVisibility?: () => void;
}

//problem box is now a prop-driven component that receives the problem details from the parent (coder/tester POV) which gets it from the API route. It simply displays the problem info and fills the space allocated by the parent layout.
// Additionally, it includes a toggle button to hide the problem box, which calls a callback function passed from the parent when clicked. This allows the parent component to manage the visibility state of the problem box.
export default function ProblemBox({ problem, onToggleVisibility }: ProblemBoxProps) {
    const title = problem?.title ?? "Problem Title";
    const description = problem?.description ?? "Waiting for problem data...";
    const metadata = problem
        ? `${problem.difficulty} | ${problem.topics.join(", ")}`
        : "";

    return (
        // Remove shadow and use h="100%" to fill the parent Box
        <Paper p="md" h="100%" bg="transparent" style={{ position: 'relative' }}>
            {/* Toggle button to hide the problem box */}
            {onToggleVisibility && (
                <Tooltip label="Hide Problem">
                    <ActionIcon
                        variant="transparent"
                        color="gray"
                        onClick={onToggleVisibility}
                        style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
                        title="Hide Problem"
                    >
                        <IconEyeOff size={20} />
                    </ActionIcon>
                </Tooltip>
            )}
            {/* Remove the width: "20%" here! Let the parent handle width. */}
            <ScrollArea h="100%" offsetScrollbars>
                <Stack gap="md">
                    <Title order={3} pr="xl">
                        {title}
                    </Title>
                    {metadata && (
                        <Text size="xs" c="dimmed">
                            {metadata}
                        </Text>
                    )}
                    <Text size="sm">
                        {description}
                    </Text>
                </Stack>
            </ScrollArea>
        </Paper>
    );
}