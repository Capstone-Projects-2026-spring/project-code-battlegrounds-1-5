import {
    createContext,
    useContext,
    useEffect,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from "react";
import { useSocket } from "./SocketContext";

export interface PartyMember {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    joinedAt: string;
}

export interface PartyInvite {
    fromUserId: string;
    fromDisplayName: string;
    fromAvatarUrl?: string;
    partyOwnerId: string;
    sentAt: string;
}

export interface PartyContextAPI {
    partyMember: PartyMember | null;
    setPartyMember: Dispatch<SetStateAction<PartyMember | null>>;

    joinedParty: PartyMember | null;  // for yourself if you are not the owner
    setJoinedParty: Dispatch<SetStateAction<PartyMember | null>>;

    pendingInvite: PartyInvite | null;
    setPendingInvite: Dispatch<SetStateAction<PartyInvite | null>>;

    partyCode: string | null;
    setPartyCode: Dispatch<SetStateAction<string | null>>;
}

export const PartyContext = createContext<PartyContextAPI | null>(null);

export const PartyProvider = ({ children }: { children: ReactNode }) => {
    const { socket } = useSocket();

    const [partyMember, setPartyMember] = useState<PartyMember | null>(null);
    const [joinedParty, setJoinedParty] = useState<PartyMember | null>(null);
    const [pendingInvite, setPendingInvite] = useState<PartyInvite | null>(null);
    const [partyCode, setPartyCode] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/party")
            .then((res) => {
                if (!res.ok) return;
                return res.json();
            })
            .then((data) => {
                if (!data) return;
                setPartyMember(data.partyMember ?? null);
                setJoinedParty(data.joinedParty ?? null);
                setPendingInvite(data.pendingInvite ?? null);
                setPartyCode(data.partyCode ?? null);
            })
            .catch((err) => {
                console.error("Failed to fetch party status:", err);
            });
    }, []);

    useEffect(() => {
        if (!socket) return;

        const onPartyMemberJoined = (member: PartyMember) => {
            setPartyMember(member);
        };

        const onPartyInviteReceived = (invite: PartyInvite) => {
            setPendingInvite(invite);
        };

        const onPartyMemberLeft = () => {
            setPartyMember(null);
        };

        const onJoinedPartyLeft = () => {
            setJoinedParty(null);
        };

        socket.on("partyMemberJoined", onPartyMemberJoined);
        socket.on("partyInviteReceived", onPartyInviteReceived);
        socket.on("partyMemberLeft", onPartyMemberLeft);
        socket.on("joinedPartyLeft", onJoinedPartyLeft);

        return () => {
            socket.off("partyMemberJoined", onPartyMemberJoined);
            socket.off("partyInviteReceived", onPartyInviteReceived);
            socket.off("partyMemberLeft", onPartyMemberLeft);
            socket.off("joinedPartyLeft", onJoinedPartyLeft);
        };
    }, [socket]);

    const v: PartyContextAPI = {
        partyMember,
        setPartyMember,
        joinedParty,
        setJoinedParty,
        pendingInvite,
        setPendingInvite,
        partyCode,
        setPartyCode,
    };

    return (
        <PartyContext.Provider value={v}>
            {children}
        </PartyContext.Provider>
    );
};

export function useParty() {
    const ctx = useContext(PartyContext);
    if (!ctx) throw new Error("useParty must be used within a PartyProvider");
    return ctx;
}