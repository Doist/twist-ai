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
import { react } from '../react.js'

// Mock the Twist API
const mockTwistApi = {
    threads: {
        getThread: jest.fn(),
    },
    comments: {
        getComment: jest.fn(),
    },
    conversationMessages: {
        getMessage: jest.fn(),
    },
    conversations: {
        getConversation: jest.fn(),
    },
    reactions: {
        add: jest.fn(),
        remove: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { REACT } = ToolNames

describe(`${REACT} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('adding reactions', () => {
        it('should add reaction to a thread', async () => {
            mockTwistApi.threads.getThread.mockResolvedValue(
                createMockThread({ id: TEST_IDS.THREAD_1 }),
            )
            mockTwistApi.reactions.add.mockResolvedValue(undefined)

            const result = await react.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    emoji: '👍',
                    operation: 'add',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.getThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1)
            expect(mockTwistApi.reactions.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    threadId: TEST_IDS.THREAD_1,
                    reaction: '👍',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual({
                type: 'reaction_result',
                success: true,
                operation: 'add',
                targetType: 'thread',
                targetId: TEST_IDS.THREAD_1,
                emoji: '👍',
                targetUrl: expect.stringContaining('twist.com'),
                appliedFilters: {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    emoji: '👍',
                    operation: 'add',
                },
            })
        })

        it('should add reaction to a comment', async () => {
            mockTwistApi.comments.getComment.mockResolvedValue(
                createMockComment({ id: TEST_IDS.COMMENT_1, threadId: TEST_IDS.THREAD_1 }),
            )
            mockTwistApi.threads.getThread.mockResolvedValue(
                createMockThread({ id: TEST_IDS.THREAD_1 }),
            )
            mockTwistApi.reactions.add.mockResolvedValue(undefined)

            const result = await react.execute(
                {
                    targetType: 'comment',
                    targetId: TEST_IDS.COMMENT_1,
                    emoji: '❤️',
                    operation: 'add',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.getComment).toHaveBeenCalledWith(TEST_IDS.COMMENT_1)
            expect(mockTwistApi.threads.getThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1)
            expect(mockTwistApi.reactions.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    commentId: TEST_IDS.COMMENT_1,
                    reaction: '❤️',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should add reaction to a message', async () => {
            mockTwistApi.conversationMessages.getMessage.mockResolvedValue(
                createMockConversationMessage({
                    id: TEST_IDS.MESSAGE_1,
                    conversationId: TEST_IDS.CONVERSATION_1,
                }),
            )
            mockTwistApi.conversations.getConversation.mockResolvedValue(
                createMockConversation({ id: TEST_IDS.CONVERSATION_1 }),
            )
            mockTwistApi.reactions.add.mockResolvedValue(undefined)

            const result = await react.execute(
                {
                    targetType: 'message',
                    targetId: TEST_IDS.MESSAGE_1,
                    emoji: '🎉',
                    operation: 'add',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.getMessage).toHaveBeenCalledWith(
                TEST_IDS.MESSAGE_1,
            )
            expect(mockTwistApi.conversations.getConversation).toHaveBeenCalledWith(
                TEST_IDS.CONVERSATION_1,
            )
            expect(mockTwistApi.reactions.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageId: TEST_IDS.MESSAGE_1,
                    reaction: '🎉',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('removing reactions', () => {
        it('should remove reaction from a thread', async () => {
            mockTwistApi.threads.getThread.mockResolvedValue(
                createMockThread({ id: TEST_IDS.THREAD_1 }),
            )
            mockTwistApi.reactions.remove.mockResolvedValue(undefined)

            const result = await react.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    emoji: '👍',
                    operation: 'remove',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.getThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1)
            expect(mockTwistApi.reactions.remove).toHaveBeenCalledWith(
                expect.objectContaining({
                    threadId: TEST_IDS.THREAD_1,
                    reaction: '👍',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should remove reaction from a comment', async () => {
            mockTwistApi.comments.getComment.mockResolvedValue(
                createMockComment({ id: TEST_IDS.COMMENT_1, threadId: TEST_IDS.THREAD_1 }),
            )
            mockTwistApi.threads.getThread.mockResolvedValue(
                createMockThread({ id: TEST_IDS.THREAD_1 }),
            )
            mockTwistApi.reactions.remove.mockResolvedValue(undefined)

            const result = await react.execute(
                {
                    targetType: 'comment',
                    targetId: TEST_IDS.COMMENT_1,
                    emoji: '❤️',
                    operation: 'remove',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.getComment).toHaveBeenCalledWith(TEST_IDS.COMMENT_1)
            expect(mockTwistApi.threads.getThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1)
            expect(mockTwistApi.reactions.remove).toHaveBeenCalledWith(
                expect.objectContaining({
                    commentId: TEST_IDS.COMMENT_1,
                    reaction: '❤️',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should remove reaction from a message', async () => {
            mockTwistApi.conversationMessages.getMessage.mockResolvedValue(
                createMockConversationMessage({
                    id: TEST_IDS.MESSAGE_1,
                    conversationId: TEST_IDS.CONVERSATION_1,
                }),
            )
            mockTwistApi.conversations.getConversation.mockResolvedValue(
                createMockConversation({ id: TEST_IDS.CONVERSATION_1 }),
            )
            mockTwistApi.reactions.remove.mockResolvedValue(undefined)

            const result = await react.execute(
                {
                    targetType: 'message',
                    targetId: TEST_IDS.MESSAGE_1,
                    emoji: '🎉',
                    operation: 'remove',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.getMessage).toHaveBeenCalledWith(
                TEST_IDS.MESSAGE_1,
            )
            expect(mockTwistApi.conversations.getConversation).toHaveBeenCalledWith(
                TEST_IDS.CONVERSATION_1,
            )
            expect(mockTwistApi.reactions.remove).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageId: TEST_IDS.MESSAGE_1,
                    reaction: '🎉',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate add reaction errors', async () => {
            mockTwistApi.threads.getThread.mockResolvedValue(
                createMockThread({ id: TEST_IDS.THREAD_1 }),
            )
            const apiError = new Error('Thread not found')
            mockTwistApi.reactions.add.mockRejectedValue(apiError)

            await expect(
                react.execute(
                    {
                        targetType: 'thread',
                        targetId: TEST_IDS.THREAD_1,
                        emoji: '👍',
                        operation: 'add',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Thread not found')
        })

        it('should propagate remove reaction errors', async () => {
            mockTwistApi.comments.getComment.mockResolvedValue(
                createMockComment({ id: TEST_IDS.COMMENT_1, threadId: TEST_IDS.THREAD_1 }),
            )
            mockTwistApi.threads.getThread.mockResolvedValue(
                createMockThread({ id: TEST_IDS.THREAD_1 }),
            )
            const apiError = new Error('Reaction not found')
            mockTwistApi.reactions.remove.mockRejectedValue(apiError)

            await expect(
                react.execute(
                    {
                        targetType: 'comment',
                        targetId: TEST_IDS.COMMENT_1,
                        emoji: '❤️',
                        operation: 'remove',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Reaction not found')
        })
    })
})
