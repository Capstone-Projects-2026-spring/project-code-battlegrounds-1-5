import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/router";

export default function SignUpPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    const { data, error } = await authClient.signUp.email({
        email, // user email address
        password, // user password -> min 8 characters by default
        name, // user display name
        callbackURL: "/dashboard" // A URL to redirect to after the user verifies their email (optional)
    }, {
        onRequest: (ctx) => {
            //show loading
        },
        onSuccess: (ctx) => {
            //redirect to the dashboard or sign in page
            router.push("/dashboard")
        },
        onError: (ctx) => {
            // display the error message
            alert(ctx.error.message);
        },
    });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSignUp();
      }}
    >
      <input
        data-testid="name-signup"
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        data-testid="email-signup"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        data-testid="password-signup"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button data-testid="signup-button" type="submit" disabled={loading}>
        {loading ? "Creating account..." : "Sign up"}
      </button>
    </form>
  );
}