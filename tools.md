# Tool calling (Tavily web search)

This document covers the latest tool-calling work: a Tavily web search tool the chat model can invoke on its own, streamed into the UI, and persisted with the rest of the conversation.

## Setup

1. Create an API key at [Tavily](https://tavily.com).
2. Add it to the environment:

```bash
TAVILY_API_KEY=tvly-...
```

Gemini (or the conversation's `model`) still needs its existing provider key, typically `GOOGLE_GENERATIVE_AI_API_KEY`.

Installs used by this feature: `@tavily/core` and `zod`.

## How the model decides to search

Tools are registered in [`features/ai/tools/index.ts`](features/ai/tools/index.ts) and passed to `streamText` in [`app/api/chat/route.ts`](app/api/chat/route.ts).

- `toolChoice` is left at the default (`auto`), so Gemini chooses when to call `webSearch`.
- The system prompt tells the model to search for current events, live facts, or anything it is unsure about, then write a final answer with real source URLs from the tool output.
- `stopWhen: stepCountIs(5)` keeps the loop going after a tool result so the model can continue generating the user-facing answer. Without this, the stream often stops on the tool call.

## Tool shape

[`features/ai/tools/web-search.ts`](features/ai/tools/web-search.ts) defines `webSearch`:

- **Input:** `{ query: string }`
- **Output (success):** `{ ok: true, query, answer?, results: [{ title, url, content }] }` (max 5 results)
- **Output (failure):** `{ ok: false, query, error }` — Tavily errors are caught so the model can still reply

## Streaming

`useChat` already consumes the AI SDK UI message stream. Tool parts arrive as `tool-webSearch` with states:

| State | UI |
| --- | --- |
| `input-streaming` / `input-available` | “Searching the web…” |
| `output-available` + `ok: true` | Collapsible “Searched the web” with sources |
| `output-error` or `ok: false` | Search failed card |

The composer stays disabled while `status !== "ready"`.

## Persistence

No schema change. [`Message.parts`](prisma/schema.prisma) stores the full AI SDK parts array (text + tool input/output). [`features/ai/actions/chat-store.ts`](features/ai/actions/chat-store.ts) maps roles as:

- `user` ↔ `USER`
- `assistant` ↔ `ASSISTANT`
- stored `TOOL` rows load as `assistant` (UI messages have no `tool` role; tool calls live on assistant parts)

`status` is `ERROR` only when a tool part is `output-error` and the assistant wrote no text.

## Adding another tool

1. Create a `tool()` in `features/ai/tools/`.
2. Add it to `chatTools` in `features/ai/tools/index.ts`.
3. Render its `tool-<name>` parts in [`chat-messages.tsx`](features/conversation/components/chat-messages.tsx).
