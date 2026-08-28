"use client";

import { GitBranchIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConversationBranches, useDeleteConversationBranch, useUpdateConversation } from "../hooks/use-conversation";
import type { BranchListItem } from "../actions/conversation-actions";

export function BranchSwitcher({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { data: branches, isLoading } = useConversationBranches(conversationId);
  const updateConversation = useUpdateConversation();
  const deleteBranch = useDeleteConversationBranch(conversationId);
  const current = branches?.find((branch) => branch.id === conversationId);

  function renameBranch(branch: BranchListItem) {
    const next = window.prompt("Rename branch", branch.title);
    if (next?.trim() && next.trim() !== branch.title) {
      updateConversation.mutate({ id: branch.id, title: next });
    }
  }

  function removeBranch() {
    if (current?.parentConversationId && window.confirm("Delete this branch and all of its descendants?")) {
      deleteBranch.mutate();
    }
  }

  if (isLoading || !branches || branches.length < 2) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <GitBranchIcon className="size-4 shrink-0 text-muted-foreground" />
      <Select value={conversationId} onValueChange={(value) => value && router.push(`/c/${value}`)}>
        <SelectTrigger size="sm" className="min-w-0 flex-1 border-0 bg-transparent">
          <SelectValue className="min-w-0 truncate" placeholder="Select branch">
            {current?.title}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon-sm" type="button" onClick={() => current && renameBranch(current)} disabled={updateConversation.isPending}>
        <PencilIcon />
        <span className="sr-only">Rename branch</span>
      </Button>
      <Button variant="ghost" size="icon-sm" type="button" onClick={removeBranch} disabled={!current?.parentConversationId || deleteBranch.isPending}>
        <Trash2Icon />
        <span className="sr-only">Delete branch</span>
      </Button>
    </div>
  );
}
