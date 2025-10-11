import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { fetchInbox } from '../fetch-inbox.js'

// Mock the Twist API
const mockTwistApi = {
    batch: jest.fn(),
    inbox: {
        getInbox: jest.fn(),
        getCount: jest.fn(),
    },
    threads: {
        getUnread: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { FETCH_INBOX } = ToolNames

describe(`${FETCH_INBOX} tool`, () => {
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

    describe('fetching inbox successfully', () => {
        it('should fetch inbox with threads', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue([
                {
                    id: TEST_IDS.THREAD_1,
                    title: 'Test Thread 1',
                    content: 'Thread content 1',
                    creator: TEST_IDS.USER_1,
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    commentCount: 3,
                    lastUpdated: new Date(),
                    posted: new Date(),
                    snippet: 'Thread snippet 1',
                    snippetCreator: TEST_IDS.USER_1,
                    starred: false,
                    pinned: false,
                    isArchived: false,
                    inInbox: true,
                    closed: false,
                },
                {
                    id: TEST_IDS.THREAD_2,
                    title: 'Test Thread 2',
                    content: 'Thread content 2',
                    creator: TEST_IDS.USER_2,
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    commentCount: 0,
                    lastUpdated: new Date(),
                    posted: new Date(),
                    snippet: 'Thread snippet 2',
                    snippetCreator: TEST_IDS.USER_2,
                    starred: true,
                    pinned: false,
                    isArchived: false,
                    inInbox: true,
                    closed: false,
                },
            ])
            mockTwistApi.inbox.getCount.mockResolvedValue(5)
            mockTwistApi.threads.getUnread.mockResolvedValue([
                {
                    threadId: TEST_IDS.THREAD_1,
                    channelId: TEST_IDS.CHANNEL_1,
                    objIndex: 100,
                    directMention: false,
                },
            ])

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: false },
                mockTwistApi,
            )

            expect(mockTwistApi.inbox.getInbox).toHaveBeenCalledWith(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    since: undefined,
                    until: undefined,
                    limit: 50,
                },
                { batch: true },
            )
            expect(mockTwistApi.inbox.getCount).toHaveBeenCalledWith(TEST_IDS.WORKSPACE_1, {
                batch: true,
            })
            expect(mockTwistApi.threads.getUnread).toHaveBeenCalledWith(TEST_IDS.WORKSPACE_1, {
                batch: true,
            })

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should filter only unread items when requested', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue([
                {
                    id: TEST_IDS.THREAD_1,
                    title: 'Unread Thread',
                    content: 'Unread content',
                    creator: TEST_IDS.USER_1,
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    commentCount: 3,
                    lastUpdated: new Date(),
                    posted: new Date(),
                    snippet: 'Unread snippet',
                    snippetCreator: TEST_IDS.USER_1,
                    starred: false,
                    pinned: false,
                    isArchived: false,
                    inInbox: true,
                    closed: false,
                },
                {
                    id: TEST_IDS.THREAD_2,
                    title: 'Read Thread',
                    content: 'Read content',
                    creator: TEST_IDS.USER_2,
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    commentCount: 0,
                    lastUpdated: new Date(),
                    posted: new Date(),
                    snippet: 'Read snippet',
                    snippetCreator: TEST_IDS.USER_2,
                    starred: false,
                    pinned: false,
                    isArchived: false,
                    inInbox: true,
                    closed: false,
                },
            ])
            mockTwistApi.inbox.getCount.mockResolvedValue(1)
            mockTwistApi.threads.getUnread.mockResolvedValue([
                {
                    threadId: TEST_IDS.THREAD_1,
                    channelId: TEST_IDS.CHANNEL_1,
                    objIndex: 100,
                    directMention: false,
                },
            ])

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: true },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
            expect(extractTextContent(result)).not.toContain('Read Thread')
            expect(extractTextContent(result)).toContain('Unread Thread')
        })

        it('should handle empty inbox', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue([])
            mockTwistApi.inbox.getCount.mockResolvedValue(0)
            mockTwistApi.threads.getUnread.mockResolvedValue([])

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: false },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should filter by date range', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue([])
            mockTwistApi.inbox.getCount.mockResolvedValue(0)
            mockTwistApi.threads.getUnread.mockResolvedValue([])

            const result = await fetchInbox.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    sinceDate: '2024-01-01',
                    untilDate: '2024-01-31',
                    limit: 50,
                    onlyUnread: false,
                },
                mockTwistApi,
            )

            // Verify dates were converted to Date objects
            expect(mockTwistApi.inbox.getInbox).toHaveBeenCalledWith(
                expect.objectContaining({
                    since: expect.any(Date),
                    until: expect.any(Date),
                }),
                { batch: true },
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error('API Error: Unauthorized')
            mockTwistApi.inbox.getInbox.mockRejectedValue(apiError)

            await expect(
                fetchInbox.execute(
                    { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: false },
                    mockTwistApi,
                ),
            ).rejects.toThrow('API Error: Unauthorized')
        })
    })
})
