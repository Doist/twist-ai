import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { SearchScopeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    query: z.string().min(1).describe('The search query string.'),
    scope: SearchScopeSchema.default('workspace').describe(
        'Search scope: workspace (global), thread (comments), or conversation (messages).',
    ),
    objectId: z
        .number()
        .describe(
            'The ID of the workspace, thread, or conversation to search in (based on scope parameter).',
        ),
    channelIds: z
        .array(z.number())
        .optional()
        .describe('Filter by channel IDs (only for workspace scope).'),
    authorIds: z
        .array(z.number())
        .optional()
        .describe('Filter by author user IDs (only for workspace scope).'),
    mentionSelf: z
        .boolean()
        .optional()
        .describe('Filter by mentions of current user (only for workspace scope).'),
    dateFrom: z
        .string()
        .optional()
        .describe('Start date for filtering (YYYY-MM-DD, only for workspace scope).'),
    dateTo: z
        .string()
        .optional()
        .describe('End date for filtering (YYYY-MM-DD, only for workspace scope).'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .describe('Maximum number of results to return.'),
    cursor: z.string().optional().describe('Cursor for pagination.'),
}

type SearchContentStructured = {
    type: 'search_results'
    query: string
    searchScope: 'global' | 'thread' | 'conversation'
    scopeId?: number
    results: Array<{
        id: number
        type: 'thread' | 'comment' | 'message'
        content: string
        creatorId: number
        createdTs: number
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
        'Search across workspaces, threads, or conversations. Use scope parameter to specify search type: workspace (global), thread (comments only), or conversation (messages only). Supports filtering by channels, authors, dates, and mentions for workspace scope.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const {
            query,
            scope,
            objectId,
            channelIds,
            authorIds,
            mentionSelf,
            dateFrom,
            dateTo,
            limit,
            cursor,
        } = args

        let searchScope: 'global' | 'thread' | 'conversation'
        let results: Array<{
            id: number
            type: 'thread' | 'comment' | 'message'
            content: string
            creatorId: number
            createdTs: number
            threadId?: number
            conversationId?: number
            channelId?: number
            workspaceId: number
        }>
        let hasMore: boolean
        let responseCursor: string | undefined

        // Call appropriate endpoint based on scope
        if (scope === 'thread') {
            searchScope = 'thread'
            const response = await client.search.searchComments({
                query,
                threadId: objectId,
                limit,
                cursor,
            })
            results = response.results
            hasMore = response.hasMore
            responseCursor = response.cursor
        } else if (scope === 'conversation') {
            searchScope = 'conversation'
            const response = await client.search.searchMessages({
                query,
                conversationId: objectId,
                limit,
                cursor,
            })
            results = response.results
            hasMore = response.hasMore
            responseCursor = response.cursor
        } else {
            // workspace scope - global search
            searchScope = 'global'
            const response = await client.search.search({
                query,
                workspaceId: objectId,
                channelIds,
                authorIds,
                mentionSelf,
                dateFrom,
                dateTo,
                limit,
                cursor,
            })
            results = response.results
            hasMore = response.hasMore
            responseCursor = response.cursor
        }

        // Build text content
        const lines: string[] = [`# Search Results for "${query}"`, '']

        if (searchScope === 'thread') {
            lines.push(`**Search Scope:** Thread ${objectId}`)
        } else if (searchScope === 'conversation') {
            lines.push(`**Search Scope:** Conversation ${objectId}`)
        } else {
            lines.push(`**Search Scope:** Workspace ${objectId}`)
        }

        lines.push(`**Results Found:** ${results.length}`)
        lines.push(`**More Available:** ${hasMore ? 'Yes' : 'No'}`)
        lines.push('')

        if (results.length === 0) {
            lines.push('_No results found_')
        } else {
            lines.push('## Results')
            lines.push('')

            for (const result of results) {
                const date = new Date(result.createdTs * 1000).toISOString().split('T')[0]
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
            searchScope,
            scopeId: objectId,
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
