import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type UpdateMessageOutput, UpdateMessageOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    id: z.number().describe('The ID of the conversation message to update.'),
    content: z.string().min(1).describe('The new content for the message.'),
}

const updateMessage = {
    name: ToolNames.UPDATE_MESSAGE,
    description:
        "Update an existing conversation (DM) message's content. Requires the message ID and the new content. Use this to correct or revise a message you previously sent in a direct/group conversation. For thread comments use update-comment instead; for thread bodies use update-thread.",
    parameters: ArgsSchema,
    outputSchema: UpdateMessageOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { id, content } = args

        const message = await client.conversationMessages.updateMessage({
            id,
            content,
        })

        const messageUrl =
            message.url ??
            getFullTwistURL({
                workspaceId: message.workspaceId,
                conversationId: message.conversationId,
                messageId: message.id,
            })

        const lastEdited = message.lastEdited ? message.lastEdited.toISOString() : undefined

        const lines: string[] = [
            `# Message Updated`,
            '',
            `**Message ID:** ${message.id}`,
            `**Conversation ID:** ${message.conversationId}`,
            `**Workspace ID:** ${message.workspaceId}`,
            ...(lastEdited ? [`**Last Edited:** ${lastEdited}`] : []),
            `**URL:** ${messageUrl}`,
            '',
            '## Content',
            '',
            message.content,
        ]

        const structuredContent: UpdateMessageOutput = {
            type: 'update_message_result',
            success: true,
            messageId: message.id,
            conversationId: message.conversationId,
            workspaceId: message.workspaceId,
            content: message.content,
            messageUrl,
            lastEdited,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof UpdateMessageOutputSchema.shape>

export { updateMessage }
