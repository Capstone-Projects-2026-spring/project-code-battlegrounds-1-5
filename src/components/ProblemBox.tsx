import { Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";

export interface ActiveProblem {
    id: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
}

interface ProblemBoxProps {
    problem?: ActiveProblem | null;
}
//problem box is now a prop-driven component that receives the problem details from the parent (coder/tester POV) which gets it from the API route. It simply displays the problem info and fills the space allocated by the parent layout.
export default function ProblemBox({ problem }: ProblemBoxProps) {
    const title = problem?.title ?? "Problem Title";
    const description = problem?.description ?? "Waiting for problem data...";
    const metadata = problem
        ? `${problem.difficulty} | ${problem.topics.join(", ")}`
        : "";

  return (
    // Remove shadow and use h="100%" to fill the parent Box
    <Paper p="md" h="100%" bg="transparent">
        {/* Remove the width: "20%" here! Let the parent handle width. */}
        <ScrollArea h="100%" offsetScrollbars>
            <Stack gap="md">
                <Title order={3}>
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
