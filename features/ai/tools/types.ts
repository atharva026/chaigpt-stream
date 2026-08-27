import type { UIMessage } from "ai";

export type WebSearchHit = {
  title: string;
  url: string;
  content: string;
};

export type WebSearchSuccess = {
  ok: true;
  query: string;
  answer?: string;
  results: WebSearchHit[];
};

export type WebSearchFailure = {
  ok: false;
  query: string;
  error: string;
};

export type WebSearchOutput = WebSearchSuccess | WebSearchFailure;

export type ChatUITools = {
  webSearch: {
    input: { query: string };
    output: WebSearchOutput;
  };
};

export type ChatUIMessage = UIMessage<unknown, never, ChatUITools>;
