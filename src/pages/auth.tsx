import { useRouter } from "next/router";
import { Button, Flex, Card } from "@mantine/core";

export default function AuthPage() {
  const router = useRouter();

  return (
    <Flex justify="center" align="center" mih="100vh">
      <Card miw="30%">
        <Flex direction={"column"} gap="xs">
          <Button
            onClick={() => router.push("/login")}
          >
            Log in
          </Button>
          <Button
            onClick={() => router.push("/signup")}
          >
            Sign up
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}
