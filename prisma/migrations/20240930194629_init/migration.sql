-- CreateTable
CREATE TABLE "ZoraNft" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "metadataUri" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoraNft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoraNft_href_key" ON "ZoraNft"("href");
