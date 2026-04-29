import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { deleteObject } from '../delete-object.js'

const mockTwistApi = {
    threads: {
        deleteThread: jest.fn(),
    },
    comments: {
        deleteComment: jest.fn(),
    },
    conversationMessages: {
        deleteMessage: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { DELETE_OBJECT } = ToolNames

describe(`${DELETE_OBJECT} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('targetType: thread', () => {
        it('should delete a thread by ID', async () => {
            ;(mockTwistApi.threads.deleteThread as jest.Mock).mockResolvedValue(undefined as never)

            const result = await deleteObject.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.deleteThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1)
            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual({
                type: 'delete_thread_result',
                success: true,
                targetType: 'thread',
                threadId: TEST_IDS.THREAD_1,
            })
        })

        it('should propagate API errors when deleting a thread', async () => {
            ;(mockTwistApi.threads.deleteThread as jest.Mock).mockRejectedValue(
                new Error('Thread not found') as never,
            )

            await expect(
                deleteObject.execute(
                    {
                        targetType: 'thread',
                        targetId: TEST_IDS.THREAD_1,
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Thread not found')
        })
    })

    describe('targetType: comment', () => {
        it('should delete a comment by ID', async () => {
            ;(mockTwistApi.comments.deleteComment as jest.Mock).mockResolvedValue(
                undefined as never,
            )

            const result = await deleteObject.execute(
                {
                    targetType: 'comment',
                    targetId: TEST_IDS.COMMENT_1,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.deleteComment).toHaveBeenCalledWith(TEST_IDS.COMMENT_1)
            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual({
                type: 'delete_comment_result',
                success: true,
                targetType: 'comment',
                commentId: TEST_IDS.COMMENT_1,
            })
        })

        it('should propagate API errors when deleting a comment', async () => {
            ;(mockTwistApi.comments.deleteComment as jest.Mock).mockRejectedValue(
                new Error('Comment not found') as never,
            )

            await expect(
                deleteObject.execute(
                    {
                        targetType: 'comment',
                        targetId: TEST_IDS.COMMENT_1,
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Comment not found')
        })
    })

    describe('targetType: message', () => {
        it('should delete a conversation message by ID', async () => {
            ;(mockTwistApi.conversationMessages.deleteMessage as jest.Mock).mockResolvedValue(
                undefined as never,
            )

            const result = await deleteObject.execute(
                {
                    targetType: 'message',
                    targetId: TEST_IDS.MESSAGE_1,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.deleteMessage).toHaveBeenCalledWith(
                TEST_IDS.MESSAGE_1,
            )
            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual({
                type: 'delete_message_result',
                success: true,
                targetType: 'message',
                messageId: TEST_IDS.MESSAGE_1,
            })
        })

        it('should propagate API errors when deleting a message', async () => {
            ;(mockTwistApi.conversationMessages.deleteMessage as jest.Mock).mockRejectedValue(
                new Error('Message not found') as never,
            )

            await expect(
                deleteObject.execute(
                    {
                        targetType: 'message',
                        targetId: TEST_IDS.MESSAGE_1,
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Message not found')
        })
    })

    describe('routing', () => {
        it('should only call the matching SDK method for each targetType', async () => {
            ;(mockTwistApi.threads.deleteThread as jest.Mock).mockResolvedValue(undefined as never)
            ;(mockTwistApi.comments.deleteComment as jest.Mock).mockResolvedValue(
                undefined as never,
            )
            ;(mockTwistApi.conversationMessages.deleteMessage as jest.Mock).mockResolvedValue(
                undefined as never,
            )

            await deleteObject.execute(
                { targetType: 'thread', targetId: TEST_IDS.THREAD_1 },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.deleteThread).toHaveBeenCalledTimes(1)
            expect(mockTwistApi.comments.deleteComment).not.toHaveBeenCalled()
            expect(mockTwistApi.conversationMessages.deleteMessage).not.toHaveBeenCalled()
        })
    })
})
