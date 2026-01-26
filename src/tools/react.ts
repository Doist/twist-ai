import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ReactOutputSchema } from '../utils/output-schemas.js'
import { type ReactionTargetType, ReactionTargetTypeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    targetType: ReactionTargetTypeSchema.describe(
        'The type of object to react to: thread, comment, or message.',
    ),
    targetId: z.number().describe('The ID of the thread, comment, or message to react to.'),
    emoji: z.string().min(1).describe('The emoji to react with (e.g., "👍", "❤️", "🎉").'),
    operation: z
        .enum(['add', 'remove'])
        .default('add')
        .describe('Whether to add or remove the reaction.'),
}

type ReactStructured = {
    type: 'reaction_result'
    success: boolean
    operation: 'add' | 'remove'
    targetType: ReactionTargetType
    targetId: number
    emoji: string
    targetUrl: string
}

const react = {
    name: ToolNames.REACT,
    description:
        'Add or remove an emoji reaction on a thread, comment, or conversation message. Use targetType to specify the type of object (thread, comment, or message) and targetId for the ID.',
    parameters: ArgsSchema,
    outputSchema: ReactOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    async execute(args, client) {
        const { targetType, targetId, emoji, operation } = args

        let workspaceId: number
        let channelId: number | undefined
        let threadId: number | undefined
        let conversationId: number | undefined

        // Fetch target metadata to get IDs for URL building
        if (targetType === 'thread') {
            const thread = await client.threads.getThread(targetId)
            workspaceId = thread.workspaceId
            channelId = thread.channelId
            threadId = targetId
        } else if (targetType === 'comment') {
            const comment = await client.comments.getComment(targetId)
            threadId = comment.threadId
            const thread = await client.threads.getThread(threadId)
            workspaceId = thread.workspaceId
            channelId = thread.channelId
        } else {
            // message
            const message = await client.conversationMessages.getMessage(targetId)
            conversationId = message.conversationId
            const conversation = await client.conversations.getConversation(conversationId)
            workspaceId = conversation.workspaceId
        }

        // Map targetType to the appropriate API parameter
        const apiParams: {
            threadId?: number
            commentId?: number
            messageId?: number
            reaction: string
        } = { reaction: emoji }

        if (targetType === 'thread') {
            apiParams.threadId = targetId
        } else if (targetType === 'comment') {
            apiParams.commentId = targetId
        } else {
            apiParams.messageId = targetId
        }

        // Perform the reaction operation
        if (operation === 'add') {
            await client.reactions.add(apiParams)
        } else {
            await client.reactions.remove(apiParams)
        }

        // Build URL based on target type
        let targetUrl: string
        if (targetType === 'thread') {
            if (!threadId) {
                throw new Error('Thread ID is required for thread reactions')
            }
            targetUrl = getFullTwistURL({
                workspaceId,
                threadId,
                channelId,
            })
        } else if (targetType === 'comment') {
            if (!threadId) {
                throw new Error('Thread ID is required for comment reactions')
            }
            if (!channelId) {
                throw new Error('Channel ID is required for comment reactions')
            }
            targetUrl = getFullTwistURL({
                workspaceId,
                threadId,
                channelId,
                commentId: targetId,
            })
        } else {
            // message
            if (!conversationId) {
                throw new Error('Conversation ID is required for message reactions')
            }
            targetUrl = getFullTwistURL({
                workspaceId,
                conversationId,
                messageId: targetId,
            })
        }

        const lines: string[] = [
            `# Reaction ${operation === 'add' ? 'Added' : 'Removed'}`,
            '',
            `**Target:** ${targetType} ${targetId}`,
            `**Emoji:** ${emoji}`,
            `**Operation:** ${operation}`,
        ]

        const structuredContent: ReactStructured = {
            type: 'reaction_result',
            success: true,
            operation,
            targetType,
            targetId,
            emoji,
            targetUrl,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof ReactOutputSchema.shape>

export { react, type ReactStructured }
