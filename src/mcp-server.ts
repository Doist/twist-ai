// import { TwistApi } from '@doist/twist-sdk'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

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
 * @param _twistApiKey - The API key for the Twist account (unused until tools are added).
 * @returns the MCP server.
 */
function getMcpServer({ twistApiKey: _twistApiKey }: { twistApiKey: string }) {
    const server = new McpServer(
        { name: 'twist-mcp-server', version: '0.1.0' },
        {
            capabilities: {
                tools: { listChanged: true },
            },
            instructions,
        },
    )

    // Tools will be registered here as they are implemented
    // Once tools are added, initialize the Twist API client:
    // const twist = new TwistApi(twistApiKey)
    // Then use it in registerTool calls

    return server
}

export { getMcpServer }
