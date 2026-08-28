# ChaiGPT

ChaiGPT is a full-stack AI chat application built with Next.js. Users can sign in, create and manage conversations, stream Gemini responses, search the live web through an AI-controlled Tavily tool, and create independent conversation branches.

## Features

- Clerk authentication with protected application and API routes.
- Streaming chat responses powered by the Vercel AI SDK and Google Gemini.
- Persistent users, conversations, messages, message parts, and tool output in PostgreSQL through Prisma.
- Conversation titles, pinning, archiving, deletion, and branch navigation.
- Optional live web search with up to five Tavily results per search.
- Markdown, code, math, Mermaid, attachments, responsive layout, and light/dark themes.

## Tech Stack

- Next.js 16 App Router, React 19, and TypeScript.
- Prisma 7 with the PostgreSQL adapter.
- Clerk for authentication.
- Vercel AI SDK with `@ai-sdk/google` for Gemini.
- Tavily for live web search.
- Tailwind CSS 4 and the local shadcn-style UI components.

## Prerequisites

- Node.js 20 or newer.
- npm, or Bun if you prefer the checked-in `bun.lock` file.
- A PostgreSQL database.
- A Clerk application.
- A Google AI Studio API key for Gemini.
- A Tavily API key if web search is required.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```
2. Create the local environment file:

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux, use `cp .env.example .env` instead.
3. Fill in the values in `.env` using the table below.

   See the [Environment Variables](#environment-variables) section for details.
4. Generate the Prisma client and apply the development migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:db:migration:apply
   ```
5. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). The sign-in page is available at `/sign-in`; all other application routes require an authenticated Clerk session.

### Environment Variables

| Variable                                            | Required    | Description                                                                                                                |
| --------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                    | Yes         | PostgreSQL connection string used by Prisma and the PostgreSQL adapter.                                                    |
| `GOOGLE_GENERATIVE_AI_API_KEY`                    | Yes         | Google AI Studio key used by the default Gemini model.                                                                     |
| `CLERK_SECRET_KEY`                                | Yes         | Server-side secret key from the Clerk dashboard.                                                                           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Yes         | Client-side publishable key from the Clerk dashboard.                                                                      |
| `TAVILY_API_KEY`                                  | Recommended | Tavily key used by the`webSearch` tool. Without it, web-search tool calls return an error that the assistant can report. |
| `NODE_ENV`                                        | Yes         | Usually`development` locally and `production` in deployment.                                                           |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | No          | Sign-in route; defaults to`/sign-in` in `.env.example`.                                                                |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | No          | Sign-up route; defaults to`/sign-up` in `.env.example`.                                                                |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | No          | Post-sign-in fallback route; defaults to`/`.                                                                             |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | No          | Post-sign-up fallback route; defaults to`/`.                                                                             |

Do not commit `.env` or any file containing real credentials. The committed `.env.example` is the complete variable template.

## Database Commands

```bash
# Format the Prisma schema
npm run prisma:format

# Regenerate the typed Prisma client
npm run prisma:generate

# Push the schema without creating a migration (local prototyping)
npm run prisma:db:push

# Create a development migration interactively
npm run prisma:create:migration

# Apply pending development migrations
npm run prisma:db:migration:apply

# Apply committed migrations in production
npm run prisma:migrate:prod

# Open Prisma Studio
npm run prisma:studio

# Reset the database and rerun migrations (destructive)
npm run prisma:migrate:reset
```

The normal first-time setup is `prisma:generate` followed by `prisma:db:migration:apply`. The convenience command `npm run dev:full` runs both steps and then starts Next.js.

## Development Commands

```bash
npm run dev       # Start the Next.js development server
npm run dev:full  # Generate Prisma, apply migrations, and start the server
npm run lint      # Run ESLint
npm run build     # Generate Prisma and create a production build
npm run start     # Serve the production build
```

## Application Flow

The authenticated user is synchronized from Clerk into the local `User` table. Conversations and messages are scoped to that user. `POST /api/chat` verifies authentication and conversation ownership, saves the user message, streams the selected Gemini model, persists the final assistant messages, and can execute the `webSearch` tool when current information is needed.

The default model is `gemini-3.5-flash-lite`. A conversation may store a model override in the `Conversation.model` field. Web-search results and tool calls are stored in `Message.parts` so they can be rendered again when a conversation is reloaded.

Conversation branches are child `Conversation` records linked with `parentConversationId` and `branchPointMessageId`. See [chat-branching.md](chat-branching.md) for the branching design and persistence details. See [tools.md](tools.md) for the web-search tool contract and extension instructions.

## Project Structure

```text
app/                    Next.js routes, layouts, and the chat API
components/             Shared UI and AI message components
features/ai/            AI models, tools, and message persistence
features/auth/          Clerk-to-Prisma user synchronization and guards
features/conversation/  Conversation actions, hooks, and chat UI
features/messages/      Message queries and actions
lib/                    Shared utilities and the generated Prisma client
prisma/                 Prisma schema and database migrations
proxy.ts                Clerk middleware protecting application routes
```

## Troubleshooting

- `DATABASE_URL is not set`: create `.env` and provide a valid PostgreSQL URL.
- Clerk redirects or auth errors: verify both Clerk keys and that the sign-in/sign-up URLs match the routes in this project.
- Gemini errors: verify `GOOGLE_GENERATIVE_AI_API_KEY` and that the configured model is available to the key.
- Web search failures: verify `TAVILY_API_KEY`; chat can still answer without successful search results.
- Prisma client errors after schema changes: run `npm run prisma:generate`, then apply the appropriate migration.

## Useful Documentation

- [Next.js documentation](https://nextjs.org/docs)
- [Clerk Next.js documentation](https://clerk.com/docs/quickstarts/nextjs)
- [Prisma documentation](https://www.prisma.io/docs)
- [Vercel AI SDK documentation](https://ai-sdk.dev/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Tavily](https://tavily.com/)
