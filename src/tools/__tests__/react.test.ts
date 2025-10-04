import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { react } from '../react.js'

// Mock the Twist API
const mockTwistApi = {
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

            expect(mockTwistApi.reactions.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    threadId: TEST_IDS.THREAD_1,
                    emoji: '👍',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should add reaction to a comment', async () => {
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

            expect(mockTwistApi.reactions.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    commentId: TEST_IDS.COMMENT_1,
                    emoji: '❤️',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should add reaction to a message', async () => {
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

            expect(mockTwistApi.reactions.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversationMessageId: TEST_IDS.MESSAGE_1,
                    emoji: '🎉',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('removing reactions', () => {
        it('should remove reaction from a thread', async () => {
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

            expect(mockTwistApi.reactions.remove).toHaveBeenCalledWith(
                expect.objectContaining({
                    threadId: TEST_IDS.THREAD_1,
                    emoji: '👍',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should remove reaction from a comment', async () => {
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

            expect(mockTwistApi.reactions.remove).toHaveBeenCalledWith(
                expect.objectContaining({
                    commentId: TEST_IDS.COMMENT_1,
                    emoji: '❤️',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should remove reaction from a message', async () => {
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

            expect(mockTwistApi.reactions.remove).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversationMessageId: TEST_IDS.MESSAGE_1,
                    emoji: '🎉',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate add reaction errors', async () => {
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
