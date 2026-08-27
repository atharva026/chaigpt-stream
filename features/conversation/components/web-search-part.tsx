"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader } from "@/components/ai-elements/loader";
import type { ChatUIMessage, WebSearchOutput } from "@/features/ai/tools/types";
import { cn } from "@/lib/utils";
import { getToolName, isToolUIPart } from "ai";
import { ChevronDownIcon, GlobeIcon } from "lucide-react";

type MessagePart = ChatUIMessage["parts"][number];
type WebSearchToolPart = Extract<MessagePart, { type: "tool-webSearch" }>;

export function isWebSearchPart(part: MessagePart): part is WebSearchToolPart {
  return isToolUIPart(part) && getToolName(part) === "webSearch";
}

function isFailureOutput(output: unknown): output is Extract<WebSearchOutput, { ok: false }> {
  return (
    typeof output === "object" &&
    output !== null &&
    "ok" in output &&
    (output as WebSearchOutput).ok === false
  );
}

function isSuccessOutput(output: unknown): output is Extract<WebSearchOutput, { ok: true }> {
  return (
    typeof output === "object" &&
    output !== null &&
    "ok" in output &&
    (output as WebSearchOutput).ok === true
  );
}

type WebSearchPartProps = {
  part: WebSearchToolPart;
};

/**
 * Streams web-search tool state: loading, sources, or a recoverable error.
 */
export function WebSearchPart({ part }: WebSearchPartProps) {
  const query =
    part.input && typeof part.input === "object" && "query" in part.input
      ? String(part.input.query ?? "")
      : "";

  const isLoading =
    part.state === "input-streaming" || part.state === "input-available";

  if (isLoading) {
    return (
      <div className="flex w-fit items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Loader size={14} />
        <GlobeIcon className="size-3.5" />
        <span>Searching the web{query ? ` for “${query}”` : "…"}</span>
      </div>
    );
  }

  const failed =
    part.state === "output-error" || isFailureOutput(part.output);
  const errorText = isFailureOutput(part.output)
    ? part.output.error
    : part.state === "output-error"
      ? part.errorText || "Web search failed"
      : null;

  if (failed) {
    return (
      <div className="flex w-full max-w-xl flex-col gap-1 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-destructive">
          <GlobeIcon className="size-3.5" />
          <span className="font-medium">Search failed</span>
          {query ? (
            <Badge variant="outline" className="font-normal">
              {query}
            </Badge>
          ) : null}
        </div>
        {errorText ? (
          <p className="text-muted-foreground">{errorText}</p>
        ) : null}
      </div>
    );
  }

  const output = isSuccessOutput(part.output) ? part.output : null;
  const sources = output?.results ?? [];

  return (
    <Collapsible
      defaultOpen={false}
      className="w-full max-w-xl rounded-xl border border-border/70 bg-muted/30"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
        <GlobeIcon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">Searched the web</span>
        {query ? (
          <span className="truncate text-muted-foreground">for “{query}”</span>
        ) : null}
        <Badge variant="secondary" className="ml-auto shrink-0">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </Badge>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-3 py-2">
        {output?.answer ? (
          <p className="mb-2 text-xs text-muted-foreground">{output.answer}</p>
        ) : null}
        <ul className="flex flex-col gap-1.5">
          {sources.map((source) => (
            <li key={source.url || source.title}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "block rounded-md px-1.5 py-1 text-sm hover:bg-muted",
                  !source.url && "pointer-events-none"
                )}
              >
                <span className="font-medium text-foreground">{source.title}</span>
                {source.url ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {source.url}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
