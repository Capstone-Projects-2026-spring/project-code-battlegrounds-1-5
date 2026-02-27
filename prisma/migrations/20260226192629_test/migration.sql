-- CreateTable
CREATE TABLE "game_rooms" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_rooms_pkey" PRIMARY KEY ("id")
);
