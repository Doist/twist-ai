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
    createdTs: number
}

const reply = {
    name: ToolNames.REPLY,
    description:
        'Post a reply to a thread (as a comment) or conversation (as a message). Use targetType to specify thread or conversation, and targetId for the ID.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { targetType, targetId, content, recipients } = args

        let replyId: number
        let createdTs: number

        if (targetType === 'thread') {
            // Reply to thread (add comment)
            const comment = await client.comments.createComment({
                threadId: targetId,
                content,
                recipients,
            })
            replyId = comment.id
            createdTs = Math.floor(comment.posted.getTime() / 1000)
        } else {
            // Reply to conversation (add message)
            const message = await client.conversationMessages.createMessage({
                conversationId: targetId,
                content,
            })
            replyId = message.id
            createdTs = message.created ? Math.floor(message.created.getTime() / 1000) : 0
        }

        const lines: string[] = [
            `# Reply Posted`,
            '',
            `**Target:** ${targetType === 'thread' ? `Thread ${targetId}` : `Conversation ${targetId}`}`,
            `**Reply ID:** ${replyId}`,
            `**Created:** ${new Date(createdTs * 1000).toISOString()}`,
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
            createdTs,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { reply, type ReplyStructured }
