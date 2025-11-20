import { jest } from '@jest/globals'
import { getMcpServer } from '../../mcp-server.js'
import { getMcpAnnotations, type ToolMutability } from '../../utils/tool-mutability.js'
import { ToolNames } from '../../utils/tool-names.js'

// Extract the union type of all tool name values
type ToolName = typeof ToolNames[keyof typeof ToolNames]

// Tool mutability categorization with full type safety.
// TypeScript will ensure all tool names are covered and no invalid names are added.
const TOOL_MUTABILITY_CATEGORIZATION: Record<ToolName, ToolMutability> = {
    user_info: 'readonly',
    fetch_inbox: 'readonly',
    load_thread: 'readonly',
    load_conversation: 'readonly',
    search_content: 'readonly',
    get_users: 'readonly',
    get_workspaces: 'readonly',
    build_link: 'readonly',
    reply: 'additive',
    react: 'mutating', // Can add OR remove reactions (destroy existing data)
    mark_done: 'mutating',
} as const satisfies Record<ToolName, ToolMutability>

describe('Tool annotations', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should have all tools categorized', () => {
        // Ensure all tools from ToolNames are categorized
        expect(Object.values(ToolNames).sort()).toEqual(
            Object.keys(TOOL_MUTABILITY_CATEGORIZATION).sort(),
        )
    })

    it('should register tools with correct mutability', async () => {
        // Spy on registerTool to capture registered tools
        const mcpHelpersModule = await import('../../mcp-helpers.js')
        const registerSpy = jest.spyOn(mcpHelpersModule, 'registerTool')

        // Initialize MCP server (triggers registerTool for all tools)
        const server = getMcpServer({ twistApiKey: 'test-token' })
        expect(server).toBeDefined()

        // Verify each tool has mutability set correctly
        for (const call of registerSpy.mock.calls) {
            const tool = call[0] // First argument is the tool object
            const toolName = tool.name as ToolName
            const expectedMutability = TOOL_MUTABILITY_CATEGORIZATION[toolName]

            // Verify mutability is set on tool
            expect(tool.mutability).toBeDefined()
            expect(tool.mutability).toBe(expectedMutability)
        }

        registerSpy.mockRestore()
    })

    it('should convert mutability to correct MCP annotations', () => {
        // Test readonly tools
        expect(getMcpAnnotations('readonly')).toEqual({
            readOnlyHint: true,
            destructiveHint: false,
        })

        // Test additive tools
        expect(getMcpAnnotations('additive')).toEqual({
            readOnlyHint: false,
            destructiveHint: false,
        })

        // Test mutating tools
        expect(getMcpAnnotations('mutating')).toEqual({
            readOnlyHint: false,
            destructiveHint: true,
        })
    })

    it('should have appropriate categorization distribution', () => {
        const categorizations = Object.values(TOOL_MUTABILITY_CATEGORIZATION)
        const readonly = categorizations.filter(m => m === 'readonly').length
        const additive = categorizations.filter(m => m === 'additive').length
        const mutating = categorizations.filter(m => m === 'mutating').length

        // Verify we have the expected distribution
        expect(readonly).toBe(8) // user_info, fetch_inbox, load_thread, load_conversation, search_content, get_users, get_workspaces, build_link
        expect(additive).toBe(1) // reply
        expect(mutating).toBe(2) // react, mark_done

        // Total should match all tools
        expect(readonly + additive + mutating).toBe(Object.keys(TOOL_MUTABILITY_CATEGORIZATION).length)
    })
})