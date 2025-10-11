import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    conversationId: z.number().describe('The conversation ID to load.'),
    newerThanDate: z
        .string()
        .optional()
        .describe('Get messages newer than this date (YYYY-MM-DD format).'),
    olderThanDate: z
        .string()
        .optional()
        .describe('Get messages older than this date (YYYY-MM-DD format).'),
    limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50)
        .describe('Maximum number of messages to return.'),
    includeParticipants: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include participant user IDs in the response.'),
}

type LoadConversationStructured = {
    type: 'conversation_data'
    conversation: {
        id: number
        workspaceId: number
        userIds: number[]
        messageCount: number
        archived: boolean
        lastActive: Date
    }
    messages: Array<{
        id: number
        content: string
        creatorId: number
        conversationId: number
        posted: Date
    }>
    totalMessages: number
}

const loadConversation = {
    name: ToolNames.LOAD_CONVERSATION,
    description:
        'Load a conversation (direct message) with its metadata and messages. Supports filtering by timestamp and pagination.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { conversationId, newerThanDate, olderThanDate, limit, includeParticipants } = args

        // Fetch conversation metadata and messages in parallel using batch
        const [conversationResponse, messagesResponse] = await client.batch(
            client.conversations.getConversation(conversationId, { batch: true }),
            client.conversationMessages.getMessages(
                {
                    conversationId,
                    newerThan: newerThanDate ? new Date(newerThanDate) : undefined,
                    olderThan: olderThanDate ? new Date(olderThanDate) : undefined,
                    limit,
                },
                { batch: true },
            ),
        )

        const conversation = conversationResponse.data
        const messages = messagesResponse.data

        // Build text content
        const lines: string[] = [
            `# Conversation ${conversationId}`,
            '',
            `**Conversation ID:** ${conversation.id}`,
            `**Workspace ID:** ${conversation.workspaceId}`,
            `**Messages:** ${conversation.messageCount}`,
            `**Archived:** ${conversation.archived ? 'Yes' : 'No'}`,
            `**Last Active:** ${conversation.lastActive.toISOString()}`,
            '',
        ]

        if (includeParticipants) {
            lines.push('## Participants')
            lines.push('')
            lines.push(conversation.userIds.join(', '))
            lines.push('')
        }

        lines.push(`## Messages (${messages.length})`)
        lines.push('')

        for (const message of messages) {
            const messageDate = message.posted.toISOString()
            lines.push(`### Message ${message.id}`)
            lines.push(`**Creator:** ${message.creator} | **Posted:** ${messageDate}`)
            lines.push('')
            lines.push(message.content)
            lines.push('')
        }

        const structuredContent: LoadConversationStructured = {
            type: 'conversation_data',
            conversation: {
                id: conversation.id,
                workspaceId: conversation.workspaceId,
                userIds: includeParticipants ? conversation.userIds : [],
                messageCount: conversation.messageCount ?? 0,
                archived: conversation.archived,
                lastActive: conversation.lastActive,
            },
            messages: messages.map((m) => ({
                id: m.id,
                content: m.content,
                creatorId: m.creator,
                conversationId: m.conversationId,
                posted: m.posted,
            })),
            totalMessages: conversation.messageCount ?? 0,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { loadConversation, type LoadConversationStructured }
