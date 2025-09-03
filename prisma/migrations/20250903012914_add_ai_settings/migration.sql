-- AlterTable
ALTER TABLE "public"."clients" ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aiSettings" JSONB;

-- CreateTable
CREATE TABLE "public"."usage_stats" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "emailsProcessed" INTEGER NOT NULL DEFAULT 0,
    "responsesGenerated" INTEGER NOT NULL DEFAULT 0,
    "responsesSent" INTEGER NOT NULL DEFAULT 0,
    "responsesEdited" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_stats_clientId_date_key" ON "public"."usage_stats"("clientId", "date");

-- AddForeignKey
ALTER TABLE "public"."usage_stats" ADD CONSTRAINT "usage_stats_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
