import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function DashboardPage() {
    const router = useRouter();
    const { data: session, isPending, error, refetch } =  authClient.useSession()

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
            <button onClick={() => authClient.signOut()}>Sign Out</button>
        </div>
    )
}