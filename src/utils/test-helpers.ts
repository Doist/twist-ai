import type { Comment, Conversation, ConversationMessage, Thread, User } from '@doist/twist-sdk'
import type { getToolOutput } from '../mcp-helpers.js'

/**
 * Creates a mock Thread with all required properties and sensible defaults.
 * Pass only the properties you want to override for your specific test.
 */
export function createMockThread(overrides: Partial<Thread> = {}): Thread {
    return {
        id: 12345,
        title: 'Test Thread',
        content: 'Test thread content',
        channelId: 67890,
        workspaceId: 11111,
        creator: 22222,
        postedTs: 1704067200, // 2024-01-01 00:00:00 UTC
        lastUpdatedTs: 1704067200,
        pinned: false,
        snippet: 'Test thread content',
        snippetCreator: 22222,
        systemMessage: null,
        attachments: [],
        groups: [],
        reactions: {},
        recipients: [],
        commentCount: 0,
        isArchived: false,
        inInbox: true,
        starred: false,
        participants: [22222],
        ...overrides,
    }
}

/**
 * Creates a mock Comment with all required properties and sensible defaults.
 * Pass only the properties you want to override for your specific test.
 */
export function createMockComment(overrides: Partial<Comment> = {}): Comment {
    return {
        id: 54321,
        content: 'Test comment content',
        threadId: 12345,
        creator: 22222,
        postedTs: 1704067200, // 2024-01-01 00:00:00 UTC
        systemMessage: null,
        attachments: [],
        reactions: {},
        objIndex: 1,
        ...overrides,
    }
}

/**
 * Creates a mock Conversation with all required properties and sensible defaults.
 * Pass only the properties you want to override for your specific test.
 */
export function createMockConversation(overrides: Partial<Conversation> = {}): Conversation {
    return {
        id: 33333,
        workspaceId: 11111,
        userIds: [22222, 44444],
        messageCount: 0,
        lastObjIndex: 0,
        snippet: '',
        snippetCreators: [],
        archived: false,
        createdTs: 1704067200,
        lastActiveTs: 1704067200, // 2024-01-01 00:00:00 UTC
        ...overrides,
    }
}

/**
 * Creates a mock ConversationMessage with all required properties and sensible defaults.
 * Pass only the properties you want to override for your specific test.
 */
export function createMockConversationMessage(
    overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
    return {
        id: 98765,
        content: 'Test message content',
        creatorId: 22222,
        conversationId: 33333,
        createdTs: 1704067200, // 2024-01-01 00:00:00 UTC
        systemMessage: null,
        attachments: [],
        reactions: {},
        objIndex: 1,
        lastEditedTs: null,
        ...overrides,
    }
}

/**
 * Creates a mock User with all required properties and sensible defaults.
 * Pass only the properties you want to override for your specific test.
 */
export function createMockUser(overrides: Partial<User> = {}): User {
    return {
        id: TEST_IDS.USER_1,
        email: 'test@example.com',
        name: 'Test User',
        shortName: 'Test',
        avatarId: undefined,
        defaultWorkspace: TEST_IDS.WORKSPACE_1,
        awayMode: undefined,
        profession: undefined,
        contactInfo: undefined,
        timezone: 'UTC',
        snoozeUntil: undefined,
        offDays: [],
        bot: false,
        lang: 'en',
        removed: false,
        ...overrides,
    }
}

/**
 * Common error messages used across tests.
 */
export const TEST_ERRORS = {
    API_RATE_LIMIT: 'API Error: Rate limit exceeded',
    API_UNAUTHORIZED: 'API Error: Unauthorized',
    THREAD_NOT_FOUND: 'Thread not found',
    CONVERSATION_NOT_FOUND: 'Conversation not found',
} as const

/**
 * Extracts the text content from a tool output for snapshot testing.
 * This allows tests to match against just the text content while tools return structured output.
 */
export function extractTextContent(toolOutput: unknown): string {
    if (typeof toolOutput === 'string') {
        return toolOutput
    }

    if (typeof toolOutput === 'object' && toolOutput !== null && 'content' in toolOutput) {
        const output = toolOutput as { content: unknown }
        if (
            Array.isArray(output.content) &&
            output.content[0] &&
            typeof output.content[0] === 'object' &&
            output.content[0] !== null &&
            'type' in output.content[0] &&
            'text' in output.content[0] &&
            output.content[0].type === 'text'
        ) {
            return output.content[0].text as string
        }
    }

    throw new Error('Expected tool output to have text content')
}

/**
 * Extracts the structured content from a tool output for testing.
 * This handles both the new `structuredContent` field and legacy JSON-encoded content.
 */
export function extractStructuredContent(
    output: ReturnType<typeof getToolOutput>,
): Record<string, unknown> {
    // Check for new structuredContent field first
    if ('structuredContent' in output && typeof output.structuredContent === 'object') {
        return output.structuredContent as Record<string, unknown>
    }

    // Fall back to checking for JSON content in the content array
    if ('content' in output && Array.isArray(output.content)) {
        for (const item of output.content) {
            if (
                typeof item === 'object' &&
                item !== null &&
                'type' in item &&
                'text' in item &&
                item.type === 'text' &&
                'mimeType' in item &&
                item.mimeType === 'application/json'
            ) {
                return JSON.parse(item.text as string) as Record<string, unknown>
            }
        }
    }

    throw new Error('Expected tool output to have structured content')
}

/**
 * Common mock IDs used across tests for consistency.
 */
export const TEST_IDS = {
    THREAD_1: 12345,
    THREAD_2: 12346,
    THREAD_3: 12347,
    COMMENT_1: 54321,
    COMMENT_2: 54322,
    CONVERSATION_1: 33333,
    CONVERSATION_2: 33334,
    MESSAGE_1: 98765,
    MESSAGE_2: 98766,
    WORKSPACE_1: 11111,
    CHANNEL_1: 67890,
    USER_1: 22222,
    USER_2: 44444,
} as const

/**
 * Fixed date for consistent test snapshots.
 * Use this instead of new Date() in tests to avoid snapshot drift.
 */
export const TODAY = '2025-01-01' as const
