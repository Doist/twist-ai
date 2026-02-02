import {
    ChannelSchema,
    CommentSchema,
    ConversationMessageSchema,
    ConversationSchema,
    InboxThreadSchema,
    SearchResultSchema,
    ThreadSchema,
    UnreadConversationSchema,
    UnreadThreadSchema,
    UserSchema,
    WorkspaceSchema,
    WorkspaceUserSchema,
} from '@doist/twist-sdk'
import { z } from 'zod'

// Re-export SDK schemas for direct use
export {
    ChannelSchema,
    CommentSchema,
    ConversationMessageSchema,
    ConversationSchema,
    InboxThreadSchema,
    SearchResultSchema,
    ThreadSchema,
    UnreadConversationSchema,
    UnreadThreadSchema,
    UserSchema,
    WorkspaceSchema,
    WorkspaceUserSchema,
}

// Custom schemas for tool-specific structured outputs

/**
 * Schema for load-thread tool output
 */
export const LoadThreadOutputSchema = z.object({
    type: z.literal('thread_data'),
    thread: z.object({
        id: z.number(),
        title: z.string(),
        content: z.string(),
        channelId: z.number(),
        channelName: z.string().optional(),
        workspaceId: z.number(),
        creator: z.number(),
        creatorName: z.string().optional(),
        posted: z.string(),
        commentCount: z.number(),
        isArchived: z.boolean(),
        inInbox: z.boolean(),
        participants: z.array(z.number()).optional(),
        participantNames: z.array(z.string()).optional(),
        threadUrl: z.string(),
    }),
    comments: z.array(
        z.object({
            id: z.number(),
            content: z.string(),
            creator: z.number(),
            creatorName: z.string().optional(),
            threadId: z.number(),
            posted: z.string(),
            commentUrl: z.string(),
        }),
    ),
    totalComments: z.number(),
})

/**
 * Schema for load-conversation tool output
 */
export const LoadConversationOutputSchema = z.object({
    type: z.literal('conversation_data'),
    conversation: z.object({
        id: z.number(),
        workspaceId: z.number(),
        userIds: z.array(z.number()),
        archived: z.boolean(),
        lastActive: z.string(),
        title: z.string().optional(),
        conversationUrl: z.string(),
    }),
    messages: z.array(
        z.object({
            id: z.number(),
            content: z.string(),
            creatorId: z.number(),
            creatorName: z.string().optional(),
            conversationId: z.number(),
            posted: z.string(),
            messageUrl: z.string(),
        }),
    ),
    totalMessages: z.number(),
})

/**
 * Schema for fetch-inbox tool output
 */
export const FetchInboxOutputSchema = z.object({
    type: z.literal('inbox_data'),
    workspaceId: z.number(),
    threads: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            channelId: z.number(),
            channelName: z.string().optional(),
            creator: z.number(),
            isUnread: z.boolean(),
            isStarred: z.boolean(),
            threadUrl: z.string(),
        }),
    ),
    conversations: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            userIds: z.array(z.number()),
            participantNames: z.array(z.string()),
            isUnread: z.boolean(),
            conversationUrl: z.string(),
        }),
    ),
    unreadCount: z.number(),
    unreadThreads: z.array(z.any()),
    unreadConversations: z.array(z.any()),
    totalThreads: z.number(),
    totalConversations: z.number(),
})

/**
 * Schema for search-content tool output
 */
export const SearchContentOutputSchema = z.object({
    type: z.literal('search_results'),
    query: z.string(),
    workspaceId: z.number(),
    results: z.array(
        z.object({
            id: z.string(),
            type: z.enum(['thread', 'comment', 'message']),
            content: z.string(),
            creatorId: z.number(),
            creatorName: z.string().optional(),
            created: z.string(),
            threadId: z.number().optional(),
            conversationId: z.number().optional(),
            channelId: z.number().optional(),
            channelName: z.string().optional(),
            workspaceId: z.number(),
            url: z.string(),
        }),
    ),
    totalResults: z.number(),
    hasMore: z.boolean(),
    cursor: z.string().optional(),
})

/**
 * Schema for get-workspaces tool output
 */
export const GetWorkspacesOutputSchema = z.object({
    type: z.literal('get_workspaces'),
    workspaces: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            creator: z.number(),
            creatorName: z.string().optional(),
            created: z.string(),
            workspaceUrl: z.string().url(),
            defaultChannel: z.number().optional(),
            defaultChannelName: z.string().optional(),
            defaultChannelUrl: z.string().url().optional(),
            defaultConversation: z.number().optional(),
            defaultConversationTitle: z.string().optional(),
            defaultConversationUrl: z.string().url().optional(),
            plan: z.string().optional(), // WorkspacePlan is a string union
            avatarId: z.string().optional(),
            avatarUrls: z
                .object({
                    s35: z.string(),
                    s60: z.string(),
                    s195: z.string(),
                    s640: z.string(),
                })
                .optional(),
        }),
    ),
})

