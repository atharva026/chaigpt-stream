-- AddColumn
ALTER TABLE "Conversation"
ADD COLUMN "parentConversationId" TEXT,
ADD COLUMN "branchPointMessageId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_parentConversationId_idx"
ON "Conversation"("parentConversationId");

-- AddForeignKey
ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_parentConversationId_fkey"
FOREIGN KEY ("parentConversationId") REFERENCES "Conversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
