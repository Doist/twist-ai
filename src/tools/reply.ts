import { getFullTwistURL, NOTIFY_AUDIENCES, type NotifyAudience } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type ReplyOutput, ReplyOutputSchema } from '../utils/output-schemas.js'
import { ReplyTargetTypeSchema } from '../utils/target-types.js'
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
            'Optional array of user IDs to notify (only for thread replies). If omitted with no groups and no notifyAudience, thread replies default to notifying everyone who has interacted with the thread.',
        ),
    groups: z
        .array(z.number())
        .optional()
        .describe(
            'Optional array of group IDs to notify (only for thread replies). Use get-groups to discover group IDs before passing them here.',
        ),
    notifyAudience: z
        .enum(NOTIFY_AUDIENCES)
        .optional()
        .describe(
            "Optional broader audience to notify in addition to recipients and groups (only for thread replies). 'channel' notifies everyone in the channel; 'thread' notifies everyone who has interacted with the thread.",
        ),
}

const reply = {
    name: ToolNames.REPLY,
    description:
        'Post a reply to a thread (as a comment) or conversation (as a message). Thread replies notify everyone who has interacted with the thread by default unless specific user recipients, groups, or a notifyAudience are provided.',
    parameters: ArgsSchema,
    outputSchema: ReplyOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute(args, client) {
        const { targetType, targetId, content, recipients, groups, notifyAudience } = args

        if (targetType === 'conversation' && groups !== undefined) {
            throw new Error('groups can only be used when replying to a thread.')
        }
        if (targetType === 'conversation' && notifyAudience !== undefined) {
            throw new Error('notifyAudience can only be used when replying to a thread.')
        }

        const groupsToNotify =
            targetType === 'thread' && groups && groups.length > 0 ? groups : undefined
        const appliedAudience: NotifyAudience | undefined =
            targetType === 'thread'
                ? (notifyAudience ??
                  (recipients === undefined && !groupsToNotify ? 'thread' : undefined))
                : undefined

        let replyId: number
        let created: Date
        let replyUrl: string

        if (targetType === 'thread') {
            const comment = await client.comments.createComment({
                threadId: targetId,
                content,
                recipients,
                groups: groupsToNotify,
                notifyAudience: appliedAudience,
            })
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
            ...(targetType === 'thread' && recipients ? { recipients } : {}),
            ...(groupsToNotify ? { groups: groupsToNotify } : {}),
            ...(appliedAudience ? { notifyAudience: appliedAudience } : {}),
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof ReplyOutputSchema.shape>

type ReplyStructured = ReplyOutput

export { reply, type ReplyStructured }
