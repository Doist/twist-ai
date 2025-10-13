import { getCommentURL, getFullTwistURL, getMessageURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID.'),
    conversationId: z
        .number()
        .optional()
        .describe('The conversation ID (for direct message links).'),
    messageId: z
        .number()
        .or(z.string())
        .optional()
        .describe('The message ID (for specific message links within a conversation).'),
    channelId: z.number().optional().describe('The channel ID (for thread links in channels).'),
    threadId: z.number().optional().describe('The thread ID (for thread/comment links).'),
    commentId: z
        .number()
        .or(z.string())
        .optional()
        .describe('The comment ID (for specific comment links within a thread).'),
    fullUrl: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether to return a full URL (with https://twist.com) or relative path.'),
}

type BuildLinkStructured = {
    type: 'link_data'
    url: string
    linkType: 'conversation' | 'message' | 'thread' | 'comment'
    params: {
        workspaceId: number
        conversationId?: number
        messageId?: number | string
        channelId?: number
        threadId?: number
        commentId?: number | string
    }
    appliedFilters: z.infer<z.ZodObject<typeof ArgsSchema>>
}

const buildLink = {
    name: ToolNames.BUILD_LINK,
    description:
        'Build valid Twist URLs for threads, comments, conversations, or messages. Provide workspace_id and either (conversation_id + optional message_id) OR (thread_id + optional channel_id + optional comment_id).',
    parameters: ArgsSchema,
    async execute(args, _client) {
        const { workspaceId, conversationId, messageId, channelId, threadId, commentId, fullUrl } =
            args

        let url: string
        let linkType: 'conversation' | 'message' | 'thread' | 'comment'

        // Determine link type and build URL
        if (conversationId !== undefined) {
            if (messageId !== undefined) {
                // Message link
                linkType = 'message'
                const params = { workspaceId, conversationId, messageId }
                url = fullUrl ? getFullTwistURL(params) : getMessageURL(params)
            } else {
                // Conversation link
                linkType = 'conversation'
                const params = { workspaceId, conversationId }
                url = fullUrl
                    ? getFullTwistURL(params)
                    : getFullTwistURL(params).replace('https://twist.com', '')
            }
        } else if (threadId !== undefined) {
            if (commentId !== undefined) {
                // Comment link
                linkType = 'comment'
                if (channelId === undefined) {
                    throw new Error('channelId is required when building a comment link')
                }
                const params = { workspaceId, channelId, threadId, commentId }
                url = fullUrl ? getFullTwistURL(params) : getCommentURL(params)
            } else {
                // Thread link
                linkType = 'thread'
                const params = channelId
                    ? { workspaceId, channelId, threadId }
                    : { workspaceId, threadId }
                url = fullUrl
                    ? getFullTwistURL(params)
                    : getFullTwistURL(params).replace('https://twist.com', '')
            }
        } else {
            throw new Error('Must provide either conversationId OR threadId to build a link')
        }

        const structuredContent: BuildLinkStructured = {
            type: 'link_data',
            url,
            linkType,
            params: {
                workspaceId,
                conversationId,
                messageId,
                channelId,
                threadId,
                commentId,
            },
            appliedFilters: args,
        }

        return getToolOutput({
            textContent: url,
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { buildLink, type BuildLinkStructured }
