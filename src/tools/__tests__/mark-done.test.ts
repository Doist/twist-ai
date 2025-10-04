import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { markDone } from '../mark-done.js'

// Mock the Twist API
const mockTwistApi = {
    threads: {
        markRead: jest.fn(),
    },
    conversations: {
        markRead: jest.fn(),
        archiveConversation: jest.fn(),
    },
    inbox: {
        archiveThread: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { MARK_DONE } = ToolNames

describe(`${MARK_DONE} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('marking threads as done', () => {
        it('should mark all threads as done successfully', async () => {
            mockTwistApi.threads.markRead.mockResolvedValue(undefined)
            mockTwistApi.inbox.archiveThread.mockResolvedValue(undefined)

            const result = await markDone.execute(
                {
                    type: 'thread',
                    ids: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2, TEST_IDS.THREAD_3],
                    markRead: true,
                    archive: true,
                },
                mockTwistApi,
            )

            // Verify API was called for each thread
            expect(mockTwistApi.threads.markRead).toHaveBeenCalledTimes(3)
            expect(mockTwistApi.threads.markRead).toHaveBeenNthCalledWith(1, TEST_IDS.THREAD_1)
            expect(mockTwistApi.threads.markRead).toHaveBeenNthCalledWith(2, TEST_IDS.THREAD_2)
            expect(mockTwistApi.threads.markRead).toHaveBeenNthCalledWith(3, TEST_IDS.THREAD_3)

            expect(mockTwistApi.inbox.archiveThread).toHaveBeenCalledTimes(3)
            expect(mockTwistApi.inbox.archiveThread).toHaveBeenNthCalledWith(1, TEST_IDS.THREAD_1)
            expect(mockTwistApi.inbox.archiveThread).toHaveBeenNthCalledWith(2, TEST_IDS.THREAD_2)
            expect(mockTwistApi.inbox.archiveThread).toHaveBeenNthCalledWith(3, TEST_IDS.THREAD_3)

            // Verify result is a concise summary
            expect(extractTextContent(result)).toMatchSnapshot()

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    itemType: 'thread',
                    completed: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2, TEST_IDS.THREAD_3],
                    failed: [],
                    totalRequested: 3,
                    successCount: 3,
                    failureCount: 0,
                    operations: {
                        markRead: true,
                        archive: true,
                    },
                }),
            )
        })

        it('should mark thread as read only', async () => {
            mockTwistApi.threads.markRead.mockResolvedValue(undefined)

            const result = await markDone.execute(
                {
                    type: 'thread',
                    ids: [TEST_IDS.THREAD_1],
                    markRead: true,
                    archive: false,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.markRead).toHaveBeenCalledTimes(1)
            expect(mockTwistApi.inbox.archiveThread).not.toHaveBeenCalled()

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should archive thread only', async () => {
            mockTwistApi.inbox.archiveThread.mockResolvedValue(undefined)

            const result = await markDone.execute(
                {
                    type: 'thread',
                    ids: [TEST_IDS.THREAD_1],
                    markRead: false,
                    archive: true,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.markRead).not.toHaveBeenCalled()
            expect(mockTwistApi.inbox.archiveThread).toHaveBeenCalledTimes(1)

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should handle partial failures gracefully', async () => {
            // Mock first thread to succeed, second to fail on markRead, third to succeed
            mockTwistApi.threads.markRead
                .mockResolvedValueOnce(undefined) // thread-1 succeeds
                .mockRejectedValueOnce(new Error('Thread not found')) // thread-2 fails
                .mockResolvedValueOnce(undefined) // thread-3 succeeds

            mockTwistApi.inbox.archiveThread.mockResolvedValue(undefined)

            const result = await markDone.execute(
                {
                    type: 'thread',
                    ids: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2, TEST_IDS.THREAD_3],
                    markRead: true,
                    archive: true,
                },
                mockTwistApi,
            )

            // Verify only successful completions are reported
            expect(extractTextContent(result)).toMatchSnapshot()

            // Verify structured content with partial failures
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    completed: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_3],
                    failed: [
                        expect.objectContaining({
                            item: TEST_IDS.THREAD_2,
                            error: 'Thread not found',
                        }),
                    ],
                    totalRequested: 3,
                    successCount: 2,
                    failureCount: 1,
                }),
            )
        })

        it('should handle all threads failing', async () => {
            const apiError = new Error('API Error: Network timeout')
            mockTwistApi.threads.markRead.mockRejectedValue(apiError)

            const result = await markDone.execute(
                {
                    type: 'thread',
                    ids: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2],
                    markRead: true,
                    archive: true,
                },
                mockTwistApi,
            )

            // Verify no threads were completed
            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('marking conversations as done', () => {
        it('should mark all conversations as done successfully', async () => {
            mockTwistApi.conversations.markRead.mockResolvedValue(undefined)
            mockTwistApi.conversations.archiveConversation.mockResolvedValue(undefined)

            const result = await markDone.execute(
                {
                    type: 'conversation',
                    ids: [TEST_IDS.CONVERSATION_1, TEST_IDS.CONVERSATION_2],
                    markRead: true,
                    archive: true,
                },
                mockTwistApi,
            )

            // Verify API was called for each conversation
            expect(mockTwistApi.conversations.markRead).toHaveBeenCalledTimes(2)
            expect(mockTwistApi.conversations.markRead).toHaveBeenNthCalledWith(
                1,
                TEST_IDS.CONVERSATION_1,
            )
            expect(mockTwistApi.conversations.markRead).toHaveBeenNthCalledWith(
                2,
                TEST_IDS.CONVERSATION_2,
            )

            expect(mockTwistApi.conversations.archiveConversation).toHaveBeenCalledTimes(2)
            expect(mockTwistApi.conversations.archiveConversation).toHaveBeenNthCalledWith(
                1,
                TEST_IDS.CONVERSATION_1,
            )
            expect(mockTwistApi.conversations.archiveConversation).toHaveBeenNthCalledWith(
                2,
                TEST_IDS.CONVERSATION_2,
            )

            expect(extractTextContent(result)).toMatchSnapshot()

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    itemType: 'conversation',
                    completed: [TEST_IDS.CONVERSATION_1, TEST_IDS.CONVERSATION_2],
                    failed: [],
                    totalRequested: 2,
                    successCount: 2,
                    failureCount: 0,
                }),
            )
        })

        it('should handle conversation not found error', async () => {
            mockTwistApi.conversations.markRead.mockRejectedValue(
                new Error('Conversation not found'),
            )

            const result = await markDone.execute(
                {
                    type: 'conversation',
                    ids: [TEST_IDS.CONVERSATION_1],
                    markRead: true,
                    archive: false,
                },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('next steps logic validation', () => {
        it('should suggest fetch_inbox when all threads complete successfully', async () => {
            mockTwistApi.threads.markRead.mockResolvedValue(undefined)
            mockTwistApi.inbox.archiveThread.mockResolvedValue(undefined)

            const result = await markDone.execute(
                {
                    type: 'thread',
                    ids: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2],
                    markRead: true,
                    archive: true,
                },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).toContain('fetch_inbox')
        })

        it('should suggest reviewing failures when mixed results', async () => {
            mockTwistApi.threads.markRead
                .mockResolvedValueOnce(undefined)
                .mockRejectedValueOnce(new Error('Thread not found'))

            mockTwistApi.inbox.archiveThread.mockResolvedValue(undefined)

            const result = await markDone.execute(
                {
                    type: 'thread',
                    ids: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2],
                    markRead: true,
                    archive: true,
                },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).toContain('Review failed items and retry if needed')
        })
    })
})
