"use client";

import { isTextUIPart, type ChatStatus } from "ai";
import type { ChatUIMessage } from "@/features/ai/tools/types";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Loader } from "@/components/ai-elements/loader";
import {
  isWebSearchPart,
  WebSearchPart,
} from "@/features/conversation/components/web-search-part";

type ChatMessagesProps = {
  messages: ChatUIMessage[];
  status: ChatStatus;
};

/**
 * Renders the conversation message list with markdown responses, tool cards,
 * and a loading indicator while waiting for the first assistant token.
 */
export function ChatMessages({ messages, status }: ChatMessagesProps) {
  const isWaiting =
    status === "submitted" && messages.at(-1)?.role === "user";

  return (
    <Conversation>
      <ConversationContent className="py-8">
        {messages.map((message) => (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {message.parts.map((part, index) => {
                if (isTextUIPart(part)) {
                  if (!part.text) return null;

                  return (
                    <MessageResponse
                      key={`${message.id}-text-${index}`}
                      isAnimating={
                        status === "streaming" &&
                        message.id === messages.at(-1)?.id
                      }
                    >
                      {part.text}
                    </MessageResponse>
                  );
                }

                if (isWebSearchPart(part)) {
                  return (
                    <WebSearchPart
                      key={`${message.id}-${part.toolCallId}`}
                      part={part}
                    />
                  );
                }

                return null;
              })}
            </MessageContent>
          </Message>
        ))}

        {isWaiting ? (
          <Message from="assistant">
            <MessageContent>
              <Loader />
            </MessageContent>
          </Message>
        ) : null}
      </ConversationContent>
    </Conversation>
  );
}
