import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockComment,
    createMockConversationMessage,
    createMockThread,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { updateObject } from '../update-object.js'

const mockTwistApi = {
    threads: {
        updateThread: jest.fn(),
    },
    comments: {
        updateComment: jest.fn(),
    },
    conversationMessages: {
        updateMessage: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { UPDATE_OBJECT } = ToolNames

describe(`${UPDATE_OBJECT} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('targetType: thread', () => {
        it('should update a thread title and content', async () => {
            const mockThread = createMockThread({
                title: 'Updated Title',
                content: 'Updated content',
                lastEdited: new Date('2025-02-03T12:34:56Z'),
            })
            mockTwistApi.threads.updateThread.mockResolvedValue(mockThread)

            const result = await updateObject.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    title: 'Updated Title',
                    content: 'Updated content',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.updateThread).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                title: 'Updated Title',
                content: 'Updated content',
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_thread_result',
                    success: true,
                    threadId: mockThread.id,
                    title: 'Updated Title',
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    content: 'Updated content',
                    threadUrl: expect.stringContaining('twist.com'),
                    lastEdited: '2025-02-03T12:34:56.000Z',
                }),
            )
        })

        it('should update only the thread title', async () => {
            const mockThread = createMockThread({ title: 'New Title Only' })
            mockTwistApi.threads.updateThread.mockResolvedValue(mockThread)

            const result = await updateObject.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    title: 'New Title Only',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.updateThread).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                title: 'New Title Only',
                content: undefined,
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_thread_result',
                    success: true,
                    threadId: mockThread.id,
                    title: 'New Title Only',
                    content: mockThread.content,
                }),
            )
        })

        it('should update only the thread content', async () => {
            const mockThread = createMockThread({ content: 'New content only' })
            mockTwistApi.threads.updateThread.mockResolvedValue(mockThread)

            const result = await updateObject.execute(
                {
                    targetType: 'thread',
                    targetId: TEST_IDS.THREAD_1,
                    content: 'New content only',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.updateThread).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                title: undefined,
                content: 'New content only',
            })

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should throw when neither title nor content is provided', async () => {
            await expect(
                updateObject.execute(
                    { targetType: 'thread', targetId: TEST_IDS.THREAD_1 },
                    mockTwistApi,
                ),
            ).rejects.toThrow('At least one of `title` or `content` must be provided.')

            expect(mockTwistApi.threads.updateThread).not.toHaveBeenCalled()
        })

        it('should propagate API errors', async () => {
            mockTwistApi.threads.updateThread.mockRejectedValue(new Error('Thread not found'))

            await expect(
                updateObject.execute(
                    {
                        targetType: 'thread',
                        targetId: TEST_IDS.THREAD_1,
                        title: 'Updated Title',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Thread not found')
        })
    })

    describe('targetType: comment', () => {
        it('should update a comment content', async () => {
            const mockComment = createMockComment({
                content: 'Updated comment content',
                lastEdited: new Date('2025-02-03T12:34:56Z'),
            })
            mockTwistApi.comments.updateComment.mockResolvedValue(mockComment)

            const result = await updateObject.execute(
                {
                    targetType: 'comment',
                    targetId: TEST_IDS.COMMENT_1,
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

        it('should throw when content is missing', async () => {
            await expect(
                updateObject.execute(
                    { targetType: 'comment', targetId: TEST_IDS.COMMENT_1 },
                    mockTwistApi,
                ),
            ).rejects.toThrow('`content` is required when targetType is "comment".')

            expect(mockTwistApi.comments.updateComment).not.toHaveBeenCalled()
        })

        it('should propagate API errors', async () => {
            mockTwistApi.comments.updateComment.mockRejectedValue(new Error('Comment not found'))

            await expect(
                updateObject.execute(
                    {
                        targetType: 'comment',
                        targetId: TEST_IDS.COMMENT_1,
                        content: 'Updated content',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Comment not found')
        })
    })

    describe('targetType: message', () => {
        it('should update a conversation message content', async () => {
            const mockMessage = createMockConversationMessage({
                content: 'Updated message content',
                lastEdited: new Date('2025-02-03T12:34:56Z'),
            })
            mockTwistApi.conversationMessages.updateMessage.mockResolvedValue(mockMessage)

            const result = await updateObject.execute(
                {
                    targetType: 'message',
                    targetId: TEST_IDS.MESSAGE_1,
                    content: 'Updated message content',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.updateMessage).toHaveBeenCalledWith({
                id: TEST_IDS.MESSAGE_1,
                content: 'Updated message content',
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_message_result',
                    success: true,
                    messageId: mockMessage.id,
                    conversationId: mockMessage.conversationId,
                    workspaceId: mockMessage.workspaceId,
                    content: 'Updated message content',
                    messageUrl: expect.stringContaining('twist.com'),
                    lastEdited: '2025-02-03T12:34:56.000Z',
                }),
            )
        })

        it('should omit lastEdited when not returned by the API', async () => {
            const mockMessage = createMockConversationMessage({
                content: 'Edited again',
                lastEdited: null,
            })
            mockTwistApi.conversationMessages.updateMessage.mockResolvedValue(mockMessage)

            const result = await updateObject.execute(
                {
                    targetType: 'message',
                    targetId: TEST_IDS.MESSAGE_1,
                    content: 'Edited again',
                },
                mockTwistApi,
            )

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_message_result',
                    success: true,
                    lastEdited: undefined,
                }),
            )
        })

        it('should throw when content is missing', async () => {
            await expect(
                updateObject.execute(
                    { targetType: 'message', targetId: TEST_IDS.MESSAGE_1 },
                    mockTwistApi,
                ),
            ).rejects.toThrow('`content` is required when targetType is "message".')

            expect(mockTwistApi.conversationMessages.updateMessage).not.toHaveBeenCalled()
        })

        it('should propagate API errors', async () => {
            mockTwistApi.conversationMessages.updateMessage.mockRejectedValue(
                new Error('Message not found'),
            )

            await expect(
                updateObject.execute(
                    {
                        targetType: 'message',
                        targetId: TEST_IDS.MESSAGE_1,
                        content: 'Updated content',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Message not found')
        })
    })

    describe('cross-type validation', () => {
        it('should reject title for comment targetType', async () => {
            await expect(
                updateObject.execute(
                    {
                        targetType: 'comment',
                        targetId: TEST_IDS.COMMENT_1,
                        content: 'updated',
                        title: 'oops',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('`title` is only valid when targetType is "thread".')

            expect(mockTwistApi.comments.updateComment).not.toHaveBeenCalled()
        })

        it('should reject title for message targetType', async () => {
            await expect(
                updateObject.execute(
                    {
                        targetType: 'message',
                        targetId: TEST_IDS.MESSAGE_1,
                        content: 'updated',
                        title: 'oops',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('`title` is only valid when targetType is "thread".')

            expect(mockTwistApi.conversationMessages.updateMessage).not.toHaveBeenCalled()
        })
    })
})
