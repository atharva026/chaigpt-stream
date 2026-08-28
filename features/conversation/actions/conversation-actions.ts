"use server";

import { requireUser } from "@/features/auth/action/require-user";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

/** Shape of a conversation row returned in the sidebar list. */
export type ConversationListItem = {
    id: string;
    title: string;
    isPinned: boolean;
    isArchived: boolean;
    lastMessageAt: Date;
    createdAt: Date;
    updatedAt: Date;
};

/** Shape of a conversation branch row. */
export type BranchListItem = {
    id: string;
    title: string;
    parentConversationId: string | null;
    branchPointMessageId: string | null;
    createdAt: Date;
    updatedAt: Date;
};


/**
 * Verifies that a conversation exists and belongs to the given user.
 *
 * @throws {Error} When the conversation is not found or not owned by the user.
 */
async function assertOwnsConversation(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
        where: {
            id: conversationId,
            userId
        }
    });

    if (!conversation) {
        throw new Error("Conversation not found")
    }

    return conversation
}

/**
 * Fetches a single conversation owned by the current user.
 *
 * @param conversationId - The conversation to load.
 * @throws {Error} When the conversation is not found.
 */
export async function getConversation(conversationId: string) {
    const user = await requireUser();
    return assertOwnsConversation(conversationId, user.id)
}


/**
 * Lists non-archived conversations for the current user.
 * Pinned conversations appear first, then sorted by most recent activity.
 */
export async function listConversations(): Promise<ConversationListItem[]> {
    const user = await requireUser();

    return prisma.conversation.findMany({
        where: { userId: user.id, isArchived: false, parentConversationId: null },
        orderBy: [{ isPinned: "desc" }, { lastMessageAt: "desc" }],
        select: {
            id: true,
            title: true,
            isPinned: true,
            isArchived: true,
            lastMessageAt: true,
            createdAt: true,
            updatedAt: true,
        },
    })
}

/** Lists all branches in the active conversation's lineage tree. */
export async function listConversationBranches(conversationId: string): Promise<BranchListItem[]> {
    const user = await requireUser();
    await assertOwnsConversation(conversationId, user.id);

    const conversations = await prisma.conversation.findMany({
        where: { userId: user.id, isArchived: false },
        select: {
            id: true,
            title: true,
            parentConversationId: true,
            branchPointMessageId: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "asc" },
    });

    const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]));
    let rootId = conversationId;
    
    while (byId.get(rootId)?.parentConversationId) {
        rootId = byId.get(rootId)!.parentConversationId!;
    }

    return conversations.filter((conversation) => {
        let current: BranchListItem | undefined = conversation;
        while (current?.parentConversationId) {
            current = byId.get(current.parentConversationId);
        }
        return current?.id === rootId;
    });
}

/** Creates a child branch at any message visible in the source lineage. */
export async function createConversationBranch(
    conversationId: string,
    branchPointMessageId: string,
    title?: string,
) {
    const user = await requireUser();
    const source = await assertOwnsConversation(conversationId, user.id);
    const message = await prisma.message.findUnique({ where: { id: branchPointMessageId } });
    
    if (!message || message.role === "SYSTEM") {
        throw new Error("Branch point message not found");
    }

    const visibleMessages = await getVisibleMessageIds(conversationId);
    if (!visibleMessages.has(branchPointMessageId)) {
        throw new Error("Branch point message is not in this conversation");
    }

    const branch = await prisma.conversation.create({
        data: {
            userId: user.id,
            title: title?.trim() || `Branch from ${source.title}`,
            model: source.model,
            systemPrompt: source.systemPrompt,
            parentConversationId: conversationId,
            branchPointMessageId,
        },
    });

    revalidatePath(`/c/${conversationId}`);
    revalidatePath(`/c/${branch.id}`);

    return branch;
}

/** Fetches the IDs of all visible messages in a conversation. */
async function getVisibleMessageIds(conversationId: string): Promise<Set<string>> {
    const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { parentConversationId: true, branchPointMessageId: true },
    });

    const inherited = conversation.parentConversationId
        ? [...(await getVisibleMessageIdsInOrder(conversation.parentConversationId))]
        : [];

    const visibleInherited = sliceThroughBranchPoint(
        inherited,
        conversation.parentConversationId ? conversation.branchPointMessageId : null,
    );

    const local = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });

    return new Set([...visibleInherited, ...local.map(({ id }) => id)]);
}

/** Fetches the IDs of all visible messages in a conversation, ordered by creation date. */
async function getVisibleMessageIdsInOrder(conversationId: string): Promise<string[]> {
    const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { parentConversationId: true, branchPointMessageId: true },
    });

    const inherited = conversation.parentConversationId
        ? await getVisibleMessageIdsInOrder(conversation.parentConversationId)
        : [];

    const visibleInherited = sliceThroughBranchPoint(
        inherited,
        conversation.parentConversationId ? conversation.branchPointMessageId : null,
    );

    const local = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });

    return [...visibleInherited, ...local.map(({ id }) => id)];
}

/** Slices a list of message IDs through a branch point. */
function sliceThroughBranchPoint(messageIds: string[], branchPointMessageId: string | null) {
    if (!branchPointMessageId) return messageIds;

    const pointIndex = messageIds.indexOf(branchPointMessageId);

    if (pointIndex < 0) {
        throw new Error("Branch point message not found in parent conversation");
    }

    return messageIds.slice(0, pointIndex + 1);
}

/** Deletes a branch and all descendants; root conversations use deleteConversation. */
export async function deleteConversationBranch(conversationId: string) {
    const user = await requireUser();
    const conversation = await assertOwnsConversation(conversationId, user.id);

    if (!conversation.parentConversationId) {
        throw new Error("The root conversation cannot be deleted as a branch");
    }

    await prisma.conversation.delete({ where: { id: conversationId } });

    revalidatePath("/");

    return { id: conversationId };
}

/**
 * Creates a new conversation for the current user.
 *
 * @param title - Optional title; defaults to "New Chat".
 */
export async function createConversation(title = "New Chat") {
    const user = await requireUser();

    return prisma.conversation.create({
        data: {
            userId: user.id,
            title: title.trim() || "New Chat",
        },
    });
}

/**
 * Updates conversation metadata (title, pin, or archive status).
 *
 * @param conversationId - The conversation to update.
 * @param data - Fields to change; omitted fields are left unchanged.
 */
export async function updateConversation(
    conversationId: string,
    data: { title?: string; isPinned?: boolean; isArchived?: boolean }
) {
    const user = await requireUser();
    await assertOwnsConversation(conversationId, user.id);

    const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
            ...(data.title !== undefined ? { title: data.title.trim() || "New Chat" } : {}),
            ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
            ...(data.isArchived !== undefined ? { isArchived: data.isArchived } : {}),
        },
    });

    revalidatePath("/");
    revalidatePath(`/c/${conversationId}`);
    return conversation;
}



/**
 * Permanently deletes a conversation owned by the current user.
 *
 * @param conversationId - The conversation to delete.
 * @returns The deleted conversation ID.
 */
export async function deleteConversation(conversationId: string) {
    const user = await requireUser();
    await assertOwnsConversation(conversationId, user.id);

    await prisma.conversation.delete({
        where: { id: conversationId },
    });

    revalidatePath("/");
    return { id: conversationId };
}