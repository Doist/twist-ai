import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockComment,
    createMockConversationMessage,
    extractStructuredContent,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { reply } from '../reply.js'

// Mock the Twist API
const mockTwistApi = {
    comments: {
        createComment: jest.fn(),
    },
    conversationMessages: {
        createMessage: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { REPLY } = ToolNames

describe(`${REPLY} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('replying to threads', () => {
        it('should post a comment to a thread', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'This is my reply',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'This is my reply',
                recipients: undefined,
                groups: undefined,
                notifyAudience: 'thread',
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'reply_result',
                    success: true,
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'This is my reply',
                    replyUrl: expect.stringContaining('twist.com'),
                }),
            )
            expect(structuredContent?.replyId).toBe(mockComment.id)
            expect(structuredContent?.created).toBe('2024-01-01T00:00:00.000Z')
            expect(structuredContent?.notifyAudience).toBe('thread')
        })

        it('should post a comment with recipients', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'Notifying users',
                    recipients: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'Notifying users',
                recipients: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                groups: undefined,
                notifyAudience: undefined,
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.recipients).toEqual([TEST_IDS.USER_1, TEST_IDS.USER_2])
            expect(structuredContent).not.toHaveProperty('groups')
            expect(structuredContent).not.toHaveProperty('notifyAudience')
        })

        it('should post a comment with groups', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'Notifying groups',
                    groups: [100, 200],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'Notifying groups',
                recipients: undefined,
                groups: [100, 200],
                notifyAudience: undefined,
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.groups).toEqual([100, 200])
            expect(structuredContent).not.toHaveProperty('recipients')
            expect(structuredContent).not.toHaveProperty('notifyAudience')
        })

        it('should default to notifyAudience: thread when groups are empty', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'Notifying default recipients',
                    groups: [],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'Notifying default recipients',
                recipients: undefined,
                groups: undefined,
                notifyAudience: 'thread',
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.notifyAudience).toBe('thread')
            expect(structuredContent).not.toHaveProperty('groups')
        })

        it('should post a comment with recipients and groups', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'Notifying users and groups',
                    recipients: [TEST_IDS.USER_1],
                    groups: [100],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'Notifying users and groups',
                recipients: [TEST_IDS.USER_1],
                groups: [100],
                notifyAudience: undefined,
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.recipients).toEqual([TEST_IDS.USER_1])
            expect(structuredContent.groups).toEqual([100])
            expect(structuredContent).not.toHaveProperty('notifyAudience')
        })

        it('should pass through an explicit notifyAudience', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'Notifying the whole channel',
                    notifyAudience: 'channel',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'Notifying the whole channel',
                recipients: undefined,
                groups: undefined,
                notifyAudience: 'channel',
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.notifyAudience).toBe('channel')
        })

        it('should combine an explicit notifyAudience with recipients and groups', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'Notifying users, groups, and the whole channel',
                    recipients: [TEST_IDS.USER_1],
                    groups: [100],
                    notifyAudience: 'channel',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'Notifying users, groups, and the whole channel',
                recipients: [TEST_IDS.USER_1],
                groups: [100],
                notifyAudience: 'channel',
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.recipients).toEqual([TEST_IDS.USER_1])
            expect(structuredContent.groups).toEqual([100])
            expect(structuredContent.notifyAudience).toBe('channel')
        })

        it('should treat an explicit empty recipients array as user-provided and skip the default audience', async () => {
            const mockComment = createMockComment()
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'No one to notify explicitly',
                    recipients: [],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'No one to notify explicitly',
                recipients: [],
                groups: undefined,
                notifyAudience: undefined,
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.recipients).toEqual([])
            expect(structuredContent).not.toHaveProperty('groups')
            expect(structuredContent).not.toHaveProperty('notifyAudience')
        })
    })

    describe('replying to conversations', () => {
        it('should post a message to a conversation', async () => {
            const mockMessage = createMockConversationMessage()
            mockTwistApi.conversationMessages.createMessage.mockResolvedValue(mockMessage)

            const result = await reply.execute(
                {
                    targetType: 'conversation',
                    targetId: TEST_IDS.CONVERSATION_1,
                    content: 'This is my message',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.createMessage).toHaveBeenCalledWith({
                conversationId: TEST_IDS.CONVERSATION_1,
                content: 'This is my message',
            })

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should reject groups for conversation messages', async () => {
            await expect(
                reply.execute(
                    {
                        targetType: 'conversation',
                        targetId: TEST_IDS.CONVERSATION_1,
                        content: 'This is my message',
                        groups: [100],
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('groups can only be used when replying to a thread.')

            expect(mockTwistApi.conversationMessages.createMessage).not.toHaveBeenCalled()
        })

        it('should reject notifyAudience for conversation messages', async () => {
            await expect(
                reply.execute(
                    {
                        targetType: 'conversation',
                        targetId: TEST_IDS.CONVERSATION_1,
                        content: 'This is my message',
                        notifyAudience: 'channel',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('notifyAudience can only be used when replying to a thread.')

            expect(mockTwistApi.conversationMessages.createMessage).not.toHaveBeenCalled()
        })

        it('should reject empty groups for conversation messages', async () => {
            await expect(
                reply.execute(
                    {
                        targetType: 'conversation',
                        targetId: TEST_IDS.CONVERSATION_1,
                        content: 'This is my message',
                        groups: [],
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('groups can only be used when replying to a thread.')

            expect(mockTwistApi.conversationMessages.createMessage).not.toHaveBeenCalled()
        })

        it('should ignore recipients for conversation messages', async () => {
            const mockMessage = createMockConversationMessage()
            mockTwistApi.conversationMessages.createMessage.mockResolvedValue(mockMessage)

            const result = await reply.execute(
                {
                    targetType: 'conversation',
                    targetId: TEST_IDS.CONVERSATION_1,
                    content: 'This is my message',
                    recipients: [TEST_IDS.USER_1],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.createMessage).toHaveBeenCalledWith({
                conversationId: TEST_IDS.CONVERSATION_1,
                content: 'This is my message',
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent).not.toHaveProperty('groups')
        })
    })

    describe('error handling', () => {
        it('should propagate thread reply errors', async () => {
            const apiError = new Error('Thread not found')
            mockTwistApi.comments.createComment.mockRejectedValue(apiError)

            await expect(
                reply.execute(
                    {
                        targetType: 'thread',
                        targetId: TEST_IDS.THREAD_1,
                        content: 'Reply content',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Thread not found')
        })

        it('should propagate conversation reply errors', async () => {
            const apiError = new Error('Conversation not found')
            mockTwistApi.conversationMessages.createMessage.mockRejectedValue(apiError)

            await expect(
                reply.execute(
                    {
                        targetType: 'conversation',
                        targetId: TEST_IDS.CONVERSATION_1,
                        content: 'Message content',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Conversation not found')
        })
    })
})
