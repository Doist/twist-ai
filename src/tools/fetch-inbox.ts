import {
    type Channel,
    type Conversation,
    getFullTwistURL,
    type InboxThread,
    type UnreadConversation,
    type WorkspaceUser,
} from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { FetchInboxOutputSchema } from '../utils/output-schemas.js'
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
    conversations: Array<{
        id: number
        title: string
        userIds: number[]
        participantNames: string[]
        isUnread: boolean
        conversationUrl: string
    }>
    unreadCount: number
    unreadThreads: InboxThread[]
    unreadConversations: UnreadConversation[]
    totalThreads: number
    totalConversations: number
}

/**
 * Helper function to load conversation details with participant information
 */
async function loadConversationDetails(
    client: Parameters<TwistTool<typeof ArgsSchema>['execute']>[1],
    conversationIds: number[],
): Promise<
    Array<{
        conversation: Conversation
        participants: WorkspaceUser[]
    }>
> {
    if (conversationIds.length === 0) {
        return []
    }

    // Batch load all conversation metadata
    const conversationCalls = conversationIds.map((id) =>
        client.conversations.getConversation(id, { batch: true }),
    )
    const conversationResponses = await client.batch(...conversationCalls)
    const conversations = conversationResponses.map((res) => res.data)

    // Collect all unique user IDs from all conversations
    const allUserIds = new Set<number>()
    for (const conv of conversations) {
        for (const userId of conv.userIds) {
            allUserIds.add(userId)
        }
    }

    // Batch load all user info
    const workspaceId = conversations[0]?.workspaceId
    if (!workspaceId) {
        return conversations.map((conversation) => ({ conversation, participants: [] }))
    }

    const userCalls = Array.from(allUserIds).map((userId) =>
        client.workspaceUsers.getUserById({ workspaceId, userId }, { batch: true }),
    )
    const userResponses = await client.batch(...userCalls)
    const userMap = userResponses.reduce(
        (acc, res) => {
            acc[res.data.id] = res.data
            return acc
        },
        {} as Record<number, WorkspaceUser>,
    )

    // Map conversations to include their participants
    return conversations.map((conversation) => ({
        conversation,
        participants: conversation.userIds
            .map((id) => userMap[id])
            .filter((user): user is WorkspaceUser => !!user),
    }))
}

const fetchInbox = {
    name: ToolNames.FETCH_INBOX,
    description:
        'Fetch inbox view with threads, conversations, unread counts, and unread IDs. Provides a complete picture of the inbox state.',
    parameters: ArgsSchema,
    outputSchema: FetchInboxOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { workspaceId, sinceDate, untilDate, limit, onlyUnread } = args

        // Call all 4 endpoints in parallel for complete inbox picture
        const [
            inboxThreadsResponse,
            unreadCountResponse,
            unreadThreadsDataResponse,
            unreadConversationsDataResponse,
        ] = await client.batch(
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
            client.conversations.getUnread(workspaceId, { batch: true }),
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

        // Load unread conversations if any exist
        const unreadConversationsOriginal = unreadConversationsDataResponse.data
        const unreadConversationIds = unreadConversationsOriginal.map((uc) => uc.conversationId)

        let conversationsWithDetails: Array<{
            conversation: Conversation
            participants: WorkspaceUser[]
            isUnread: boolean
        }> = []

        // Only load and display conversations if there are unread ones
        if (unreadConversationIds.length > 0) {
            const conversationDetails = await loadConversationDetails(client, unreadConversationIds)
            conversationsWithDetails = conversationDetails.map((detail) => ({
                ...detail,
                isUnread: true,
            }))
        }

        // Build text content
        const lines: string[] = [
            `# Inbox for Workspace ${workspaceId}`,
            '',
            `**Total Threads:** ${threads.length}`,
            `**Unread Threads:** ${unreadThreads.length}`,
        ]

        // Only add conversation counts if there are unread conversations
        if (conversationsWithDetails.length > 0) {
            lines.push(`**Total Conversations:** ${conversationsWithDetails.length}`)
            lines.push(`**Unread Conversations:** ${conversationsWithDetails.length}`)
        }

        lines.push('')
        lines.push(`## Threads (${threads.length})`)
        lines.push('')

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

        // Add conversations section only if there are unread conversations
        if (conversationsWithDetails.length > 0) {
            lines.push(`## Conversations (${conversationsWithDetails.length})`)
            lines.push('')

            for (const convDetail of conversationsWithDetails) {
                const { conversation, participants } = convDetail
                // Build a human-readable title from participant names
                const participantNames = participants.map((p) => p.name).join(', ')
                const conversationTitle =
                    conversation.title ||
                    `DM with ${participantNames}` ||
                    `Conversation ${conversation.id}`
                const unreadBadge = convDetail.isUnread ? ' 🔵' : ''

                lines.push(`- ${conversationTitle}${unreadBadge} (ID: ${conversation.id})`)
            }
            lines.push('')
        }

        if (unreadCount > 0 || conversationsWithDetails.length > 0) {
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
            conversations: conversationsWithDetails.map((cd) => {
                const { conversation, participants } = cd
                const participantNames = participants.map((p) => p.name)
                return {
                    id: conversation.id,
                    title:
                        conversation.title ||
                        `DM with ${participantNames.join(', ')}` ||
                        `Conversation ${conversation.id}`,
                    userIds: conversation.userIds,
                    participantNames,
                    isUnread: cd.isUnread,
                    conversationUrl: getFullTwistURL({
                        workspaceId,
                        conversationId: conversation.id,
                    }),
                }
            }),
            unreadCount: unreadThreads.length,
            unreadThreads: unreadThreadsOriginal,
            unreadConversations: unreadConversationsOriginal,
            totalThreads: threads.length,
            totalConversations: conversationsWithDetails.length,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof FetchInboxOutputSchema.shape>

export { fetchInbox, type FetchInboxStructured }
