# Chat branching

Chat branching lets you create alternate conversation paths from any message. Think of it like creating a checkpoint at a message, then exploring different directions from there while keeping the original conversation history intact.

## How it works

Each branch is a separate conversation that links back to its parent:
- A branch remembers its **parent conversation** and which **message it branched from**
- The branch only stores new messages sent *after* the branch point
- The shared history stays in one place (not duplicated)

## What happens at runtime

- **Loading messages**: When you open a conversation, it loads all messages from the root conversation up to the branch point, then adds the current branch's messages
- **Sending messages**: New messages only go into the active conversation, not the parent
- **Creating a branch**: The system checks that you own the conversation and the branch point is valid
- **Switching branches**: The header shows all branches of the root conversation so you can jump between them
- **Deleting a branch**: Removes the branch and all its child branches with it. Original root conversations stay safe
