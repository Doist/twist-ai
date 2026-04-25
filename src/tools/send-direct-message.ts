import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import {
    type SendDirectMessageOutput,
    SendDirectMessageOutputSchema,
} from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID to send the message in.'),
    userIds: z
        .array(z.number())
        .min(1)
        .describe(
            'User IDs to message. One ID is a 1-on-1 DM; multiple IDs is a group conversation. Do NOT include the sender (current user) — Twist adds them automatically.',
        ),
    content: z.string().min(1).describe('The content of the message.'),
}

const sendDirectMessage = {
    name: ToolNames.SEND_DIRECT_MESSAGE,
    description:
        'Send a direct (private) message to one or more workspace users. Finds the existing conversation between the given users (1-on-1 DM or group) or creates a new one, then posts the message. Use this instead of create-thread when the message is private and not meant for a channel.',
    parameters: ArgsSchema,
    outputSchema: SendDirectMessageOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute(args, client) {
        const { workspaceId, userIds, content } = args

        const conversation = await client.conversations.getOrCreateConversation({
            workspaceId,
            userIds,
        })

        const message = await client.conversationMessages.createMessage({
            conversationId: conversation.id,
            content,
        })

        const conversationUrl =
            conversation.url ??
            getFullTwistURL({
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

        // Heuristic: a brand-new conversation has 0 or 1 prior messages (the
        // one we just sent). Anything more means it already existed.
        const wasNew = (conversation.messageCount ?? 0) <= 1

        const lines: string[] = [
            `# Direct Message Sent`,
            '',
            `**Conversation ID:** ${conversation.id}`,
            ...(conversation.title ? [`**Title:** ${conversation.title}`] : []),
            `**Recipients (user IDs):** ${userIds.join(', ')}`,
            `**Conversation existed before:** ${wasNew ? 'No (new conversation)' : 'Yes'}`,
            `**Message ID:** ${message.id}`,
            `**Created:** ${created.toISOString()}`,
            `**URL:** ${messageUrl}`,
            '',
            '## Content',
            '',
            content,
        ]

        const structuredContent: SendDirectMessageOutput = {
            type: 'send_direct_message_result',
            success: true,
            conversationId: conversation.id,
            workspaceId: conversation.workspaceId,
            userIds: conversation.userIds,
            conversationTitle: conversation.title ?? undefined,
            conversationUrl,
            messageId: message.id,
            content,
            created: created.toISOString(),
            messageUrl,
            createdConversation: wasNew,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof SendDirectMessageOutputSchema.shape>

export { sendDirectMessage }
