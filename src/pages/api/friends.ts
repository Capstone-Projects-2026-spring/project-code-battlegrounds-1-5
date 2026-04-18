import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Friend, FriendRequest } from "@/contexts/FriendshipContext";
import { nanoid } from "nanoid";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await auth.api.getSession({ headers: req.headers as Record<string, string> });
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  if (req.method === "PUT") {
    const newFriendCode = nanoid(6);
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { friendCode: newFriendCode },
      });
    } catch (e) {
      console.error("Error: ", e);
      res.status(405).json({ error: e });
    }
    
    return res.status(200).json({ newFriendCode });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const [acceptedFriendships, pendingFriendships, currentUser] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, name: true, image: true } },
        addressee: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.friendship.findMany({
      where: {
        status: "PENDING",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, name: true, image: true } },
        addressee: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { friendCode: true },
    }),
  ]);

  const friends: Friend[] = acceptedFriendships.map((f) => {
    const other = f.requesterId === userId ? f.addressee : f.requester;
    return {
      id: other.id,
      friendId: f.id,
      username: other.name,
      displayName: other.name,
      avatarUrl: other.image ?? undefined,
      status: "online", // Presence status would require additional implementation
    };
  });

  const friendRequests: FriendRequest[] = pendingFriendships.map((f) => {
    const isOutgoing = f.requesterId === userId;
    const other = isOutgoing ? f.addressee : f.requester;
    return {
      id: f.id,
      userId: other.id,
      username: other.name,
      displayName: other.name,
      avatarUrl: other.image ?? undefined,
      direction: isOutgoing ? "outgoing" : "incoming",
      createdAt: f.createdAt.toISOString(),
    };
  });

  return res.status(200).json({
    friends,
    friendRequests,
    friendCode: currentUser?.friendCode ?? null,
  });
}