import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { LoadThreadOutputSchema } from '../utils/output-schemas.js'
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
        .optional()
        .default(50)
        .describe('Maximum number of comments to return.'),
    includeParticipants: z
        .boolean()
        .optional()
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
        channelName?: string
        workspaceId: number
        creator: number
        creatorName?: string
        posted: string
        commentCount: number
        isArchived: boolean
        inInbox: boolean
        participants?: number[]
        participantNames?: string[]
        threadUrl: string
    }
    comments: Array<{
        id: number
        content: string
        creator: number
        creatorName?: string
        threadId: number
        posted: string
        commentUrl: string
    }>
    totalComments: number
}

const loadThread = {
    name: ToolNames.LOAD_THREAD,
    description:
        'Load a thread with its metadata and comments. Supports filtering by timestamp and pagination.',
    parameters: ArgsSchema,
    outputSchema: LoadThreadOutputSchema.shape,
    async execute(args, client) {
        const { threadId, newerThanDate, limit, includeParticipants } = args

        // Fetch thread metadata and comments in parallel using batch
        const [threadResponse, commentsResponse] = await client.batch(
            client.threads.getThread(threadId, { batch: true }),
            client.comments.getComments(
                {
                    threadId,
                    from: newerThanDate ? new Date(newerThanDate) : undefined,
                    limit,
                },
                { batch: true },
            ),
        )

        const thread = threadResponse.data
        const comments = commentsResponse.data

        // Collect all unique user IDs
        const userIds = new Set<number>([thread.creator])
        for (const comment of comments) {
            userIds.add(comment.creator)
        }
        if (includeParticipants && thread.participants) {
            for (const participantId of thread.participants) {
                userIds.add(participantId)
            }
        }

        // Fetch channel and all user info in a single batch call
        const uniqueUserIds = Array.from(userIds)
        const [channelResponse, ...userResponses] = await client.batch(
            client.channels.getChannel(thread.channelId, { batch: true }),
            ...uniqueUserIds.map((id) =>
                client.workspaceUsers.getUserById(
                    { workspaceId: thread.workspaceId, userId: id },
                    { batch: true },
                ),
            ),
        )

        const channel = channelResponse.data
        const users = userResponses.map((res) => res.data)
        const userLookup = users.reduce(
            (acc, user) => {
                acc[user.id] = user.name
                return acc
            },
            {} as Record<number, string>,
        )

        // Build text content
        const creatorName = userLookup[thread.creator]
        const lines: string[] = [
            `# Thread: ${thread.title}`,
            '',
            `**Thread ID:** ${thread.id}`,
            `**Channel:** ${channel.name}`,
            `**Workspace ID:** ${thread.workspaceId}`,
            `**Creator:** ${creatorName} (${thread.creator})`,
            `**Posted:** ${thread.posted.toISOString()}`,
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
            const commentDate = comment.posted.toISOString()
            const commentCreatorName = userLookup[comment.creator]
            lines.push(`### Comment ${comment.id}`)
            lines.push(
                `**Creator:** ${commentCreatorName} (${comment.creator}) | **Posted:** ${commentDate}`,
            )
            lines.push('')
            lines.push(comment.content)
            lines.push('')
        }

        if (includeParticipants && thread.participants) {
            lines.push('## Participants')
            lines.push('')
            const participantList = thread.participants
                .map((id) => `${userLookup[id]} (${id})`)
                .join(', ')
            lines.push(participantList)
        }

        const structuredContent: LoadThreadStructured = {
            type: 'thread_data',
            thread: {
                id: thread.id,
                title: thread.title,
                content: thread.content,
                channelId: thread.channelId,
                channelName: channel.name,
                workspaceId: thread.workspaceId,
                creator: thread.creator,
                creatorName,
                posted: thread.posted.toISOString(),
                commentCount: thread.commentCount,
                isArchived: thread.isArchived,
                inInbox: thread.inInbox ?? false,
                participants: includeParticipants ? (thread.participants ?? undefined) : undefined,
                participantNames:
                    includeParticipants && thread.participants
                        ? thread.participants
                              .map((id) => userLookup[id])
                              .filter((name): name is string => name !== undefined)
                        : undefined,
                threadUrl: getFullTwistURL({
                    workspaceId: thread.workspaceId,
                    threadId: thread.id,
                    channelId: thread.channelId,
                }),
            },
            comments: comments.map((c) => ({
                id: c.id,
                content: c.content,
                creator: c.creator,
                creatorName: userLookup[c.creator],
                threadId: c.threadId,
                posted: c.posted.toISOString(),
                commentUrl: getFullTwistURL({
                    workspaceId: thread.workspaceId,
                    threadId: c.threadId,
                    channelId: thread.channelId,
                    commentId: c.id,
                }),
            })),
            totalComments: thread.commentCount,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof LoadThreadOutputSchema.shape>

export { loadThread, type LoadThreadStructured }
