import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    threadId: z.number().describe('The thread ID to load.'),
    newerThanDate: z
        .string()
        .optional()
        .describe('Get comments newer than this date (YYYY-MM-DD format).'),
    olderThanDate: z
        .string()
        .optional()
        .describe('Get comments older than this date (YYYY-MM-DD format).'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .describe('Maximum number of comments to return.'),
    includeParticipants: z
        .boolean()
        .default(true)
        .describe('Include participant user IDs in the response.'),
}

type LoadThreadStructured = {
    type: 'thread_data'
    thread: {
        id: number
        title: string
        content: string
        channelId: number
        workspaceId: number
        creatorId: number
        postedTs: number
        commentCount: number
        isArchived: boolean
        inInbox: boolean
        participants?: number[]
    }
    comments: Array<{
        id: number
        content: string
        creatorId: number
        threadId: number
        postedTs: number
    }>
    totalComments: number
}

const loadThread = {
    name: ToolNames.LOAD_THREAD,
    description:
        'Load a thread with its metadata and comments. Supports filtering by timestamp and pagination.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { threadId, newerThanDate, limit, includeParticipants } = args

        // Fetch thread metadata
        const thread = await client.threads.getThread(threadId)

        // Fetch comments
        const comments = await client.comments.getComments({
            threadId,
            from: newerThanDate ? new Date(newerThanDate) : undefined,
            limit,
        })

        // Build text content
        const lines: string[] = [
            `# Thread: ${thread.title}`,
            '',
            `**Thread ID:** ${thread.id}`,
            `**Channel ID:** ${thread.channelId}`,
            `**Workspace ID:** ${thread.workspaceId}`,
            `**Creator:** ${thread.creator}`,
            `**Posted:** ${new Date(thread.postedTs * 1000).toISOString()}`,
            `**Comments:** ${thread.commentCount}`,
            `**Archived:** ${thread.isArchived ? 'Yes' : 'No'}`,
            `**In Inbox:** ${thread.inInbox ? 'Yes' : 'No'}`,
            '',
            '## Content',
            '',
            thread.content,
            '',
            `## Comments (${comments.length})`,
            '',
        ]

        for (const comment of comments) {
            const commentDate = new Date(comment.postedTs * 1000).toISOString()
            lines.push(`### Comment ${comment.id}`)
            lines.push(`**Creator:** ${comment.creator} | **Posted:** ${commentDate}`)
            lines.push('')
            lines.push(comment.content)
            lines.push('')
        }

        if (includeParticipants && thread.participants) {
            lines.push('## Participants')
            lines.push('')
            lines.push(thread.participants.join(', '))
        }

        const structuredContent: LoadThreadStructured = {
            type: 'thread_data',
            thread: {
                id: thread.id,
                title: thread.title,
                content: thread.content,
                channelId: thread.channelId,
                workspaceId: thread.workspaceId,
                creatorId: thread.creator,
                postedTs: thread.postedTs,
                commentCount: thread.commentCount,
                isArchived: thread.isArchived,
                inInbox: thread.inInbox ?? false,
                participants: includeParticipants ? thread.participants : undefined,
            },
            comments: comments.map((c) => ({
                id: c.id,
                content: c.content,
                creatorId: c.creator,
                threadId: c.threadId,
                postedTs: c.postedTs,
            })),
            totalComments: thread.commentCount,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { loadThread, type LoadThreadStructured }
