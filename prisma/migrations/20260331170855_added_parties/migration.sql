-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,

    CONSTRAINT "PartyMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PartyMember" ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
