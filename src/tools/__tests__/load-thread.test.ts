import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockComment,
    createMockThread,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { loadThread } from '../load-thread.js'

// Mock the Twist API
const mockTwistApi = {
    batch: jest.fn(),
    threads: {
        getThread: jest.fn(),
    },
    comments: {
        getComments: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { LOAD_THREAD } = ToolNames

describe(`${LOAD_THREAD} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // Mock batch to return responses with .data property
        mockTwistApi.batch.mockImplementation(async (...args: readonly unknown[]) => {
            const results = []
            for (const arg of args) {
                const result = await arg
                results.push({ data: result })
            }
            return results as never
        })
    })

    describe('loading threads successfully', () => {
        it('should load thread with comments and participants', async () => {
            const mockThread = createMockThread({
                participants: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            })
            const mockComments = [
                createMockComment({ id: TEST_IDS.COMMENT_1 }),
                createMockComment({ id: TEST_IDS.COMMENT_2 }),
            ]

            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
            mockTwistApi.comments.getComments.mockResolvedValue(mockComments)

            const result = await loadThread.execute(
                { threadId: TEST_IDS.THREAD_1, limit: 50, includeParticipants: true },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.getThread).toHaveBeenCalledWith(TEST_IDS.THREAD_1, {
                batch: true,
            })
            expect(mockTwistApi.comments.getComments).toHaveBeenCalledWith(
                {
                    threadId: TEST_IDS.THREAD_1,
                    from: undefined,
                    limit: 50,
                },
                { batch: true },
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should load thread without participants when includeParticipants is false', async () => {
            const mockThread = createMockThread({
                participants: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            })
            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
            mockTwistApi.comments.getComments.mockResolvedValue([])

            const result = await loadThread.execute(
                {
                    threadId: TEST_IDS.THREAD_1,
                    limit: 50,
                    includeParticipants: false,
                },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).not.toContain('## Participants')
        })

        it('should filter comments by date', async () => {
            const mockThread = createMockThread()
            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
            mockTwistApi.comments.getComments.mockResolvedValue([])

            const result = await loadThread.execute(
                {
                    threadId: TEST_IDS.THREAD_1,
                    newerThanDate: '2024-01-01',
                    limit: 50,
                    includeParticipants: true,
                },
                mockTwistApi,
            )

            // Verify date was converted to Date object
            expect(mockTwistApi.comments.getComments).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: expect.any(Date),
                }),
                { batch: true },
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should handle thread with no comments', async () => {
            const mockThread = createMockThread()
            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
            mockTwistApi.comments.getComments.mockResolvedValue([])

            const result = await loadThread.execute(
                { threadId: TEST_IDS.THREAD_1, limit: 50, includeParticipants: true },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate thread not found error', async () => {
            const apiError = new Error('Thread not found')
            mockTwistApi.threads.getThread.mockRejectedValue(apiError)

            await expect(
                loadThread.execute(
                    { threadId: TEST_IDS.THREAD_1, limit: 50, includeParticipants: true },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Thread not found')
        })
    })
})
