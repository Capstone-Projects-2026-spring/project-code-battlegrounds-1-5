import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/router";
import { useForm } from "@mantine/form";
import { Button, Card, Flex, PasswordInput, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePostHog } from "posthog-js/react";

export default function SignUpPage() {
  const router = useRouter();
  const [pwVisible, { toggle }] = useDisclosure();
  const [loading, setLoading] = useState(false);

  const posthog = usePostHog();

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
        router.push("/")
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
    <Flex justify={"center"} align={"center"} mih="100vh">
      <Card miw="30%">
        <form onSubmit={form.onSubmit(
          (values) => {
            handleSignUp(values.name, values.email, values.password);
          }
        )}>
          <Flex direction={"column"} gap="sm">
            <TextInput
              data-testid="name-signup"
              withAsterisk
              label="Name"
              placeholder="Ian Applebaum"
              key={form.key("name")}
              {...form.getInputProps("name")}
            />

            <TextInput
              data-testid="email-signup"
              withAsterisk
              label="Email"
              placeholder="ian@temple.edu"
              key={form.key("email")}
              {...form.getInputProps("email")}
            />

            <PasswordInput
              data-testid="password-signup"
              withAsterisk
              label="Password"
              placeholder="hunter2"
              key={form.key("password")}
              visible={pwVisible}
              onVisibilityChange={toggle}
              {...form.getInputProps("password")}
            />

            <Button
              data-testid="signup-button"
              type="submit"
              loading={loading}
            >
              Sign Up
            </Button>
          </Flex>
        </form>
      </Card>
    </Flex>


    // <form
    //   onSubmit={(e) => {
    //     e.preventDefault();
    //     handleSignUp();
    //   }}
    // >
    //   <input
    //     data-testid="name-signup"
    //     type="text"
    //     placeholder="Name"
    //     value={name}
    //     onChange={(e) => setName(e.target.value)}
    //   />

    //   <input
    //     data-testid="email-signup"
    //     type="email"
    //     placeholder="Email"
    //     value={email}
    //     onChange={(e) => setEmail(e.target.value)}
    //   />

    //   <input
    //     data-testid="password-signup"
    //     type="password"
    //     placeholder="Password"
    //     value={password}
    //     onChange={(e) => setPassword(e.target.value)}
    //   />

    //   <button data-testid="signup-button" type="submit" disabled={loading}>
    //     {loading ? "Creating account..." : "Sign up"}
    //   </button>
    // </form>
  );
}