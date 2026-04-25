import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { deleteItem } from '../delete-item.js'

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

const { DELETE_ITEM } = ToolNames

describe(`${DELETE_ITEM} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should delete a thread', async () => {
        mockTwistApi.threads.deleteThread.mockResolvedValue(undefined)

        const result = await deleteItem.execute(
            { targetType: 'thread', targetId: TEST_IDS.THREAD_1 },
            mockTwistApi,
        )

        expect(mockTwistApi.threads.deleteThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1)
        expect(mockTwistApi.comments.deleteComment).not.toHaveBeenCalled()
        expect(mockTwistApi.conversationMessages.deleteMessage).not.toHaveBeenCalled()

        expect(extractTextContent(result)).toMatchSnapshot()
        expect(result.structuredContent).toEqual({
            type: 'delete_item_result',
            success: true,
            targetType: 'thread',
            targetId: TEST_IDS.THREAD_1,
        })
    })

    it('should delete a comment', async () => {
        mockTwistApi.comments.deleteComment.mockResolvedValue(undefined)

        const result = await deleteItem.execute(
            { targetType: 'comment', targetId: TEST_IDS.COMMENT_1 },
            mockTwistApi,
        )

        expect(mockTwistApi.comments.deleteComment).toHaveBeenCalledWith(TEST_IDS.COMMENT_1)
        expect(mockTwistApi.threads.deleteThread).not.toHaveBeenCalled()
        expect(mockTwistApi.conversationMessages.deleteMessage).not.toHaveBeenCalled()

        expect(result.structuredContent).toEqual({
            type: 'delete_item_result',
            success: true,
            targetType: 'comment',
            targetId: TEST_IDS.COMMENT_1,
        })
    })

    it('should delete a conversation message', async () => {
        mockTwistApi.conversationMessages.deleteMessage.mockResolvedValue(undefined)

        const result = await deleteItem.execute(
            { targetType: 'message', targetId: TEST_IDS.MESSAGE_1 },
            mockTwistApi,
        )

        expect(mockTwistApi.conversationMessages.deleteMessage).toHaveBeenCalledWith(
            TEST_IDS.MESSAGE_1,
        )
        expect(mockTwistApi.threads.deleteThread).not.toHaveBeenCalled()
        expect(mockTwistApi.comments.deleteComment).not.toHaveBeenCalled()

        expect(result.structuredContent).toEqual({
            type: 'delete_item_result',
            success: true,
            targetType: 'message',
            targetId: TEST_IDS.MESSAGE_1,
        })
    })

    it('should propagate thread delete errors', async () => {
        mockTwistApi.threads.deleteThread.mockRejectedValue(new Error('Forbidden'))

        await expect(
            deleteItem.execute({ targetType: 'thread', targetId: TEST_IDS.THREAD_1 }, mockTwistApi),
        ).rejects.toThrow('Forbidden')
    })

    it('should propagate comment delete errors', async () => {
        mockTwistApi.comments.deleteComment.mockRejectedValue(new Error('Not found'))

        await expect(
            deleteItem.execute(
                { targetType: 'comment', targetId: TEST_IDS.COMMENT_1 },
                mockTwistApi,
            ),
        ).rejects.toThrow('Not found')
    })

    it('should propagate message delete errors', async () => {
        mockTwistApi.conversationMessages.deleteMessage.mockRejectedValue(new Error('Forbidden'))

        await expect(
            deleteItem.execute(
                { targetType: 'message', targetId: TEST_IDS.MESSAGE_1 },
                mockTwistApi,
            ),
        ).rejects.toThrow('Forbidden')
    })
})
