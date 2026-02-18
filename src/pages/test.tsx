import Head from "next/head";
import styles from "@/styles/Home.module.css";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function Home() {
    // Left column: infra tests
    const [pgResult, setPgResult] = useState<any>(null);
    const [pgLoading, setPgLoading] = useState(false);
    const [redisResult, setRedisResult] = useState<any>(null);
    const [redisLoading, setRedisLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Right column: auth tests
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [authLoading, setAuthLoading] = useState<string | null>(null); // "signup" | "login" | "logout"
    const { data: session, isPending: sessionLoading, error: sessionError, refetch } = authClient.useSession();
    const [authMessage, setAuthMessage] = useState<string | null>(null);

    const callApi = async (path: string) => {
        setError(null);
        try {
            const res = await fetch(path, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Request failed");
            return data;
        } catch (e: any) {
            setError(e?.message || String(e));
            return null;
        }
    };

    const testPostgres = async () => {
        setPgLoading(true);
        setPgResult(null);
        const data = await callApi("/api/test-postgres");
        if (data) setPgResult(data);
        setPgLoading(false);
    };

    const testRedis = async () => {
        setRedisLoading(true);
        setRedisResult(null);
        const data = await callApi("/api/test-redis");
        if (data) setRedisResult(data);
        setRedisLoading(false);
    };

    // Auth handlers (mirroring signup/login pages but without navigation)
    const handleSignUp = async () => {
        setAuthMessage(null);
        setAuthLoading("signup");
        try {
            const { data, error } = await authClient.signUp.email(
                { email, password, name, callbackURL: "/dashboard" },
                {
                    onError: (ctx) => setAuthMessage(`Sign up error: ${ctx.error.message}`),
                }
            );
            if (error) {
                setAuthMessage(`Sign up error: ${error.message}`);
            } else {
                setAuthMessage("Sign up successful.");
                await refetch?.();
            }
        } finally {
            setAuthLoading(null);
        }
    };

    const handleLogin = async () => {
        setAuthMessage(null);
        setAuthLoading("login");
        try {
            const { data, error } = await authClient.signIn.email(
                { email, password, callbackURL: "/dashboard", rememberMe: false },
                {
                    onError: (ctx) => setAuthMessage(`Login error: ${ctx.error.message}`),
                }
            );
            if (error) {
                setAuthMessage(`Login error: ${error.message}`);
            } else {
                setAuthMessage("Logged in successfully.");
                await refetch?.();
            }
        } finally {
            setAuthLoading(null);
        }
    };

    const handleLogout = async () => {
        setAuthMessage(null);
        setAuthLoading("logout");
        try {
            await authClient.signOut();
            setAuthMessage("Logged out.");
            await refetch?.();
        } catch (e: any) {
            setAuthMessage(e?.message || String(e));
        } finally {
            setAuthLoading(null);
        }
    };

    return (
        <>
            <Head>
                <title>Infra + Auth Test</title>
                <meta name="description" content="Tests" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className={styles.page}>
                <main className={styles.main}>
                    <div style={{ display: "flex", flexDirection: "row", gap: 24, width: "100%" }}>
                        {/* Left column: existing infra tests (about one third) */}
                        <div style={{ flex: "0 0 33%", minWidth: 260 }}>
                            <div className={styles.intro}>
                                <h1>Infrastructure connectivity test</h1>
                                <p>Use the buttons below to verify write/read to Postgres and Redis.</p>
                            </div>

                            <div className={styles.ctas}>
                                <a className="primary" onClick={testPostgres}>
                                    {pgLoading ? "Testing Postgres…" : "Test Postgres"}
                                </a>
                                <a className="secondary" onClick={testRedis}>
                                    {redisLoading ? "Testing Redis…" : "Test Redis"}
                                </a>
                            </div>

                            {error && (
                                <p style={{ color: "#c00", marginTop: 16 }}>Error: {error}</p>
                            )}

                            {pgResult && (
                                <pre style={{ marginTop: 16, width: "100%" }}>
{JSON.stringify(pgResult, null, 2)}
            </pre>
                            )}
                            {redisResult && (
                                <pre style={{ marginTop: 16, width: "100%" }}>
{JSON.stringify(redisResult, null, 2)}
            </pre>
                            )}
                        </div>

                        {/* Right column: new auth tests */}
                        <div style={{ flex: "1 1 auto" }}>
                            <div className={styles.intro}>
                                <h1>Auth tests</h1>
                                <p>Create a user, sign in, and logout. Mirrors signup/login/dashboard flows.</p>
                            </div>
                            <form
                                onSubmit={(e) => e.preventDefault()}
                                style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}
                            >
                                <input
                                    data-testid="name-test"
                                    type="text"
                                    placeholder="Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                <input
                                    data-testid="email-test"
                                    type="email"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <input
                                    data-testid="password-test"
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />

                                <div className={styles.ctas}>
                                    <a className="primary" onClick={handleSignUp}>
                                        {authLoading === "signup" ? "Creating user…" : "Create User"}
                                    </a>
                                    <a className="secondary" onClick={handleLogin}>
                                        {authLoading === "login" ? "Signing in…" : "Sign In"}
                                    </a>
                                    <a className="secondary" onClick={handleLogout}>
                                        {authLoading === "logout" ? "Logging out…" : "Logout"}
                                    </a>
                                </div>

                                {authMessage && (
                                    <p style={{ marginTop: 8 }}>{authMessage}</p>
                                )}

                                {sessionError && (
                                    <p style={{ color: "#c00" }}>Session error: {String(sessionError)}</p>
                                )}

                                <div style={{ marginTop: 16 }}>
                                    <h3>Current session</h3>
                                    {sessionLoading ? (
                                        <p>Loading session…</p>
                                    ) : session ? (
                                        <pre style={{ width: "100%" }}>{JSON.stringify(session, null, 2)}</pre>
                                    ) : (
                                        <p>No active session.</p>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
