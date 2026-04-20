import { authClient } from "@/lib/auth-client";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useForm } from "@mantine/form";
import { Button, Card, Flex, PasswordInput, TextInput, Title, Text, Anchor } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePostHog } from "posthog-js/react";
import Brand from "@/components/Brand";
import greenTheme from "@/styles/shared/GreenTheme.module.css";
import styles from "@/styles/Signup.module.css";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [pwVisible, { toggle }] = useDisclosure();
  const [loading, setLoading] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  const posthog = usePostHog();

  useEffect(() => {
      if (session && !isPending) {
        router.replace("/matchmaking");
      }
    }, [session, isPending, router]);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      name: '',
      email: '',
      password: ''
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Invalid email'),
    },
  });

  const handleSignUp = async (name: string, email: string, password: string) => {
    await authClient.signUp.email({
      email, // user email address
      password, // user password -> min 8 characters by default
      name, // user display name
      callbackURL: "/" // A URL to redirect to after the user verifies their email (optional)
    }, {
      onRequest: (ctx) => {
        //show loading
        setLoading(true);
      },
      onSuccess: (ctx) => {
        posthog.capture("user_signup_success");
        //redirect to the dashboard or sign in page
        router.push("/matchmaking");
      },
      onError: (ctx) => {
        posthog.capture("user_signup_failure");
        // display the error message
        alert(ctx.error.message);
        setLoading(false);
      },
    });
  };

  return (
    <div className={`${greenTheme.gridBgFixed} ${styles.signupPage}`}>
      <div className={styles.gradient} />

      <Card
        className={styles.formCard}
        shadow="xl"
        withBorder
        padding="xl"
      >
        <form onSubmit={form.onSubmit(
          (values) => {
            handleSignUp(values.name, values.email, values.password);
          }
        )}>
          <Flex direction="column" gap="md">
            <div className={styles.brand}>
              <Brand blink />
            </div>

            <Title ta="center" order={2} className={`${greenTheme.gradientText} ${styles.heading}`}>
              Join the Arena
            </Title>

            <div className={styles.inputGroup}>
              <TextInput
                data-testid="name-signup"
                withAsterisk
                label="Name"
                placeholder="Ian Applebaum"
                key={form.key("name")}
                {...form.getInputProps("name")}
                className={styles.input}
                size="md"
              />
            </div>

            <div className={styles.inputGroup}>
              <TextInput
                data-testid="email-signup"
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
                data-testid="password-signup"
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
              data-testid="signup-button"
              type="submit"
              loading={loading}
              className={styles.button}
              size="md"
              color="console"
              fullWidth
            >
              Sign Up
            </Button>

            <Text size="sm" c="dimmed" ta="center" className={styles.link}>
              Already have an account?{" "}
              <Link href="/login" passHref legacyBehavior>
                <Anchor component="a" className={styles.link}>
                  Log in
                </Anchor>
              </Link>
            </Text>
          </Flex>
        </form>
      </Card>
    </div>
  );
}