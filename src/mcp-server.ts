import { TwistApi } from '@doist/twist-sdk'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTool } from './mcp-helpers.js'
import { fetchInbox } from './tools/fetch-inbox.js'
import { getUsers } from './tools/get-users.js'
import { getWorkspaces } from './tools/get-workspaces.js'
import { loadConversation } from './tools/load-conversation.js'
import { loadThread } from './tools/load-thread.js'
import { markDone } from './tools/mark-done.js'
import { react } from './tools/react.js'
import { reply } from './tools/reply.js'
import { searchContent } from './tools/search-content.js'
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

(Tools will be added here as they are implemented)

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
    registerTool(getWorkspaces, server, twist)
    registerTool(getUsers, server, twist)
    registerTool(fetchInbox, server, twist)
    registerTool(loadThread, server, twist)
    registerTool(loadConversation, server, twist)
    registerTool(searchContent, server, twist)
    registerTool(reply, server, twist)
    registerTool(react, server, twist)
    registerTool(markDone, server, twist)

    return server
}

export { getMcpServer }
