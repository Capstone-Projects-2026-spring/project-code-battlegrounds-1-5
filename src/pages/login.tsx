import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "@mantine/form";
import { Button, Card, Flex, PasswordInput, TextInput, Title, Text, Anchor } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePostHog } from "posthog-js/react";
import Brand from "@/components/Brand";
import greenTheme from "@/styles/shared/GreenTheme.module.css";
import styles from "@/styles/Login.module.css";
import Link from "next/link";

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
  };

  return (
    <div className={`${greenTheme.gridBgFixed} ${styles.loginPage}`}>
      <div className={styles.gradient} />

      <Card
        className={styles.formCard}
        shadow="xl"
        withBorder
        padding="xl"
      >
        <form onSubmit={form.onSubmit(
          (values) => {
            handleLogin(values.email, values.password);
          }
        )}>
          <Flex direction="column" gap="md">
            <div className={styles.brand}>
              <Brand />
            </div>

            <Title order={2} ta="center" className={`${greenTheme.gradientText} ${styles.heading}`}>
              Welcome Back
            </Title>

            <div className={styles.inputGroup}>
              <TextInput
                data-testid="email-login"
                withAsterisk
                label="Email"
                placeholder="ian@temple.edu"
                key={form.key("email")}
                {...form.getInputProps("email")}
                className={styles.input}
                size="md"
              />
            </div>

            <div className={styles.inputGroup}>
              <PasswordInput
                data-testid="password-login"
                withAsterisk
                label="Password"
                placeholder="hunter2"
                key={form.key("password")}
                visible={pwVisible}
                onVisibilityChange={toggle}
                {...form.getInputProps("password")}
                className={styles.input}
                size="md"
              />
            </div>

            <Button
              data-testid="login-button"
              type="submit"
              loading={loading}
              className={styles.button}
              size="md"
              color="console"
              fullWidth
            >
              Log In
            </Button>

            <Text size="sm" c="dimmed" ta="center" className={styles.link}>
              Don&apos;t have an account?{" "}
              <Link href="/signup" passHref legacyBehavior>
                <Anchor component="a" className={styles.link}>
                  Sign up
                </Anchor>
              </Link>
            </Text>
          </Flex>
        </form>
      </Card>
    </div>
  );
}
