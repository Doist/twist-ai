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
    channels: {
        getChannel: jest.fn(),
    },
    workspaceUsers: {
        getUserById: jest.fn(),
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
                createMockComment({ id: TEST_IDS.COMMENT_1, creator: TEST_IDS.USER_1 }),
                createMockComment({ id: TEST_IDS.COMMENT_2, creator: TEST_IDS.USER_2 }),
            ]

            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
            mockTwistApi.comments.getComments.mockResolvedValue(mockComments)
            mockTwistApi.channels.getChannel.mockResolvedValue({
                id: mockThread.channelId,
                name: 'Test Channel',
                workspaceId: TEST_IDS.WORKSPACE_1,
                created: new Date(),
                archived: false,
                public: true,
                color: 0,
                creator: TEST_IDS.USER_1,
                version: 1,
            })
            mockTwistApi.workspaceUsers.getUserById.mockImplementation((async (
                _ws: number,
                userId: number,
            ) => {
                if (userId === TEST_IDS.USER_1) {
                    return {
                        id: TEST_IDS.USER_1,
                        name: 'Test User 1',
                        shortName: 'TU1',
                        email: 'user1@test.com',
                        userType: 'USER' as const,
                        bot: false,
                        removed: false,
                        timezone: 'UTC',
                        version: 1,
                    }
                }
                return {
                    id: TEST_IDS.USER_2,
                    name: 'Test User 2',
                    shortName: 'TU2',
                    email: 'user2@test.com',
                    userType: 'USER' as const,
                    bot: false,
                    removed: false,
                    timezone: 'UTC',
                    version: 1,
                }
            }) as never)

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

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'thread_data',
                    totalComments: mockThread.commentCount,
                }),
            )
            expect(structuredContent?.thread.id).toBe(TEST_IDS.THREAD_1)
            expect(structuredContent?.thread.title).toBe('Test Thread')
            expect(structuredContent?.thread.channelId).toBe(mockThread.channelId)
            expect(structuredContent?.thread.channelName).toBe('Test Channel')
            expect(structuredContent?.thread.workspaceId).toBe(mockThread.workspaceId)
            expect(structuredContent?.thread.creatorName).toBe('Test User 1')
            expect(structuredContent?.thread.posted).toBe('2024-01-01T00:00:00.000Z')
            expect(structuredContent?.comments).toHaveLength(2)
            const { comments } = structuredContent || {}
            if (comments?.[0]) {
                expect(comments[0].id).toBe(TEST_IDS.COMMENT_1)
                expect(comments[0].creatorName).toBe('Test User 1')
                expect(comments[0].posted).toBe('2024-01-01T00:00:00.000Z')
            }
            expect(structuredContent?.thread.participants).toEqual([
                TEST_IDS.USER_1,
                TEST_IDS.USER_2,
            ])
            expect(structuredContent?.thread.participantNames).toEqual([
                'Test User 1',
                'Test User 2',
            ])
        })

        it('should load thread without participants when includeParticipants is false', async () => {
            const mockThread = createMockThread({
                participants: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            })
            mockTwistApi.threads.getThread.mockResolvedValue(mockThread)
            mockTwistApi.comments.getComments.mockResolvedValue([])
            mockTwistApi.channels.getChannel.mockResolvedValue({
                id: mockThread.channelId,
                name: 'Test Channel',
                workspaceId: TEST_IDS.WORKSPACE_1,
                created: new Date(),
                archived: false,
                public: true,
                color: 0,
                creator: TEST_IDS.USER_1,
                version: 1,
            })
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({
                id: TEST_IDS.USER_1,
                name: 'Test User 1',
                shortName: 'TU1',
                email: 'user1@test.com',
                userType: 'USER' as const,
                bot: false,
                removed: false,
                timezone: 'UTC',
                version: 1,
            })

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
            mockTwistApi.channels.getChannel.mockResolvedValue({
                id: mockThread.channelId,
                name: 'Test Channel',
                workspaceId: TEST_IDS.WORKSPACE_1,
                created: new Date(),
                archived: false,
                public: true,
                color: 0,
                creator: TEST_IDS.USER_1,
                version: 1,
            })
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({
                id: TEST_IDS.USER_1,
                name: 'Test User 1',
                shortName: 'TU1',
                email: 'user1@test.com',
                userType: 'USER' as const,
                bot: false,
                removed: false,
                timezone: 'UTC',
                version: 1,
            })

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
            mockTwistApi.channels.getChannel.mockResolvedValue({
                id: mockThread.channelId,
                name: 'Test Channel',
                workspaceId: TEST_IDS.WORKSPACE_1,
                created: new Date(),
                archived: false,
                public: true,
                color: 0,
                creator: TEST_IDS.USER_1,
                version: 1,
            })
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({
                id: TEST_IDS.USER_1,
                name: 'Test User 1',
                shortName: 'TU1',
                email: 'user1@test.com',
                userType: 'USER' as const,
                bot: false,
                removed: false,
                timezone: 'UTC',
                version: 1,
            })

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
