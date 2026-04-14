import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "@mantine/form";
import {
  Button,
  Card,
  Flex,
  PasswordInput,
  TextInput,
  Title,
  Text,
  Anchor,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePostHog } from "posthog-js/react";
import Brand from "@/components/Brand";
import styles from "@/styles/Login.module.css";
import Link from "next/link";
import Head from "next/head";

function LeftPanel() {
  return (
    <div className={styles.leftPanel}>
      <div className={styles.gridBg} />
      <div className={styles.leftContent}>
        <div className={styles.liveTag}>
          <span className={styles.liveDot} />
          LIVE — 142 matches in progress
        </div>
        <div className={styles.bigTitle}>
          &gt;_ CODE
          <br />
          <span>BATTLE</span>
          <br />
          GROUNDS
        </div>
        <p className={styles.leftSubtitle}>
          Compete. Solve. Dominate.
          <br />
          Real-time coding battles, ranked
          <br />
          matches, and team warfare.
        </p>
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <div className={styles.statVal}>8,421</div>
            <div className={styles.statLabel}>PLAYERS</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>142</div>
            <div className={styles.statLabel}>LIVE GAMES</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statVal}>#1</div>
            <div className={styles.statLabel}>RANKED</div>
          </div>
        </div>
      </div>
      <div className={styles.ticker}>
        <span>// recent:</span> xX_dev_Xx solved "Two Sum" in 0:43
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [pwVisible, { toggle }] = useDisclosure();
  const [loading, setLoading] = useState(false);
  const posthog = usePostHog();

  const form = useForm({
    mode: "uncontrolled",
    initialValues: { email: "", password: "" },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
    },
  });

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/",
      rememberMe: true,
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
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className={styles.loginPage}>
        <div className={styles.layout}>
          <LeftPanel />

          <div className={styles.rightPanel}>
            <Card className={styles.formCard} padding={0}>
              <form
                onSubmit={form.onSubmit((values) =>
                  handleLogin(values.email, values.password),
                )}
              >
                <Flex direction="column" gap="md">
                  <div className={styles.brandContainer}>
                    <div className={styles.brandTrack}>
                      <div className={styles.brandGroup}>
                        <Brand />
                        <Brand />
                      </div>
                      <div className={styles.brandGroup} aria-hidden="true">
                        <Brand />
                        <Brand />
                      </div>
                    </div>
                  </div>

                  <Title order={2} ta="center" className={styles.heading}>
                    Welcome back
                  </Title>

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

                  <Button
                    data-testid="login-button"
                    type="submit"
                    loading={loading}
                    className={styles.button}
                    size="md"
                    color="console"
                    fullWidth
                  >
                    Log in
                  </Button>

                  <Text size="sm" c="dimmed" ta="center">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" passHref legacyBehavior>
                      <Anchor component="a">Sign up</Anchor>
                    </Link>
                  </Text>
                </Flex>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
