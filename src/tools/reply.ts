import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ReplyOutputSchema } from '../utils/output-schemas.js'
import { type ReplyTargetType, ReplyTargetTypeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    targetType: ReplyTargetTypeSchema.describe(
        'The type of object to reply to: thread (posts a comment) or conversation (posts a message).',
    ),
    targetId: z.number().describe('The ID of the thread or conversation to reply to.'),
    content: z.string().min(1).describe('The content of the reply.'),
    recipients: z
        .array(z.number())
        .optional()
        .describe(
            'Optional array of user IDs to notify (only for thread replies). If omitted, Twist defaults to notifying all current members of the channel. Add specific user IDs to limit or expand notifications beyond current channel members.',
        ),
    groups: z
        .array(z.number())
        .optional()
        .describe(
            'Optional array of group IDs to notify (only for thread replies). Use get-groups to discover group IDs before passing them here.',
        ),
}

type ReplyStructured = {
    type: 'reply_result'
    success: boolean
    targetType: ReplyTargetType
    targetId: number
    replyId: number
    content: string
    created: string
    replyUrl: string
    recipients?: number[]
    groups?: number[]
}

const reply = {
    name: ToolNames.REPLY,
    description:
        'Post a reply to a thread (as a comment) or conversation (as a message). Use targetType to specify thread or conversation, and targetId for the ID.',
    parameters: ArgsSchema,
    outputSchema: ReplyOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute(args, client) {
        const { targetType, targetId, content, recipients, groups } = args

        let replyId: number
        let created: Date
        let replyUrl: string

        if (targetType === 'thread') {
            const commentArgs = {
                threadId: targetId,
                content,
                recipients,
                groups,
            } as Parameters<typeof client.comments.createComment>[0] & { groups?: number[] }
            const comment = await client.comments.createComment(commentArgs)
            replyId = comment.id
            replyUrl =
                comment.url ??
                getFullTwistURL({
                    workspaceId: comment.workspaceId,
                    channelId: comment.channelId,
                    threadId: comment.threadId,
                    commentId: comment.id,
                })
            const postedValue = comment.posted
            created = postedValue
                ? typeof postedValue === 'string'
                    ? new Date(postedValue)
                    : postedValue
                : new Date()
        } else {
            const message = await client.conversationMessages.createMessage({
                conversationId: targetId,
                content,
            })
            replyId = message.id
            replyUrl =
                message.url ??
                getFullTwistURL({
                    workspaceId: message.workspaceId,
                    conversationId: message.conversationId,
                    messageId: message.id,
                })
            const postedValue = message.posted
            created = postedValue
                ? typeof postedValue === 'string'
                    ? new Date(postedValue)
                    : postedValue
                : new Date()
        }

        const lines: string[] = [
            `# Reply Posted`,
            '',
            `**Target:** ${targetType === 'thread' ? `Thread ${targetId}` : `Conversation ${targetId}`}`,
            `**Reply ID:** ${replyId}`,
            `**Created:** ${created.toISOString()}`,
            '',
            '## Content',
            '',
            content,
        ]

        const structuredContent: ReplyStructured = {
            type: 'reply_result',
            success: true,
            targetType,
            targetId,
            replyId,
            content,
            created: created.toISOString(),
            replyUrl,
            ...(targetType === 'thread' && recipients && { recipients }),
            ...(targetType === 'thread' && groups && { groups }),
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof ReplyOutputSchema.shape>

export { reply, type ReplyStructured }
