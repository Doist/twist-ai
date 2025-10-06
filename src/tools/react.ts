import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
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
}

const react = {
    name: ToolNames.REACT,
    description:
        'Add or remove an emoji reaction on a thread, comment, or conversation message. Use targetType to specify the type of object (thread, comment, or message) and targetId for the ID.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { targetType, targetId, emoji, operation } = args

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
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { react, type ReactStructured }
