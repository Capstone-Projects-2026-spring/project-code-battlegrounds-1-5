import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PartyMember, PartyInvite } from "@/contexts/PartyContext";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await auth.api.getSession({ headers: req.headers as Record<string, string> });
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  const [ownedParty, guestSlot] = await Promise.all([
    prisma.party.findUnique({
      where: { ownerId: userId },
      include: {
        member: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    }),
    prisma.partyMember.findUnique({
      where: { userId },
      include: {
        party: {
          include: {
            owner: { select: { id: true, name: true, image: true } },
          },
        },
      },
    }),
  ]);

  let partyMember: PartyMember | null = null;
  if (ownedParty?.member) {
    const m = ownedParty.member;
    partyMember = {
      userId: m.user.id,
      username: m.user.name,
      displayName: m.user.name,
      avatarUrl: m.user.image ?? undefined,
      joinedAt: m.joinedAt.toISOString(),
    };
  }

  const partyCode = ownedParty?.id ?? guestSlot?.partyId ?? null;

  let joinedParty: PartyMember | null = null;
  if (guestSlot) {
    const owner = guestSlot.party.owner;
    joinedParty = {
      userId: owner.id,
      username: owner.name,
      displayName: owner.name,
      avatarUrl: owner.image ?? undefined,
      joinedAt: guestSlot.joinedAt.toISOString(),
    };
  }

  return res.status(200).json({ partyMember, joinedParty, partyCode });
}