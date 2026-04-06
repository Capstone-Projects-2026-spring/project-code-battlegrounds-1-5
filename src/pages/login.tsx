import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "@mantine/form";
import { Button, Card, Flex, PasswordInput, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePostHog } from "posthog-js/react";

export default function LoginPage() {
  const router = useRouter();
  const [pwVisible, { toggle }] = useDisclosure();
  const [loading, setLoading] = useState(false);

  const posthog = usePostHog();

  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      email: '',
      password: ''
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
    },
  });

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/",
      rememberMe: true
    });

    if (error) {
      posthog.capture("user_login_failure");
      alert(error.message);
      setLoading(false);
      return;
    }

    posthog.capture("user_login_success");
    posthog.identify(data.user.id);
    setLoading(false);
    router.push("/");
  }

  return (
    <Flex justify={"center"} align={"center"} mih="100vh">
      <Card miw="30%">
        <form onSubmit={form.onSubmit(
          (values) => {
            handleLogin(values.email, values.password);
          }
        )}>
          <Flex direction={"column"} gap="sm">
            <TextInput
              data-testid="email-login"
              withAsterisk
              label="Email"
              placeholder="ian@temple.edu"
              key={form.key("email")}
              {...form.getInputProps("email")}
            />

            <PasswordInput
              data-testid="password-login"
              withAsterisk
              label="Password"
              placeholder="hunter2"
              key={form.key("password")}
              visible={pwVisible}
              onVisibilityChange={toggle}
              {...form.getInputProps("password")}
            />

            <Button
              data-testid="login-button"
              type="submit"
              loading={loading}
            >
              Log In
            </Button>
          </Flex>
        </form>
      </Card>
    </Flex>
  );
}
