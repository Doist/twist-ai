import { TwistApi } from '@doist/twist-sdk'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTool } from './mcp-helpers.js'
import { away } from './tools/away.js'
import { buildLink } from './tools/build-link.js'
import { createThread } from './tools/create-thread.js'
import { fetchInbox } from './tools/fetch-inbox.js'
import { getMentions } from './tools/get-mentions.js'
import { getUsers } from './tools/get-users.js'
import { getWorkspaces } from './tools/get-workspaces.js'
import { listChannels } from './tools/list-channels.js'
import { listConversations } from './tools/list-conversations.js'
import { loadConversation } from './tools/load-conversation.js'
import { loadThread } from './tools/load-thread.js'
import { markDone } from './tools/mark-done.js'
import { react } from './tools/react.js'
import { reply } from './tools/reply.js'
import { searchContent } from './tools/search-content.js'
import { updateObject } from './tools/update-object.js'
import { userInfo } from './tools/user-info.js'

const instructions = `
## Twist Communication Tools

You have access to comprehensive Twist management tools for team communication and collaboration. Use these tools to help users manage threads, messages, channels, and team interactions effectively.

### Core Capabilities:
- Create and manage conversations and threads
- Send and update messages
- Organize channels and workspaces
- Handle team communication workflows

### Tool Usage Guidelines:

- **fetch-inbox**: Use to fetch inbox threads for a workspace, along with unread conversations and counts. Supports archiveFilter values of active, archived, or all; use all when the user needs both open and done threads. Optionally set onlyUnread to focus on unread items.
- **list-channels**: Use to discover channels in a workspace. Requires a workspace ID. Optionally set includeArchived to true to also list archived channels. Returns channel names, IDs, descriptions, visibility, archive status, and URLs.
- **get-mentions**: Use to fetch threads, comments, and messages that mention the current user. Prefer this over search-content when no keyword query is needed (search-content requires a non-empty query). Supports filtering by channel, author, and date range, and exposes a cursor for pagination.
- **update-object**: Use to edit something you previously sent. Pass targetType ("thread", "comment", or "message"), targetId, and the new content. For threads you may also pass title (and may pass title without content). title is only valid for threads.

### Best Practices:

1. **Communication**: Write clear, professional messages. Consider context and audience.

2. **Organization**: Use appropriate channels and threads for different topics.

3. **Collaboration**: Respect team communication patterns and workflows.

Always provide clear context and maintain professional communication standards.
`

/**
 * Create the MCP server.
 * @param twistApiKey - The API key for the Twist account.
 * @param baseUrl - Optional base URL for the Twist API.
 * @returns the MCP server.
 */
function getMcpServer({ twistApiKey, baseUrl }: { twistApiKey: string; baseUrl?: string }) {
    const server = new McpServer(
        { name: 'twist-mcp-server', version: '0.1.0' },
        {
            capabilities: {
                tools: { listChanged: true },
            },
            instructions,
        },
    )

    const twist = new TwistApi(twistApiKey, { baseUrl })

    // Register tools
    registerTool(userInfo, server, twist)
    registerTool(away, server, twist)
    registerTool(getWorkspaces, server, twist)
    registerTool(getUsers, server, twist)
    registerTool(fetchInbox, server, twist)
    registerTool(loadThread, server, twist)
    registerTool(loadConversation, server, twist)
    registerTool(searchContent, server, twist)
    registerTool(getMentions, server, twist)
    registerTool(buildLink, server, twist)
    registerTool(createThread, server, twist)
    registerTool(updateObject, server, twist)
    registerTool(reply, server, twist)
    registerTool(react, server, twist)
    registerTool(markDone, server, twist)
    registerTool(listChannels, server, twist)
    registerTool(listConversations, server, twist)

    return server
}

export { getMcpServer }
