import { type SearchResultType, getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { GetMentionsOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID to search in.'),
    channelIds: z.array(z.number()).optional().describe('Filter by channel IDs.'),
    authorIds: z.array(z.number()).optional().describe('Filter by author user IDs.'),
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

type GetMentionsStructured = {
    type: 'mentions_results'
    workspaceId: number
    results: Array<{
        id: string
        type: SearchResultType
        content: string
        creatorId: number
        creatorName?: string
        created: string
        threadId?: number
        conversationId?: number
        channelId?: number
        channelName?: string
        workspaceId: number
        url: string
    }>
    totalResults: number
    hasMore: boolean
    cursor?: string
}

const getMentions = {
    name: ToolNames.GET_MENTIONS,
    description:
        'Fetch threads, comments, and messages that mention the current user. Supports filtering by channel, author, and date range. Use this instead of search-content when no keyword query is needed.',
    parameters: ArgsSchema,
    outputSchema: GetMentionsOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { workspaceId, channelIds, authorIds, dateFrom, dateTo, limit, cursor } = args

        const response = await client.search.search({
            workspaceId,
            mentionSelf: true,
            channelIds,
            authorIds,
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

        let userLookup: Record<number, string> = {}
        let channelLookup: Record<number, string> = {}

        if (results.length > 0) {
            const userIds = new Set<number>()
            const channelIds = new Set<number>()
            for (const result of results) {
                userIds.add(result.creatorId)
                if (result.channelId) {
                    channelIds.add(result.channelId)
                }
            }

            const uniqueUserIds = Array.from(userIds)
            const uniqueChannelIds = Array.from(channelIds)
            const batchResponses = await client.batch(
                ...uniqueUserIds.map((id) =>
                    client.workspaceUsers.getUserById({ workspaceId, userId: id }, { batch: true }),
                ),
                ...uniqueChannelIds.map((id) => client.channels.getChannel(id, { batch: true })),
            )

            const userResponses = batchResponses.slice(0, uniqueUserIds.length)
            const channelResponses = batchResponses.slice(uniqueUserIds.length)

            const users = userResponses.map((res) => res.data)
            userLookup = users.reduce(
                (acc, user) => {
                    acc[user.id] = user.name
                    return acc
                },
                {} as Record<number, string>,
            )

            const channels = channelResponses.map((res) => res.data)
            channelLookup = channels.reduce(
                (acc, channel) => {
                    acc[channel.id] = channel.name
                    return acc
                },
                {} as Record<number, string>,
            )
        }

        const lines: string[] = [`# Mentions in Workspace ${workspaceId}`, '']

        lines.push(`**Results Found:** ${results.length}`)
        lines.push(`**More Available:** ${hasMore ? 'Yes' : 'No'}`)
        lines.push('')

        if (results.length === 0) {
            lines.push('_No mentions found_')
        } else {
            lines.push('## Results')
            lines.push('')

            for (const result of results) {
                const date = result.created.split('T')[0]
                const typeLabel = result.type.charAt(0).toUpperCase() + result.type.slice(1)
                const creatorName = userLookup[result.creatorId]

                lines.push(`### ${typeLabel} ${result.id}`)
                lines.push(
                    `**Created:** ${date} | **Creator:** ${creatorName} (${result.creatorId})`,
                )

                if (result.threadId) {
                    lines.push(`**Thread:** ${result.threadId}`)
                }
                if (result.conversationId) {
                    lines.push(`**Conversation:** ${result.conversationId}`)
                }
                if (result.channelId) {
                    const channelName = channelLookup[result.channelId]
                    lines.push(`**Channel:** ${channelName} (${result.channelId})`)
                }

                lines.push('')
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

        const structuredContent: GetMentionsStructured = {
            type: 'mentions_results',
            workspaceId,
            results: results.map((r) => {
                let url: string
                if (r.type === 'thread' && r.threadId !== undefined) {
                    url = getFullTwistURL({
                        workspaceId,
                        threadId: r.threadId,
                        channelId: r.channelId,
                    })
                } else if (
                    r.type === 'comment' &&
                    r.threadId !== undefined &&
                    r.channelId !== undefined
                ) {
                    url = getFullTwistURL({
                        workspaceId,
                        threadId: r.threadId,
                        channelId: r.channelId,
                        commentId: r.id,
                    })
                } else if (r.type === 'conversation' && r.conversationId !== undefined) {
                    url = getFullTwistURL({
                        workspaceId,
                        conversationId: r.conversationId,
                    })
                } else if (r.type === 'message' && r.conversationId !== undefined) {
                    url = getFullTwistURL({
                        workspaceId,
                        conversationId: r.conversationId,
                        messageId: r.id,
                    })
                } else {
                    url = ''
                }
                return {
                    ...r,
                    creatorName: userLookup[r.creatorId],
                    channelName: r.channelId ? channelLookup[r.channelId] : undefined,
                    url,
                }
            }),
            totalResults: results.length,
            hasMore,
            cursor: responseCursor,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof GetMentionsOutputSchema.shape>

export { getMentions, type GetMentionsStructured }
