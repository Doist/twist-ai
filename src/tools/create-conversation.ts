import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import {
    type CreateConversationOutput,
    CreateConversationOutputSchema,
} from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The ID of the workspace the conversation belongs to.'),
    recipients: z
        .array(z.number())
        .min(1)
        .describe(
            'User IDs to include in the direct or group conversation (excluding yourself, who is added automatically). Use get-users to resolve names to IDs.',
        ),
    content: z.string().min(1).describe('The content of the first message to post.'),
}

const createConversation = {
    name: ToolNames.CREATE_CONVERSATION,
    description:
        'Start a direct or group conversation with one or more users and post an initial message. Reuses the existing conversation if one already exists for the same set of users.',
    parameters: ArgsSchema,
    outputSchema: CreateConversationOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute(args, client) {
        const { workspaceId, recipients, content } = args

        const conversation = await client.conversations.getOrCreateConversation({
            workspaceId,
            userIds: recipients,
        })

        const message = await client.conversationMessages.createMessage({
            conversationId: conversation.id,
            content,
        })

        const conversationUrl = getFullTwistURL({
            workspaceId: conversation.workspaceId,
            conversationId: conversation.id,
        })
        const messageUrl =
            message.url ??
            getFullTwistURL({
                workspaceId: message.workspaceId,
                conversationId: message.conversationId,
                messageId: message.id,
            })

        const postedValue = message.posted
        const created = postedValue
            ? typeof postedValue === 'string'
                ? new Date(postedValue)
                : postedValue
            : new Date()

        const lines: string[] = [
            `# Conversation Started`,
            '',
            `**Conversation ID:** ${conversation.id}`,
            `**Message ID:** ${message.id}`,
            `**Participants:** ${conversation.userIds.join(', ')}`,
            `**Created:** ${created.toISOString()}`,
            `**URL:** ${conversationUrl}`,
            '',
            '## Message',
            '',
            content,
        ]

        const structuredContent: CreateConversationOutput = {
            type: 'create_conversation_result',
            success: true,
            conversationId: conversation.id,
            messageId: message.id,
            workspaceId: conversation.workspaceId,
            content,
            recipients,
            participants: conversation.userIds,
            created: created.toISOString(),
            conversationUrl,
            messageUrl,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof CreateConversationOutputSchema.shape>

export { createConversation }
