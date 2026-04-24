import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { createMockComment, extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { updateComment } from '../update-comment.js'

const mockTwistApi = {
    comments: {
        updateComment: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { UPDATE_COMMENT } = ToolNames

describe(`${UPDATE_COMMENT} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('updating comments', () => {
        it('should update a comment content', async () => {
            const mockComment = createMockComment({
                content: 'Updated comment content',
                lastEdited: new Date('2025-02-03T12:34:56Z'),
            })
            mockTwistApi.comments.updateComment.mockResolvedValue(mockComment)

            const result = await updateComment.execute(
                {
                    id: TEST_IDS.COMMENT_1,
                    content: 'Updated comment content',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.comments.updateComment).toHaveBeenCalledWith({
                id: TEST_IDS.COMMENT_1,
                content: 'Updated comment content',
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_comment_result',
                    success: true,
                    commentId: mockComment.id,
                    threadId: mockComment.threadId,
                    channelId: mockComment.channelId,
                    workspaceId: mockComment.workspaceId,
                    content: 'Updated comment content',
                    commentUrl: expect.stringContaining('twist.com'),
                    lastEdited: '2025-02-03T12:34:56.000Z',
                }),
            )
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error('Comment not found')
            mockTwistApi.comments.updateComment.mockRejectedValue(apiError)

            await expect(
                updateComment.execute(
                    {
                        id: TEST_IDS.COMMENT_1,
                        content: 'Updated content',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Comment not found')
        })
    })
})
