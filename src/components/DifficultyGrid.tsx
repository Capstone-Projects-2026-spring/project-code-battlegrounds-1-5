import {
  Container,
  Grid,
  Skeleton,
  Text,
  Card,
  Box,
  Flex,
  Button,
} from "@mantine/core";
import { useState } from "react";

export default function Subgrid() {
  const [loading, setLoading] = useState(false);

  return (
    <Container my="md">
      <Grid>
        <Grid.Col span={4}>
          {loading ? (
            <Skeleton height={360} radius="md" />
          ) : (
            <Card radius="md" h={360} withBorder>
              <Flex
                direction="column"
                align={"center"}
                justify={"center"}
                style={{ height: "100%" }}
              >
                <Box
                  w={48}
                  h={48}
                  bg="green.6"
                  style={{
                    borderRadius: "50%",
                    marginBottom: 12,
                  }}
                />
                <Text fw={500}>Easy Difficulty</Text>
                <Text size="sm" c="dimmed">
                  For Beginners
                </Text>
                <Text size="sm" c="dimmed">
                  Arrays
                </Text>
                <Text size="sm" c="dimmed">
                  Strings
                </Text>

                <Button mt={"auto"}>Vote</Button>
              </Flex>
            </Card>
          )}
        </Grid.Col>

        <Grid.Col span={4}>
          {loading ? (
            <Skeleton height={360} radius="md" />
          ) : (
            <Card radius="md" h={360} withBorder>
              <Flex
                direction="column"
                align={"center"}
                justify={"center"}
                style={{ height: "100%" }}
              >
                <Box
                  w={48}
                  h={48}
                  bg="orange.6"
                  style={{
                    borderRadius: "50%",
                    marginBottom: 12,
                  }}
                />
                <Text fw={500}>Medium Difficulty</Text>
                <Text size="sm" c="dimmed">
                  For Intermediate Programmers
                </Text>
                <Text size="sm" c="dimmed">
                  Math Questions
                </Text>
                <Text size="sm" c="dimmed">
                  Hash Maps
                </Text>
                <Text size="sm" c="dimmed">
                  Sorts
                </Text>

                <Button mt={"auto"}>Vote</Button>
              </Flex>
            </Card>
          )}
        </Grid.Col>

        <Grid.Col span={4}>
          {loading ? (
            <Skeleton height={360} radius="md" />
          ) : (
            <Card radius="md" h={360} withBorder>
              <Flex
                direction="column"
                align={"center"}
                justify={"center"}
                style={{ height: "100%" }}
              >
                <Box
                  w={48}
                  h={48}
                  bg="red.6"
                  style={{
                    borderRadius: "50%",
                    marginBottom: 12,
                  }}
                />
                <Text fw={500}>Hard Difficulty</Text>
                <Text size="sm" c="dimmed">
                  For Advanced PRogrammers
                </Text>
                <Text size="sm" c="dimmed">
                  Data Structures And Algorithms
                </Text>
                <Text size="sm" c="dimmed">
                  Trees
                </Text>
                <Text size="sm" c="dimmed">
                  Graphs
                </Text>
                <Text size="sm" c="dimmed">
                  Dynamic Programming
                </Text>
                <Button mt={"auto"}>Vote</Button>
              </Flex>
            </Card>
          )}
        </Grid.Col>
      </Grid>
    </Container>
  );
}
