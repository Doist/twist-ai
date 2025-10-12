import { getFullTwistURL, type WorkspaceUser } from '@doist/twist-sdk'
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
        archived: boolean
        lastActive: string
        title?: string
        conversationUrl: string
    }
    messages: Array<{
        id: number
        content: string
        creatorId: number
        creatorName?: string
        conversationId: number
        posted: string
        messageUrl: string
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

        const { userIds } = conversation
        const userRequests = userIds.map((id) =>
            client.workspaceUsers.getUserById(
                { workspaceId: conversation.workspaceId, userId: id },
                { batch: true },
            ),
        )
        const userResponses = await client.batch(...userRequests)
        const users = userResponses.map((res) => res.data)
        const userInfo = users.reduce(
            (acc, user) => {
                acc[user.id] = user
                return acc
            },
            {} as Record<WorkspaceUser['id'], WorkspaceUser>,
        )

        // Build text content
        const lines: string[] = [
            `# Conversation ${conversationId}`,
            '',
            `**Conversation ID:** ${conversation.id}`,
            ...(conversation.title ? [`**Title:** ${conversation.title}`] : []),
            `**Workspace ID:** ${conversation.workspaceId}`,
            `**Archived:** ${conversation.archived ? 'Yes' : 'No'}`,
            `**Last Active:** ${conversation.lastActive.toISOString()}`,
            '',
        ]

        if (includeParticipants) {
            lines.push('## Participants')
            lines.push('')
            lines.push(conversation.userIds.map((id) => userInfo[id]?.name).join(', '))
            lines.push('')
        }

        lines.push(`## Messages (${messages.length})`)
        lines.push('')

        for (const message of messages) {
            const messageDate = message.posted.toISOString()
            lines.push(`### Message ${message.id}`)
            lines.push(
                `**Creator:** ${userInfo[message.creator]?.name} | **Posted:** ${messageDate}`,
            )
            lines.push('')
            lines.push(message.content)
            lines.push('')
        }

        const structuredContent: LoadConversationStructured = {
            type: 'conversation_data',
            conversation: {
                id: conversation.id,
                title: conversation.title ?? undefined,
                workspaceId: conversation.workspaceId,
                userIds: includeParticipants ? conversation.userIds : [],
                archived: conversation.archived,
                lastActive: conversation.lastActive.toISOString(),
                conversationUrl: getFullTwistURL({
                    workspaceId: conversation.workspaceId,
                    conversationId: conversation.id,
                }),
            },
            messages: messages.map((m) => ({
                id: m.id,
                content: m.content,
                creatorId: m.creator,
                creatorName: userInfo[m.creator]?.name,
                conversationId: m.conversationId,
                posted: m.posted.toISOString(),
                messageUrl: getFullTwistURL({
                    workspaceId: conversation.workspaceId,
                    conversationId: m.conversationId,
                    messageId: m.id,
                }),
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
