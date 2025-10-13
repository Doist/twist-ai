import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
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
        .describe('Optional array of user IDs to notify (only for thread replies).'),
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
    appliedFilters: z.infer<z.ZodObject<typeof ArgsSchema>>
}

const reply = {
    name: ToolNames.REPLY,
    description:
        'Post a reply to a thread (as a comment) or conversation (as a message). Use targetType to specify thread or conversation, and targetId for the ID.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { targetType, targetId, content, recipients } = args

        let replyId: number
        let created: Date
        let workspaceId: number
        let channelId: number | undefined
        let conversationId: number | undefined

        if (targetType === 'thread') {
            // Get thread info first, then create the comment
            const thread = await client.threads.getThread(targetId)
            workspaceId = thread.workspaceId
            channelId = thread.channelId

            // Create the comment
            const comment = await client.comments.createComment({
                threadId: targetId,
                content,
                recipients,
            })
            replyId = comment.id
            const postedValue = comment.posted
            created = postedValue
                ? typeof postedValue === 'string'
                    ? new Date(postedValue)
                    : postedValue
                : new Date()
        } else {
            // Get conversation info first, then create the message
            const conversation = await client.conversations.getConversation(targetId)
            workspaceId = conversation.workspaceId
            conversationId = targetId

            // Create the message
            const message = await client.conversationMessages.createMessage({
                conversationId: targetId,
                content,
            })
            replyId = message.id
            const postedValue = message.posted
            created = postedValue
                ? typeof postedValue === 'string'
                    ? new Date(postedValue)
                    : postedValue
                : new Date()
        }

        let replyUrl: string
        if (targetType === 'thread') {
            if (!channelId) {
                throw new Error('Channel ID is required for thread replies')
            }
            replyUrl = getFullTwistURL({
                workspaceId,
                threadId: targetId,
                channelId,
                commentId: replyId,
            })
        } else {
            if (!conversationId) {
                throw new Error('Conversation ID is required for conversation replies')
            }
            replyUrl = getFullTwistURL({
                workspaceId,
                conversationId,
                messageId: replyId,
            })
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
            appliedFilters: args,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { reply, type ReplyStructured }
