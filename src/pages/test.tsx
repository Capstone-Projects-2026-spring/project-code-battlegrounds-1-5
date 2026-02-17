import Head from "next/head";
import styles from "@/styles/Home.module.css";
import { useState } from "react";

export default function Home() {
    const [pgResult, setPgResult] = useState<any>(null);
    const [pgLoading, setPgLoading] = useState(false);
    const [redisResult, setRedisResult] = useState<any>(null);
    const [redisLoading, setRedisLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    return (
        <>
            <Head>
                <title>Infra Test</title>
                <meta name="description" content="Infra Connectivity Test" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className={styles.page}>
                <main className={styles.main}>
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
                </main>
            </div>
        </>
    );
}
