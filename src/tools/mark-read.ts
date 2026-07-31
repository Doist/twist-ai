import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { MarkReadOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID the threads and conversations belong to.'),
    threadIds: z
        .array(z.number())
        .optional()
        .describe('Thread IDs to mark as read. Combine with conversationIds, or use all.'),
    conversationIds: z
        .array(z.number())
        .optional()
        .describe('Conversation IDs to mark as read. Combine with threadIds, or use all.'),
    all: z
        .boolean()
        .optional()
        .default(false)
        .describe(
            'Mark every unread thread and conversation in the workspace as read. Cannot be combined with threadIds or conversationIds.',
        ),
}

type MarkReadStructured = {
    type: 'mark_read_result'
    workspaceId: number
    mode: 'individual' | 'all'
    threads: {
        marked: number[]
        alreadyRead: number[]
    }
    conversations: {
        marked: number[]
        alreadyRead: number[]
    }
    failed: Array<{ item: number; itemType: 'thread' | 'conversation'; error: string }>
    markedCount: number
    failureCount: number
}

const markRead = {
    name: ToolNames.MARK_READ,
    description:
        'Mark threads and conversations as read without archiving them. Pass threadIds and/or conversationIds for specific items, or all: true to clear every unread item in the workspace. Unlike mark-done, items stay in the inbox. Read positions are resolved from the unread state, so the unread badge actually clears.',
    parameters: ArgsSchema,
    outputSchema: MarkReadOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { workspaceId, threadIds, conversationIds, all = false } = args

        const hasIds = Boolean(threadIds?.length || conversationIds?.length)

        if (!all && !hasIds) {
            throw new Error('Must provide threadIds, conversationIds, or all: true')
        }

        if (all && hasIds) {
            throw new Error('all cannot be combined with threadIds or conversationIds')
        }

        // The unread endpoints tell us *which* items are unread, but their obj_index is
        // the caller's unread marker, not a position that can be read back. Twist accepts
        // it and answers "ok" while leaving the item unread, so read positions have to
        // come from the thread and conversation records themselves.
        const [unreadThreadsResponse, unreadConversationsResponse] = await client.batch(
            client.threads.getUnread(workspaceId, { batch: true }),
            client.conversations.getUnread(workspaceId, { batch: true }),
        )

        const unreadThreads = unreadThreadsResponse.data
        const unreadConversations = unreadConversationsResponse.data

        const requestedThreadIds = all ? unreadThreads.map((t) => t.threadId) : (threadIds ?? [])
        const requestedConversationIds = all
            ? unreadConversations.map((c) => c.conversationId)
            : (conversationIds ?? [])

        const threadTargetIds = requestedThreadIds.filter((id) =>
            unreadThreads.some((t) => t.threadId === id),
        )
        const threadsAlreadyRead = requestedThreadIds.filter(
            (id) => !unreadThreads.some((t) => t.threadId === id),
        )

        const conversationTargets = requestedConversationIds.filter((id) =>
            unreadConversations.some((c) => c.conversationId === id),
        )
        const conversationsAlreadyRead = requestedConversationIds.filter(
            (id) => !unreadConversations.some((c) => c.conversationId === id),
        )

        const threadsMarked: number[] = []
        const conversationsMarked: number[] = []
        const failed: MarkReadStructured['failed'] = []

        if (threadTargetIds.length > 0) {
            const threadResponses = await client.batch(
                ...threadTargetIds.map((id) => client.threads.getThread(id, { batch: true })),
            )

            for (const response of threadResponses) {
                const thread = response.data
                try {
                    await client.threads.markRead({
                        id: thread.id,
                        objIndex: thread.lastObjIndex ?? thread.commentCount,
                    })
                    threadsMarked.push(thread.id)
                } catch (error) {
                    failed.push({
                        item: thread.id,
                        itemType: 'thread',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    })
                }
            }
        }

        // Conversations mark read by the ID of their last message, which only the
        // conversation record carries.
        for (const id of conversationTargets) {
            try {
                const conversation = await client.conversations.getConversation(id)
                const messageId = conversation.lastMessage?.id
                await client.conversations.markRead(
                    messageId ? { id, messageId } : { id, objIndex: conversation.lastObjIndex },
                )
                conversationsMarked.push(id)
            } catch (error) {
                failed.push({
                    item: id,
                    itemType: 'conversation',
                    error: error instanceof Error ? error.message : 'Unknown error',
                })
            }
        }

        const mode: MarkReadStructured['mode'] = all ? 'all' : 'individual'
        const markedCount = threadsMarked.length + conversationsMarked.length

        const lines: string[] = ['# Mark Read', '']
        lines.push(`**Workspace ID:** ${workspaceId}`)
        lines.push(`**Mode:** ${mode === 'all' ? 'All unread in workspace' : 'Individual IDs'}`)
        lines.push(`**Marked Read:** ${markedCount}`)
        lines.push(
            `**Already Read:** ${threadsAlreadyRead.length + conversationsAlreadyRead.length}`,
        )
        lines.push(`**Failed:** ${failed.length}`)
        lines.push('')

        if (threadsMarked.length > 0) {
            lines.push('## Threads Marked Read')
            lines.push('')
            lines.push(threadsMarked.join(', '))
            lines.push('')
        }

        if (conversationsMarked.length > 0) {
            lines.push('## Conversations Marked Read')
            lines.push('')
            lines.push(conversationsMarked.join(', '))
            lines.push('')
        }

        if (threadsAlreadyRead.length > 0 || conversationsAlreadyRead.length > 0) {
            lines.push('## Already Read')
            lines.push('')
            if (threadsAlreadyRead.length > 0) {
                lines.push(`- Threads: ${threadsAlreadyRead.join(', ')}`)
            }
            if (conversationsAlreadyRead.length > 0) {
                lines.push(`- Conversations: ${conversationsAlreadyRead.join(', ')}`)
            }
            lines.push('')
        }

        if (failed.length > 0) {
            lines.push('## Failed')
            lines.push('')
            for (const failure of failed) {
                lines.push(`- ${failure.itemType} ${failure.item}: ${failure.error}`)
            }
            lines.push('')
        }

        lines.push('## Next Steps')
        lines.push('')
        lines.push(
            failed.length > 0
                ? 'Review failed items and retry if needed.'
                : 'Use `fetch-inbox` with onlyUnread to confirm nothing is left unread, or `mark-done` to archive items too.',
        )

        const structuredContent: MarkReadStructured = {
            type: 'mark_read_result',
            workspaceId,
            mode,
            threads: {
                marked: threadsMarked,
                alreadyRead: threadsAlreadyRead,
            },
            conversations: {
                marked: conversationsMarked,
                alreadyRead: conversationsAlreadyRead,
            },
            failed,
            markedCount,
            failureCount: failed.length,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof MarkReadOutputSchema.shape>

export { markRead, type MarkReadStructured }
