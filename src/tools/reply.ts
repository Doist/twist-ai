import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ReplyOutputSchema } from '../utils/output-schemas.js'
import { type ReplyTargetType, ReplyTargetTypeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const DEFAULT_THREAD_REPLY_RECIPIENTS = 'EVERYONE_IN_THREAD' as const

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
            'Optional array of user IDs to notify (only for thread replies). If omitted with no groups, thread replies notify everyone who has interacted with the thread.',
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
    recipientMode?: typeof DEFAULT_THREAD_REPLY_RECIPIENTS
    groups?: number[]
}

const reply = {
    name: ToolNames.REPLY,
    description:
        'Post a reply to a thread (as a comment) or conversation (as a message). Thread replies notify everyone who has interacted with the thread by default unless specific user recipients or groups are provided.',
    parameters: ArgsSchema,
    outputSchema: ReplyOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute(args, client) {
        const { targetType, targetId, content, recipients, groups } = args

        let replyId: number
        let created: Date
        let replyUrl: string
        const groupsToNotify =
            targetType === 'thread' && groups && groups.length > 0 ? groups : undefined

        if (targetType === 'thread') {
            const resolvedRecipients =
                recipients ?? (groupsToNotify ? undefined : DEFAULT_THREAD_REPLY_RECIPIENTS)
            const commentArgs = {
                threadId: targetId,
                content,
                recipients: resolvedRecipients,
                groups: groupsToNotify,
            } as Parameters<typeof client.comments.createComment>[0] & {
                recipients?: number[] | typeof DEFAULT_THREAD_REPLY_RECIPIENTS
                groups?: number[]
            }
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
            ...(targetType === 'thread' &&
                !recipients &&
                !groupsToNotify && { recipientMode: DEFAULT_THREAD_REPLY_RECIPIENTS }),
            ...(targetType === 'thread' && groupsToNotify && { groups: groupsToNotify }),
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof ReplyOutputSchema.shape>

export { reply, type ReplyStructured }
