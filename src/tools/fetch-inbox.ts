import { type Channel, getFullTwistURL, type InboxThread } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID to fetch inbox for.'),
    sinceDate: z
        .string()
        .optional()
        .describe('Optional date to get items since (YYYY-MM-DD format).'),
    untilDate: z
        .string()
        .optional()
        .describe('Optional date to get items until (YYYY-MM-DD format).'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe('Maximum number of items to return.'),
    onlyUnread: z.boolean().optional().default(false).describe('Only return unread items.'),
}

type FetchInboxStructured = {
    type: 'inbox_data'
    workspaceId: number
    threads: Array<{
        id: number
        title: string
        channelId: number
        channelName?: string
        creator: number
        isUnread: boolean
        isStarred: boolean
        threadUrl: string
    }>
    unreadCount: number
    unreadThreads: InboxThread[]
    totalThreads: number
}

const fetchInbox = {
    name: ToolNames.FETCH_INBOX,
    description:
        'Fetch inbox view with threads, conversations, unread counts, and unread IDs. Provides a complete picture of the inbox state.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { workspaceId, sinceDate, untilDate, limit, onlyUnread } = args

        // Call all 3 endpoints in parallel for complete inbox picture
        const [inboxThreadsResponse, unreadCountResponse, unreadThreadsDataResponse] =
            await client.batch(
                client.inbox.getInbox(
                    {
                        workspaceId,
                        since: sinceDate ? new Date(sinceDate) : undefined,
                        until: untilDate ? new Date(untilDate) : undefined,
                        limit,
                    },
                    { batch: true },
                ),
                client.inbox.getCount(workspaceId, { batch: true }),
                client.threads.getUnread(workspaceId, { batch: true }),
            )

        // Filter by unread if requested
        let threads = inboxThreadsResponse.data.map((thread) => ({
            ...thread,
            isUnread: unreadThreadsDataResponse.data.some((ut) => ut.threadId === thread.id),
        }))

        const unreadThreads = threads.filter((t) => t.isUnread)
        const unreadThreadsOriginal = inboxThreadsResponse.data.filter((thread) =>
            unreadThreadsDataResponse.data.some((ut) => ut.threadId === thread.id),
        )
        const unreadCount = unreadCountResponse.data

        if (onlyUnread) {
            threads = unreadThreads
        }

        // Build text content
        const lines: string[] = [
            `# Inbox for Workspace ${workspaceId}`,
            '',
            `**Total Threads:** ${threads.length}`,
            `**Unread Threads:** ${unreadThreads.length}`,
            '',
            `## Threads (${threads.length})`,
            '',
        ]

        const channelCalls = threads.map((thread) =>
            client.channels.getChannel(thread.channelId, { batch: true }),
        )
        const channelResponses = await client.batch(...channelCalls)
        const channelInfo: Record<Channel['id'], Channel> = channelResponses.reduce(
            (acc, res) => {
                acc[res.data.id] = res.data
                return acc
            },
            {} as Record<Channel['id'], Channel>,
        )

        if (threads.length === 0) {
            lines.push('_No threads in inbox_')
            lines.push('')
        } else {
            for (const thread of threads) {
                const channel = channelInfo[thread.channelId]
                const channelDetails = !channel ? `(Channel ${thread.channelId})` : ''
                if (channel) {
                    thread.title = `[${channel.name}] ${thread.title}`
                }
                const unreadBadge = thread.isUnread ? ' 🔵' : ''
                const starBadge = thread.starred ? ' ⭐' : ''
                lines.push(
                    `- ${thread.title}${unreadBadge}${starBadge}${channelDetails} (ID: ${thread.id})`,
                )
            }
            lines.push('')
        }

        if (unreadCount > 0) {
            lines.push('## Next Steps')
            lines.push('')
            lines.push('- Use `load_thread` to read specific threads with their comments')
            lines.push(
                '- Use `load_conversation` to read specific conversations with their messages',
            )
            lines.push('- Use `mark_done` to mark items as read and archive them')
        }

        const structuredContent: FetchInboxStructured = {
            type: 'inbox_data',
            workspaceId,
            threads: threads.map((t) => ({
                id: t.id,
                title: t.title,
                channelId: t.channelId,
                channelName: channelInfo[t.channelId]?.name,
                creator: t.creator,
                isUnread: t.isUnread,
                isStarred: t.starred,
                threadUrl: getFullTwistURL({
                    workspaceId,
                    threadId: t.id,
                    channelId: t.channelId,
                }),
            })),
            unreadCount: unreadThreads.length,
            unreadThreads: unreadThreadsOriginal,
            totalThreads: threads.length,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { fetchInbox, type FetchInboxStructured }
