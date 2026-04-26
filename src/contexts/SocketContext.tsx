import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { io, type Socket } from "socket.io-client";
import { authClient } from "@/lib/auth-client";
import { showErrorNotification } from "@/components/notifications";

export interface SocketContextAPI {
  socket: Socket | undefined;
  setSocket: Dispatch<SetStateAction<Socket | undefined>>;
}

export const SocketContext = createContext<SocketContextAPI | null>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = authClient.useSession();

  const [socket, setSocket] = useState<Socket | undefined>();

  // Initialize socket once when the user session is available
  useEffect(() => {
    if (!session?.user.id) return;
    if (socket) return;

    const socketInstance = io({ autoConnect: true });

    socketInstance.on("connect", () => {
      socketInstance.emit("register", { userId: session.user.id });
    });
    
    socketInstance.on("error", ({ message }: {message: string}) => {
      showErrorNotification(message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const v: SocketContextAPI = {
    socket,
    setSocket,
  };

  return (
    <SocketContext.Provider value={v}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}