/**
 * Schema for get-users tool output
 */
export const GetUsersOutputSchema = z.object({
    type: z.literal('get_users'),
    workspaceId: z.number(),
    users: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            shortName: z.string(),
            email: z.string().optional(),
            userType: z.string(), // UserType is a string type
            bot: z.boolean(),
            removed: z.boolean(),
            timezone: z.string(),
        }),
    ),
    totalUsers: z.number(),
    filteredUsers: z.number(),
})

/**
 * Schema for user-info tool output
 */
export const UserInfoOutputSchema = z.object({
    type: z.literal('user_info'),
    userId: z.number(),
    name: z.string(),
    email: z.string(),
    timezone: z.string(),
    bot: z.boolean(),
    defaultWorkspace: z.number().nullable(),
})

/**
 * Schema for build-link tool output
 */
export const BuildLinkOutputSchema = z.object({
    type: z.literal('link_data'),
    url: z.string(),
    linkType: z.enum(['conversation', 'message', 'thread', 'comment']),
    params: z.object({
        workspaceId: z.number(),
        conversationId: z.number().optional(),
        messageId: z.union([z.number(), z.string()]).optional(),
        channelId: z.number().optional(),
        threadId: z.number().optional(),
        commentId: z.union([z.number(), z.string()]).optional(),
    }),
})

/**
 * Schema for reply tool output
 */
export const ReplyOutputSchema = z.object({
    type: z.literal('reply_result'),
    success: z.boolean(),
    targetType: z.enum(['thread', 'conversation']),
    targetId: z.number(),
    replyId: z.number(),
    content: z.string(),
    created: z.string(),
    replyUrl: z.string(),
})

/**
 * Schema for react tool output
 */
export const ReactOutputSchema = z.object({
    type: z.literal('reaction_result'),
    success: z.boolean(),
    operation: z.enum(['add', 'remove']),
    targetType: z.enum(['thread', 'comment', 'message']),
    targetId: z.number(),
    emoji: z.string(),
    targetUrl: z.string(),
})

/**
 * Schema for mark-done tool output
 */
export const MarkDoneOutputSchema = z.object({
    type: z.literal('mark_done_result'),
    itemType: z.enum(['thread', 'conversation']),
    mode: z.enum(['individual', 'bulk']),
    completed: z.array(z.number()),
    failed: z.array(
        z.object({
            item: z.number(),
            error: z.string(),
        }),
    ),
    totalRequested: z.number(),
    successCount: z.number(),
    failureCount: z.number(),
    operations: z.object({
        markRead: z.boolean(),
        archive: z.boolean(),
        clearUnread: z.boolean(),
    }),
    selectors: z
        .object({
            workspaceId: z.number().optional(),
            channelId: z.number().optional(),
        })
        .optional(),
})

/**
 * Union of all possible structured outputs for type safety
 */
export const StructuredOutputSchema = z.union([
    LoadThreadOutputSchema,
    LoadConversationOutputSchema,
    FetchInboxOutputSchema,
    SearchContentOutputSchema,
    GetWorkspacesOutputSchema,
    GetUsersOutputSchema,
    UserInfoOutputSchema,
    BuildLinkOutputSchema,
    ReplyOutputSchema,
    ReactOutputSchema,
    MarkDoneOutputSchema,
])

/**
 * Type definitions for the structured outputs
 */
export type LoadThreadOutput = z.infer<typeof LoadThreadOutputSchema>
export type LoadConversationOutput = z.infer<typeof LoadConversationOutputSchema>
export type FetchInboxOutput = z.infer<typeof FetchInboxOutputSchema>
export type SearchContentOutput = z.infer<typeof SearchContentOutputSchema>
export type GetWorkspacesOutput = z.infer<typeof GetWorkspacesOutputSchema>
export type GetUsersOutput = z.infer<typeof GetUsersOutputSchema>
export type UserInfoOutput = z.infer<typeof UserInfoOutputSchema>
export type BuildLinkOutput = z.infer<typeof BuildLinkOutputSchema>
export type ReplyOutput = z.infer<typeof ReplyOutputSchema>
export type ReactOutput = z.infer<typeof ReactOutputSchema>
export type MarkDoneOutput = z.infer<typeof MarkDoneOutputSchema>
export type StructuredOutput = z.infer<typeof StructuredOutputSchema>
