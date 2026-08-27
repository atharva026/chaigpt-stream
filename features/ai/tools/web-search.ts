import { tavily } from "@tavily/core";
import { tool } from "ai";
import { z } from "zod";

import type { WebSearchHit, WebSearchOutput } from "./types";

const MAX_RESULTS = 5;
const SEARCH_TIMEOUT_MS = 12_000;

function getTavilyClient() {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  return tavily({ apiKey });
}

/**
 * Runs a Tavily web search and returns a compact, model-friendly payload.
 */
export async function tavilySearch(query: string): Promise<WebSearchOutput> {
  try {
    const client = getTavilyClient();
    const response = await client.search(query, {
      maxResults: MAX_RESULTS,
      timeout: SEARCH_TIMEOUT_MS,
    });

    const results: WebSearchHit[] = (response.results ?? [])
      .slice(0, MAX_RESULTS)
      .map((item) => ({
        title: item.title ?? "Untitled",
        url: item.url ?? "",
        content: item.content ?? "",
      }));

    return {
      ok: true,
      query,
      answer: response.answer || undefined,
      results,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Web search failed. Try again later.";

    return {
      ok: false,
      query,
      error: message,
    };
  }
}

/**
 * AI SDK tool the model can call when it needs live web information.
 */
export const webSearch = tool({
  description:
    "Search the live web for current facts, news, prices, or sources. Use this when the answer depends on up-to-date information or you are unsure.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search query to send to the web"),
  }),
  execute: async ({ query }) => tavilySearch(query),
});
