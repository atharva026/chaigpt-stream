import { loadChatMessages, saveChatMessages } from "@/features/ai/actions/chat-store";
import { chatTools } from "@/features/ai/tools";
import type { ChatUIMessage } from "@/features/ai/tools/types";
import { getChatModel } from "@/features/ai/utils/model";
import { requireUser } from "@/features/auth/action/require-user";
import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import {
    convertToModelMessages,
    createIdGenerator,
    createUIMessageStreamResponse,
    stepCountIs,
    streamText,
    toUIMessageStream,
} from "ai";

const DEFAULT_SYSTEM_PROMPT = `You are ChaiGPT, a helpful assistant.

You have a webSearch tool for live information. Call it when the user asks about current events, recent news, live facts, or anything you are not confident about. After the tool returns, write a clear final answer using those results. Cite source titles and URLs from the tool output. Never invent URLs or sources. If search fails, say so and answer with what you know.`;

/**
 * POST /api/chat — Streams an AI assistant reply for a conversation.
 *
 * Validates auth and ownership, persists the user message, then streams the
 * assistant response via the AI SDK (including optional webSearch tool calls).
 * Final messages are saved when the stream ends.
 */
export async function POST(req: Request) {
    await auth.protect();

    const { message, id }: { message: ChatUIMessage; id: string } = await req.json();

    if (!message || !id) {
        return new Response("Missing message or conversation id", { status: 400 });
    }

    const user = await requireUser();

    const conversation = await prisma.conversation.findFirst({
        where: {
            id,
            userId: user.id,
        },
    });

    if (!conversation) {
        return new Response("Conversation not found", { status: 404 });
    }

    const previousMessages = await loadChatMessages(id);

    const alreadySaved = previousMessages.some(
        (storedMessage) => storedMessage.id === message.id
    );

    const messages = alreadySaved ? previousMessages : [...previousMessages, message];

    if (!alreadySaved) {
        await saveChatMessages(id, [message]);
    }

    try {
        const result = streamText({
            model: getChatModel(conversation.model),
            system: conversation.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages),
            tools: chatTools,
            stopWhen: stepCountIs(5),
            onError: ({ error }) => {
                console.error("Chat stream error:", error);
            },
        });

        result.consumeStream();

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({
                stream: result.stream,
                originalMessages: messages,
                generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
                onEnd: async ({ messages: finalMessages }) => {
                    try {
                        await saveChatMessages(id, finalMessages, { updateTitle: false });
                    } catch (error) {
                        console.error(error);
                    }
                },
            }),
        });
    } catch (error) {
        console.error(error);
        return new Response("Failed to generate a response", { status: 500 });
    }
}
