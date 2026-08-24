import type { TwistApi } from '@doist/twist-sdk'
import type {
    CallToolResult,
    McpServer,
    ToolAnnotations,
    ToolCallback,
} from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { TwistTool } from './twist-tool.js'
import { formatToolTitle } from './utils/required-tool-annotations.js'
import { removeNullFields } from './utils/sanitize-data.js'

/**
 * Whether to return the structured content directly, vs. in the `content` part of the output.
 *
 * The `structuredContent` part of the output is relatively new in the spec, and it's not yet
 * supported by all clients. This flag controls whether we return the structured content using this
 * new feature of the MCP protocol or not.
 *
 * If `false`, the `structuredContent` will be returned as stringified JSON in one of the `content`
 * parts.
 *
 * Eventually we should be able to remove this, and change the code to always work with the
 * structured content returned directly, once most or all MCP clients support it.
 */
const USE_STRUCTURED_CONTENT =
    process.env.USE_STRUCTURED_CONTENT === 'true' || process.env.NODE_ENV === 'test'

/**
 * Get the output payload for a tool, in the correct format expected by MCP client apps.
 *
 * @param textContent - The text content to return.
 * @param structuredContent - The structured content to return.
 * @returns The output payload.
 * @see USE_STRUCTURED_CONTENT - Whether to use the structured content feature of the MCP protocol.
 */
function getToolOutput<StructuredContent extends Record<string, unknown>>({
    textContent,
    structuredContent,
}: {
    textContent: string
    structuredContent: StructuredContent
}): CallToolResult {
    // Remove null fields from structured content before returning
    const sanitizedContent = removeNullFields(structuredContent)

    // Always include structuredContent when available since all tools have outputSchema
    const result: CallToolResult = {
        content: [{ type: 'text' as const, text: textContent }],
        structuredContent: sanitizedContent,
    }

    // Legacy support: also include JSON in content when USE_STRUCTURED_CONTENT is false
    if (!USE_STRUCTURED_CONTENT) {
        const json = JSON.stringify(sanitizedContent)
        result.content.push({
            type: 'text',
            text: json,
        })
    }

    return result
}

function getErrorOutput(error: string): CallToolResult {
    return {
        content: [{ type: 'text' as const, text: error }],
        isError: true,
    }
}

/**
 * Build MCP ToolAnnotations for a tool.
 * @param tool - The tool information used for annotation generation.
 * @returns MCP annotations.
 */
function getMcpAnnotations(tool: { name: string; annotations: ToolAnnotations }): ToolAnnotations {
    const defaultAnnotations: ToolAnnotations = {
        title: formatToolTitle(tool.name),
        openWorldHint: false,
    }

    return { ...defaultAnnotations, ...tool.annotations }
}

/**
 * Register a Twist tool in an MCP server.
 * @param tool - The tool to register.
 * @param server - The server to register the tool on.
 * @param client - The Twist API client to use to execute the tool.
 */
function registerTool<Params extends z.ZodRawShape, Output extends z.ZodRawShape = z.ZodRawShape>(
    tool: TwistTool<Params, Output>,
    server: McpServer,
    client: TwistApi,
) {
    const inputSchema = z.object(tool.parameters)
    const outputSchema = z.object(tool.outputSchema)

    const cb: ToolCallback<typeof inputSchema> = async (args, _context) => {
        try {
            const result = await tool.execute(args, client)
            return result
        } catch (error) {
            console.error(`Error executing tool ${tool.name}:`, {
                args,
                error,
            })
            const message = error instanceof Error ? error.message : 'An unknown error occurred'
            return getErrorOutput(message)
        }
    }

    server.registerTool(
        tool.name,
        {
            description: tool.description,
            inputSchema,
            outputSchema,
            annotations: getMcpAnnotations(tool),
        },
        cb,
    )
}

export { registerTool, getToolOutput }
