import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    query: z.string().min(1).describe('The search query string.'),
    workspaceId: z.number().describe('The workspace ID to search in.'),
    channelIds: z.array(z.number()).optional().describe('Filter by channel IDs.'),
    authorIds: z.array(z.number()).optional().describe('Filter by author user IDs.'),
    mentionSelf: z.boolean().optional().describe('Filter by mentions of current user.'),
    dateFrom: z.string().optional().describe('Start date for filtering (YYYY-MM-DD).'),
    dateTo: z.string().optional().describe('End date for filtering (YYYY-MM-DD).'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe('Maximum number of results to return.'),
    cursor: z.string().optional().describe('Cursor for pagination.'),
}

type SearchContentStructured = {
    type: 'search_results'
    query: string
    workspaceId: number
    results: Array<{
        id: string
        type: 'thread' | 'comment' | 'message'
        content: string
        creatorId: number
        created: string
        threadId?: number
        conversationId?: number
        channelId?: number
        workspaceId: number
    }>
    totalResults: number
    hasMore: boolean
    cursor?: string
}

const searchContent = {
    name: ToolNames.SEARCH_CONTENT,
    description:
        'Search across a workspace for threads, comments, and messages. Supports filtering by channels, authors, dates, and mentions.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const {
            query,
            workspaceId,
            channelIds,
            authorIds,
            mentionSelf,
            dateFrom,
            dateTo,
            limit,
            cursor,
        } = args

        // Perform global workspace search
        const response = await client.search.search({
            query,
            workspaceId,
            channelIds,
            authorIds,
            mentionSelf,
            dateFrom,
            dateTo,
            limit,
            cursor,
        })

        const results = response.items.map((r) => ({
            id: r.id,
            type: r.type,
            content: r.snippet,
            creatorId: r.snippetCreatorId,
            created: r.snippetLastUpdated.toISOString(),
            threadId: r.threadId ?? undefined,
            conversationId: r.conversationId ?? undefined,
            channelId: r.channelId ?? undefined,
            workspaceId,
        }))

        const hasMore = response.hasMore
        const responseCursor = response.nextCursorMark

        // Build text content
        const lines: string[] = [`# Search Results for "${query}"`, '']

        lines.push(`**Search Scope:** Workspace ${workspaceId}`)
        lines.push(`**Results Found:** ${results.length}`)
        lines.push(`**More Available:** ${hasMore ? 'Yes' : 'No'}`)
        lines.push('')

        if (results.length === 0) {
            lines.push('_No results found_')
        } else {
            lines.push('## Results')
            lines.push('')

            for (const result of results) {
                const date = result.created.split('T')[0]
                const typeLabel = result.type.charAt(0).toUpperCase() + result.type.slice(1)

                lines.push(`### ${typeLabel} ${result.id}`)
                lines.push(`**Created:** ${date} | **Creator:** ${result.creatorId}`)

                if (result.threadId) {
                    lines.push(`**Thread:** ${result.threadId}`)
                }
                if (result.conversationId) {
                    lines.push(`**Conversation:** ${result.conversationId}`)
                }
                if (result.channelId) {
                    lines.push(`**Channel:** ${result.channelId}`)
                }

                lines.push('')
                // Truncate long content
                const contentPreview =
                    result.content.length > 200
                        ? `${result.content.substring(0, 200)}...`
                        : result.content
                lines.push(contentPreview)
                lines.push('')
            }
        }

        if (hasMore) {
            lines.push('## Next Steps')
            lines.push('')
            lines.push('More results available. Use the cursor to fetch the next page.')
        }

        const structuredContent: SearchContentStructured = {
            type: 'search_results',
            query,
            workspaceId,
            results,
            totalResults: results.length,
            hasMore,
            cursor: responseCursor,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { searchContent, type SearchContentStructured }
