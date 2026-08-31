"use client";
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useQueryClient } from '@tanstack/react-query';
import { DefaultChatTransport } from 'ai';
import type { ChatUIMessage } from '@/features/ai/tools/types';
import { useChat } from "@ai-sdk/react"
import React, { useMemo } from 'react'
import { useConversations, useCreateConversationBranch } from '../hooks/use-conversation';
import { queryKeys } from '../utils/query-keys';
import { toast } from 'sonner';
import { ChatEmpty } from './chat-empty';
import { ChatMessages } from './chat-messages';
import { ChatComposer } from './chat-composer';
import { BranchSwitcher } from './branch-switcher';

type ConversationViewProps = {
    conversationId: string;
    initialMessages: ChatUIMessage[];
};

/**
 * Main chat view — header, message list (or empty state), and composer with streaming.
 */
export const ConversationView = ({ conversationId, initialMessages }: ConversationViewProps) => {

    const queryClient = useQueryClient();
    const { data: conversations } = useConversations();
    const createBranch = useCreateConversationBranch();

    const transport = useMemo(() => new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => ({
            body: {
                id, message: messages.at(-1)
            }
        })
    }), []);

    const { messages, sendMessage, status } = useChat<ChatUIMessage>({
        id: conversationId,
        messages: initialMessages,
        transport,
        onFinish: () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.conversations.all,
            });
        },
        onError: (error) => {
            toast.error(error.message);
        },
    })
    const title =
    conversations?.find((item) => item.id === conversationId)?.title ?? "Chat";

    return (
        <div className="flex h-full min-h-0 flex-1 flex-col">
            <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
                <SidebarTrigger />
                <Separator orientation="vertical" className="hidden h-5 sm:block" />
                <h1 className="min-w-0 flex-1 truncate text-sm font-medium sm:flex-none">{title}</h1>
                <BranchSwitcher conversationId={conversationId} />
            </header>

            {messages.length === 0 ? (
                <ChatEmpty />
            ) : (
                <ChatMessages
                    messages={messages}
                    status={status}
                    onCreateBranch={(messageId) =>
                        createBranch.mutate({
                            conversationId,
                            branchPointMessageId: messageId,
                        })
                    }
                />
            )}

            <ChatComposer
                onSend={(text) => {
                    void sendMessage({ text });
                }}
                isSending={status !== "ready"}
                autoFocus
            />
        </div>
    )
}
