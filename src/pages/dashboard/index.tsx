import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, isPending, error, refetch } =  authClient.useSession()
    const posthog = usePostHog();

    useEffect(() => {
        if(!isPending && !session) {
            router.push("/login")
        }
    }, [isPending, session, router])
    
    if (isPending) return <p>Loading...</p>;
    if (!session) return null;

    return (
        <div>
            <h1>Welcome {session.user.name}</h1>
            <button onClick={() => {
                posthog.capture("user_signed_out");
                authClient.signOut();
            }}>Sign Out</button>
        </div>
    )
}