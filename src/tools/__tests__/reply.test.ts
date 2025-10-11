import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockComment,
    createMockConversation,
    createMockConversationMessage,
    createMockThread,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { reply } from '../reply.js'

// Mock the Twist API
const mockTwistApi = {
    threads: {
        getThread: jest.fn(),
    },
    comments: {
        createComment: jest.fn(),
    },
    conversations: {
        getConversation: jest.fn(),
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
            const mockThread = createMockThread({ id: TEST_IDS.THREAD_1 })
            const mockComment = createMockComment()
            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
            mockTwistApi.comments.createComment.mockResolvedValue(mockComment)

            const result = await reply.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'This is my reply',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.getThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1)
            expect(mockTwistApi.comments.createComment).toHaveBeenCalledWith({
                threadId: TEST_IDS.THREAD_1,
                content: 'This is my reply',
                recipients: undefined,
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
        })

        it('should post a comment with recipients', async () => {
            const mockThread = createMockThread({ id: TEST_IDS.THREAD_1 })
            const mockComment = createMockComment()
            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
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
            })

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('replying to conversations', () => {
        it('should post a message to a conversation', async () => {
            const mockConversation = createMockConversation({ id: TEST_IDS.CONVERSATION_1 })
            const mockMessage = createMockConversationMessage()
            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.createMessage.mockResolvedValue(mockMessage)

            const result = await reply.execute(
                {
                    targetType: 'conversation',
                    targetId: TEST_IDS.CONVERSATION_1,
                    content: 'This is my message',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversations.getConversation).toHaveBeenCalledWith(
                TEST_IDS.CONVERSATION_1,
            )
            expect(mockTwistApi.conversationMessages.createMessage).toHaveBeenCalledWith({
                conversationId: TEST_IDS.CONVERSATION_1,
                content: 'This is my message',
            })

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate thread reply errors', async () => {
            const mockThread = createMockThread({ id: TEST_IDS.THREAD_1 })
            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
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
            const mockConversation = createMockConversation({ id: TEST_IDS.CONVERSATION_1 })
            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
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
