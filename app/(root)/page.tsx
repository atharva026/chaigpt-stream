"use client";

import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCreateConversation } from "@/features/conversation/hooks/use-conversation";

/**
 * Home page — shows an empty state with controls for creating or finding a chat.
 */
const HomePage = () => {
  const createConversation = useCreateConversation();

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center p-6">
      <Empty>
        <div className="absolute top-4 left-4">
          <SidebarTrigger aria-label="Open previous chats" title="Open previous chats" />
        </div>
        <EmptyHeader>
          <EmptyTitle>Welcome to ChaiGPT</EmptyTitle>
          <EmptyDescription>
            Create a new conversation here or from the sidebar, or open the
            sidebar to visit one of your previous chats.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="flex-row items-center justify-center gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={() => createConversation.mutate()}
            disabled={createConversation.isPending}
          >
            {createConversation.isPending ? "Creating chat..." : "Create new chat"}
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
};

export default HomePage;