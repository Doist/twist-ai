import type { InboxThread } from '@doist/twist-sdk'
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
        creatorId: number
        isUnread: boolean
        isStarred: boolean
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

        // Call all 4 endpoints in parallel for complete inbox picture
        const [inboxThreads, unreadCount, unreadThreadsData] = await Promise.all([
            client.inbox.getInbox({
                workspaceId,
                since: sinceDate ? new Date(sinceDate) : undefined,
                until: untilDate ? new Date(untilDate) : undefined,
                limit,
            }),
            client.inbox.getCount(workspaceId),
            client.threads.getUnread(workspaceId),
        ])

        // Filter by unread if requested
        let threads = inboxThreads.map((thread) => ({
            ...thread,
            isUnread: unreadThreadsData.some((ut) => ut.threadId === thread.id),
        }))

        const unreadThreads = threads.filter((t) => t.isUnread)
        const unreadThreadsOriginal = inboxThreads.filter((thread) =>
            unreadThreadsData.some((ut) => ut.threadId === thread.id),
        )

        if (onlyUnread) {
            threads = unreadThreads
        }

        // Build text content
        const lines: string[] = [
            `# Inbox for Workspace ${workspaceId}`,
            '',
            `**Total Threads:** ${unreadCount}`,
            `**Unread Threads:** ${unreadThreads.length}`,
            '',
            `## Threads (${threads.length})`,
            '',
        ]

        if (threads.length === 0) {
            lines.push('_No threads in inbox_')
            lines.push('')
        } else {
            for (const thread of threads) {
                const unreadBadge = thread.isUnread ? ' 🔵' : ''
                const starBadge = thread.starred ? ' ⭐' : ''
                lines.push(
                    `- **${thread.id}**: ${thread.title}${unreadBadge}${starBadge} (Channel ${thread.channelId})`,
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
                creatorId: t.creator,
                isUnread: t.isUnread,
                isStarred: t.starred,
            })),
            unreadCount,
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
