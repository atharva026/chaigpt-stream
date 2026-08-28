"use server";

import { isTextUIPart, isToolUIPart } from "ai";
import type { MessageRole, MessageStatus, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ChatUIMessage } from "@/features/ai/tools/types";

/** Extracts plain text from an AI SDK `UIMessage` by joining all text parts. */
function getMessageText(message: ChatUIMessage) {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join("");
}

function toPrismaRole(role: ChatUIMessage["role"]): MessageRole {
  switch (role) {
    case "assistant":
      return "ASSISTANT";
    case "system":
      return "SYSTEM";
    default:
      return "USER";
  }
}

function toUIMessageRole(role: MessageRole): ChatUIMessage["role"] {
  switch (role) {
    case "ASSISTANT":
    case "TOOL":
      return "assistant";
    case "SYSTEM":
      return "system";
    default:
      return "user";
  }
}

function getMessageStatus(message: ChatUIMessage): MessageStatus {
  const hasToolError = message.parts.some(
    (part) => isToolUIPart(part) && part.state === "output-error"
  );
  const hasText = getMessageText(message).trim().length > 0;

  if (hasToolError && !hasText) {
    return "ERROR";
  }

  return "COMPLETE";
}

/**
 * Normalizes stored message parts from the database into AI SDK `UIMessage` parts.
 * Falls back to a single text part when no structured parts are stored.
 */
function toUIMessageParts(
  parts: Prisma.JsonValue | null,
  content: string
): ChatUIMessage["parts"] {
  const stored = parts as ChatUIMessage["parts"] | null;
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }

  return [{ type: "text", text: content }];
}

/**
 * Loads all messages for a conversation from the database as AI SDK `UIMessage`s.
 *
 * @param conversationId - The conversation whose messages to load.
 * @returns Messages ordered oldest to newest, ready for `useChat`.
 */
export async function loadChatMessages(
  conversationId: string
): Promise<ChatUIMessage[]> {
  // Load all visible messages in order, including inherited messages from parent conversations.
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { parentConversationId: true, branchPointMessageId: true },
  });

  // Load inherited messages from parent conversations, if any, and slice through the branch point if applicable.
  // (Recursive call to loadChatMessages ensures that we get the full chain of inherited messages.)
  const inherited = conversation.parentConversationId
    ? await loadChatMessages(conversation.parentConversationId)
    : [];
  
  // If there is a branch point, slice the inherited messages to include only those up to and including the branch point message.
  const inheritedThroughBranchPoint =
    conversation.parentConversationId && conversation.branchPointMessageId
      ? (() => {
          const pointIndex = inherited.findIndex(
            (message) => message.id === conversation.branchPointMessageId,
          );
          if (pointIndex < 0) {
            throw new Error("Branch point message not found in parent conversation");
          }
          return inherited.slice(0, pointIndex + 1);
        })()
      : inherited;

  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  // Filter out system messages and convert to UIMessage shape, falling back to a single text part if no structured parts are stored.
  const localMessages = rows
    .filter((row) => row.role !== "SYSTEM")
    .map((row) => ({
      id: row.id,
      role: toUIMessageRole(row.role),
      parts: toUIMessageParts(row.parts, row.content),
    }));
    
  return [...inheritedThroughBranchPoint, ...localMessages];
}

type SaveChatMessagesOptions = {
  updateTitle?: boolean;
};

/**
 * Upserts AI SDK `UIMessage`s into the database for a conversation.
 *
 * @param conversationId - Target conversation ID.
 * @param messages - Messages to persist (system messages are skipped).
 * @param options.updateTitle - When true, auto-titles "New Chat" from the first user message.
 */
export async function saveChatMessages(
  conversationId: string,
  messages: ChatUIMessage[],
  options: SaveChatMessagesOptions = {}
) {
  const { updateTitle = true } = options;

  for (const message of messages) {
    if (message.role === "system") continue;

    const content = getMessageText(message);
    const role = toPrismaRole(message.role);
    const status = getMessageStatus(message);

    await prisma.message.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        conversationId,
        role,
        status,
        content,
        parts: message.parts as Prisma.InputJsonValue,
      },
      update: {
        content,
        parts: message.parts as Prisma.InputJsonValue,
        status,
      },
    });
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { title: true },
  });

  const firstUser = messages.find((message) => message.role === "user");
  const firstUserText = firstUser ? getMessageText(firstUser).trim() : "";

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      title:
        updateTitle && conversation.title === "New Chat" && firstUserText
          ? firstUserText.slice(0, 48)
          : conversation.title,
    },
  });
}
