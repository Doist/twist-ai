import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type DeleteItemOutput, DeleteItemOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const TargetTypeSchema = z.enum(['thread', 'comment', 'message'])

const ArgsSchema = {
    targetType: TargetTypeSchema.describe(
        'What to delete: a thread, a comment (reply on a thread), or a message (reply in a conversation/DM).',
    ),
    targetId: z.number().describe('The ID of the thread, comment, or message to delete.'),
}

const deleteItem = {
    name: ToolNames.DELETE_ITEM,
    description:
        'Permanently delete a thread, comment, or conversation message. Deletion is irreversible — only the author or a workspace admin can delete an item. Use this to clean up posts that were sent in error or are no longer needed.',
    parameters: ArgsSchema,
    outputSchema: DeleteItemOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async execute(args, client) {
        const { targetType, targetId } = args

        if (targetType === 'thread') {
            await client.threads.deleteThread(targetId)
        } else if (targetType === 'comment') {
            await client.comments.deleteComment(targetId)
        } else {
            await client.conversationMessages.deleteMessage(targetId)
        }

        const lines: string[] = [
            `# Deleted`,
            '',
            `**Type:** ${targetType}`,
            `**ID:** ${targetId}`,
            '',
            'This action is permanent.',
        ]

        const structuredContent: DeleteItemOutput = {
            type: 'delete_item_result',
            success: true,
            targetType,
            targetId,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof DeleteItemOutputSchema.shape>

export { deleteItem }
