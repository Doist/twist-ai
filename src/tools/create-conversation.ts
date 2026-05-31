import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { uploadAttachments } from '../utils/attachments.js'
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
    attachments: z
        .array(z.string())
        .optional()
        .describe(
            'Optional local filesystem paths to upload and attach to the first message. Each file is uploaded to Twist before the message is sent.',
        ),
}

const createConversation = {
    name: ToolNames.CREATE_CONVERSATION,
    description:
        'Start a direct or group conversation with one or more users and post an initial message. Reuses the existing conversation if one already exists for the same set of users. Optionally attach local files to the first message.',
    parameters: ArgsSchema,
    outputSchema: CreateConversationOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute(args, client) {
        const { workspaceId, recipients, content, attachments } = args

        const uploaded =
            attachments && attachments.length > 0
                ? await uploadAttachments(client, attachments)
                : []

        const conversation = await client.conversations.getOrCreateConversation({
            workspaceId,
            userIds: recipients,
        })

        const message = await client.conversationMessages.createMessage({
            conversationId: conversation.id,
            content,
            ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
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

        const attachmentNames =
            attachments && attachments.length > 0
                ? attachments.map((path) => path.split('/').pop() ?? path)
                : undefined

        const lines: string[] = [
            `# Conversation Started`,
            '',
            `**Conversation ID:** ${conversation.id}`,
            `**Message ID:** ${message.id}`,
            `**Participants:** ${conversation.userIds.join(', ')}`,
            `**Created:** ${created.toISOString()}`,
            `**URL:** ${conversationUrl}`,
        ]
        if (attachmentNames) {
            lines.push(`**Attachments:** ${attachmentNames.join(', ')}`)
        }
        lines.push('', '## Message', '', content)

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
            ...(attachmentNames
                ? { attachmentCount: attachmentNames.length, attachmentNames }
                : {}),
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof CreateConversationOutputSchema.shape>

export { createConversation }
