-- CreateEnum
CREATE TYPE "public"."EmailStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'AI_RESPONSE_GENERATED', 'DRAFT_CREATED', 'SENT', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."ResponseStatus" AS ENUM ('DRAFT_CREATED', 'USER_MODIFIED', 'SENT', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."clients" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "webhookId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "businessContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."emails" (
    "id" TEXT NOT NULL,
    "microsoftId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "recipients" JSONB NOT NULL,
    "threadId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "status" "public"."EmailStatus" NOT NULL DEFAULT 'RECEIVED',

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_responses" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "responseContent" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "templateUsed" TEXT,
    "status" "public"."ResponseStatus" NOT NULL DEFAULT 'DRAFT_CREATED',
    "draftId" TEXT,
    "sentAt" TIMESTAMP(3),
    "userModified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."response_templates" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expirationTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "public"."clients"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_tenantId_key" ON "public"."clients"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_microsoftId_key" ON "public"."emails"("microsoftId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_subscriptions_subscriptionId_key" ON "public"."webhook_subscriptions"("subscriptionId");

-- AddForeignKey
ALTER TABLE "public"."emails" ADD CONSTRAINT "emails_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_responses" ADD CONSTRAINT "ai_responses_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "public"."emails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."response_templates" ADD CONSTRAINT "response_templates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
