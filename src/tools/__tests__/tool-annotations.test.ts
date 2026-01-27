import { jest } from '@jest/globals'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getMcpServer } from '../../mcp-server.js'
import { ToolNames } from '../../utils/tool-names.js'

type ToolExpectation = {
    name: string
    title: string
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
}

const TOOL_EXPECTATIONS: ToolExpectation[] = [
    {
        name: ToolNames.USER_INFO,
        title: 'Twist: User Info',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.FETCH_INBOX,
        title: 'Twist: Fetch Inbox',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.LOAD_THREAD,
        title: 'Twist: Load Thread',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.LOAD_CONVERSATION,
        title: 'Twist: Load Conversation',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.SEARCH_CONTENT,
        title: 'Twist: Search Content',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.GET_USERS,
        title: 'Twist: Get Users',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.GET_WORKSPACES,
        title: 'Twist: Get Workspaces',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.BUILD_LINK,
        title: 'Twist: Build Link',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
    },
    {
        name: ToolNames.REPLY,
        title: 'Twist: Reply',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
    },
    {
        name: ToolNames.REACT,
        title: 'Twist: React',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
    },
    {
        name: ToolNames.MARK_DONE,
        title: 'Twist: Mark Done',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
    },
]

describe('Tool annotations', () => {
    const registered: Map<string, { annotations?: unknown }> = new Map()

    beforeAll(() => {
        const registerToolSpy = jest.spyOn(McpServer.prototype, 'registerTool')
        getMcpServer({ twistApiKey: 'test-token' })

        const calls = registerToolSpy.mock.calls as unknown as unknown[][]
        for (const [name, toolSpec] of calls) {
            if (typeof name !== 'string') continue
            if (!toolSpec || typeof toolSpec !== 'object') continue

            registered.set(name, toolSpec as { annotations?: unknown })
        }

        registerToolSpy.mockRestore()
    })

    it('should cover all tools', () => {
        expect(Array.from(registered.keys()).sort()).toEqual(
            TOOL_EXPECTATIONS.map((t) => t.name).sort(),
        )
    })

    describe.each(TOOL_EXPECTATIONS)('$name', (toolExpectation) => {
        it('should define required MCP ToolAnnotations hints', () => {
            const toolSpec = registered.get(toolExpectation.name)
            expect(toolSpec).toBeDefined()

            const annotations = toolSpec?.annotations as Record<string, unknown> | undefined
            expect(annotations).toBeDefined()

            expect(annotations).toMatchObject({
                title: toolExpectation.title,
                openWorldHint: false,
            })
        })

        it('should have expected hint values per tool', () => {
            const toolSpec = registered.get(toolExpectation.name)
            expect(toolSpec).toBeDefined()

            const annotations = toolSpec?.annotations as Record<string, unknown> | undefined
            expect(annotations).toBeDefined()

            expect(annotations).toMatchObject({
                readOnlyHint: toolExpectation.readOnlyHint,
                destructiveHint: toolExpectation.destructiveHint,
                idempotentHint: toolExpectation.idempotentHint,
            })
        })
    })
})
