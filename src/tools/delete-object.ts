import type { TwistApi } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import {
    type DeleteCommentOutput,
    type DeleteMessageOutput,
    DeleteObjectOutputSchema,
    type DeleteObjectStructured,
    type DeleteThreadOutput,
} from '../utils/output-schemas.js'
import { DeleteTargetTypeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    targetType: DeleteTargetTypeSchema.describe(
        'The type of object to delete: thread, comment, or message.',
    ),
    targetId: z
        .number()
        .describe('The ID of the thread, comment, or conversation message to delete.'),
}

type Args = z.infer<z.ZodObject<typeof ArgsSchema>>
type Branch = { textContent: string; structuredContent: DeleteObjectStructured }

async function deleteThreadBranch(args: Args, client: TwistApi): Promise<Branch> {
    const { targetId } = args

    await client.threads.deleteThread(targetId)

    const lines: string[] = [
        `# Thread Deleted`,
        '',
        `**Thread ID:** ${targetId}`,
        '',
        'The thread has been permanently deleted.',
    ]

    const structuredContent: DeleteThreadOutput = {
        type: 'delete_thread_result',
        success: true,
        targetType: 'thread',
        threadId: targetId,
    }

    return { textContent: lines.join('\n'), structuredContent }
}

async function deleteCommentBranch(args: Args, client: TwistApi): Promise<Branch> {
    const { targetId } = args

    await client.comments.deleteComment(targetId)

    const lines: string[] = [
        `# Comment Deleted`,
        '',
        `**Comment ID:** ${targetId}`,
        '',
        'The comment has been permanently deleted.',
    ]

    const structuredContent: DeleteCommentOutput = {
        type: 'delete_comment_result',
        success: true,
        targetType: 'comment',
        commentId: targetId,
    }

    return { textContent: lines.join('\n'), structuredContent }
}

async function deleteMessageBranch(args: Args, client: TwistApi): Promise<Branch> {
    const { targetId } = args

    await client.conversationMessages.deleteMessage(targetId)

    const lines: string[] = [
        `# Message Deleted`,
        '',
        `**Message ID:** ${targetId}`,
        '',
        'The conversation message has been permanently deleted.',
    ]

    const structuredContent: DeleteMessageOutput = {
        type: 'delete_message_result',
        success: true,
        targetType: 'message',
        messageId: targetId,
    }

    return { textContent: lines.join('\n'), structuredContent }
}

const deleteObject = {
    name: ToolNames.DELETE_OBJECT,
    description:
        'Permanently delete a Twist object. `targetType: "thread"` deletes a thread (and all of its comments); `"comment"` deletes a single thread comment; `"message"` deletes a direct/group conversation message. Always pass `targetId`. Deletion is irreversible — confirm with the user before invoking.',
    parameters: ArgsSchema,
    outputSchema: DeleteObjectOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async execute(args, client) {
        const { targetType } = args

        const branch =
            targetType === 'thread'
                ? await deleteThreadBranch(args, client)
                : targetType === 'comment'
                  ? await deleteCommentBranch(args, client)
                  : await deleteMessageBranch(args, client)

        return getToolOutput({
            textContent: branch.textContent,
            structuredContent: branch.structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof DeleteObjectOutputSchema.shape>

export { deleteObject }
