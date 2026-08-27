import { webSearch } from "./web-search";

/**
 * Tools available to the chat model. Add new tools here to register them.
 */
export const chatTools = {
  webSearch,
};

export type ChatTools = typeof chatTools;

export { webSearch } from "./web-search";
export type {
  ChatUIMessage,
  ChatUITools,
  WebSearchFailure,
  WebSearchHit,
  WebSearchOutput,
  WebSearchSuccess,
} from "./types";
