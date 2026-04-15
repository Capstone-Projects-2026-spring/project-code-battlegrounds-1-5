import { ActionIcon, Badge, Card, Group, ScrollArea, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconEyeOff } from "@tabler/icons-react";
import styles from '@/styles/comps/ProblemBox.module.css';

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
  const difficulty = problem?.difficulty;
  const topics = problem?.topics ?? [];

  return (
    <Card p="md" h="100%" className={styles.container}>
      {/* Toggle button to hide the problem box */}
      {onToggleVisibility && (
        <Tooltip label="Hide Problem">
          <ActionIcon
            variant="transparent"
            color="gray"
            onClick={onToggleVisibility}
            className={styles.expandButton}
            title="Hide Problem"
          >
            <IconEyeOff size={20} />
          </ActionIcon>
        </Tooltip>
      )}
      <ScrollArea className={styles.scrollArea} offsetScrollbars>
        <Stack gap="md" className={styles.content}>
          <Title order={3} className={styles.title}>
            {title}
          </Title>
          {problem ? (
            <Group gap="xs" className={styles.metadataGroup}>
              {difficulty && (
                <Badge variant="light" radius="sm" className={styles.difficultyBadge}>
                  {difficulty}
                </Badge>
              )}
              {topics.map((topic) => (
                <Badge key={topic} variant="outline" radius="sm" className={styles.topicBadge}>
                  {topic}
                </Badge>
              ))}
            </Group>
          ) : (
            <Text className={styles.metadataPlaceholder}>
              Waiting for metadata...
            </Text>
          )}
          <Text className={`${styles.description} ${problem ? "" : styles.descriptionPlaceholder}`}>
            {description}
          </Text>
        </Stack>
      </ScrollArea>
    </Card>
  );
}
