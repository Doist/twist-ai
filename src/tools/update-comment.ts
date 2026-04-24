import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type UpdateCommentOutput, UpdateCommentOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    id: z.number().describe('The ID of the comment to update.'),
    content: z.string().min(1).describe('The new content for the comment.'),
}

const updateComment = {
    name: ToolNames.UPDATE_COMMENT,
    description:
        "Update an existing comment's content. Requires the comment ID and the new content.",
    parameters: ArgsSchema,
    outputSchema: UpdateCommentOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { id, content } = args

        const comment = await client.comments.updateComment({
            id,
            content,
        })

        const commentUrl =
            comment.url ??
            getFullTwistURL({
                workspaceId: comment.workspaceId,
                channelId: comment.channelId,
                threadId: comment.threadId,
                commentId: comment.id,
            })

        const lastEdited = comment.lastEdited ? comment.lastEdited.toISOString() : undefined

        const lines: string[] = [
            `# Comment Updated`,
            '',
            `**Comment ID:** ${comment.id}`,
            `**Thread ID:** ${comment.threadId}`,
            `**Channel ID:** ${comment.channelId}`,
            ...(lastEdited ? [`**Last Edited:** ${lastEdited}`] : []),
            `**URL:** ${commentUrl}`,
            '',
            '## Content',
            '',
            comment.content,
        ]

        const structuredContent: UpdateCommentOutput = {
            type: 'update_comment_result',
            success: true,
            commentId: comment.id,
            threadId: comment.threadId,
            channelId: comment.channelId,
            workspaceId: comment.workspaceId,
            content: comment.content,
            commentUrl,
            lastEdited,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof UpdateCommentOutputSchema.shape>

export { updateComment }
