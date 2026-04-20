import {
  createContext,
  useContext,
  useState,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSocket } from "./SocketContext";
import { showFriendRequestNotification } from "@/components/notifications";
import { authClient } from "@/lib/auth-client";

export type PresenceStatus = "online" | "away" | "offline";

export interface Friend {
  id: string;
  friendId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  status: PresenceStatus;
  activity?: string;
}

export interface FriendRequest {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  direction: "incoming" | "outgoing";
  createdAt: string;
}

export interface FriendshipContextAPI {
  friends: Friend[];
  setFriends: Dispatch<SetStateAction<Friend[]>>;

  friendRequests: FriendRequest[];
  setFriendRequests: Dispatch<SetStateAction<FriendRequest[]>>;

  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];

  friendCode: string | null;
  setFriendCode: Dispatch<SetStateAction<string | null>>;
}

export const FriendshipContext = createContext<FriendshipContextAPI | null>(null);

export const FriendshipProvider = ({ children }: { children: ReactNode }) => {
  const { socket } = useSocket();
  const { data: session, isPending } = authClient.useSession();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendCode, setFriendCode] = useState<string | null>(null);

  useEffect(() => {
    if (!session && !isPending) return;
    fetch("/api/friends")
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setFriends(data.friends ?? []);
        setFriendRequests(data.friendRequests ?? []);
        setFriendCode(data.friendCode ?? null);

      })
      .catch((err) => {
        console.error("Failed to fetch friends:", err);
      });
  }, [session, isPending]);

  useEffect(() => {
    if (!socket) return;

    const onFriendRequestReceived = (request: FriendRequest) => {
      setFriendRequests((prev) => {
        if (prev.some((r) => r.id === request.id)) return prev;
        return [...prev, { ...request, direction: "incoming" }];
      });

      showFriendRequestNotification(
        request.displayName,
        request.id,
        () => {
          socket.emit("friendRequestAccept", { requestId: request.id });
          setFriendRequests((prev) => prev.filter((r) => r.id !== request.id));
        },
        () => {
          socket.emit("friendRequestDecline", { requestId: request.id });
          setFriendRequests((prev) => prev.filter((r) => r.id !== request.id));
        },
      );
    };

    const onFriendRequestAccepted = (friend: Friend) => {
      setFriendRequests((prev) => prev.filter((r) => r.userId !== friend.id));
      setFriends((prev) => {
        if (prev.some((f) => f.id === friend.id)) return prev;
        return [...prev, friend];
      });
    };

    const onFriendRequestDeclined = ({ requestId }: { requestId: string }) => {
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    };

    const onFriendDeleted = ({ friendId }: { friendId: string }) => {
      setFriends((prev) => prev.filter(friend => friend.friendId !== friendId));
    };

    socket.on("friendRequestReceived", onFriendRequestReceived);
    socket.on("friendRequestAccepted", onFriendRequestAccepted);
    socket.on("friendRequestDeclined", onFriendRequestDeclined);
    socket.on("friendDeleted", onFriendDeleted);

    return () => {
      socket.off("friendRequestReceived", onFriendRequestReceived);
      socket.off("friendRequestAccepted", onFriendRequestAccepted);
      socket.off("friendRequestDeclined", onFriendRequestDeclined);
      socket.on("friendDeleted", onFriendDeleted);
    };
  }, [socket]);

  const v: FriendshipContextAPI = {
    friends,
    setFriends,
    friendRequests,
    setFriendRequests,
    incomingRequests: friendRequests.filter((r) => r.direction === "incoming"),
    outgoingRequests: friendRequests.filter((r) => r.direction === "outgoing"),
    friendCode,
    setFriendCode
  };

  return (
    <FriendshipContext.Provider value={v}>
      {children}
    </FriendshipContext.Provider>
  );
};

export function useFriendship() {
  const ctx = useContext(FriendshipContext);
  if (!ctx) throw new Error("useFriendship must be used within a FriendshipProvider");
  return ctx;
}