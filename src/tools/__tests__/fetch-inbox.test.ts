import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { fetchInbox } from '../fetch-inbox.js'

// Mock the Twist API
const mockTwistApi = {
    inbox: {
        getInbox: jest.fn(),
        getCount: jest.fn(),
    },
    threads: {
        getUnread: jest.fn(),
    },
    conversations: {
        getUnread: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { FETCH_INBOX } = ToolNames

describe(`${FETCH_INBOX} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('fetching inbox successfully', () => {
        it('should fetch inbox with threads and conversations', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue({
                threads: [
                    {
                        id: TEST_IDS.THREAD_1,
                        title: 'Test Thread 1',
                        channelId: TEST_IDS.CHANNEL_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        creatorId: TEST_IDS.USER_1,
                        isUnread: true,
                        isStarred: false,
                        newestObjIndex: 100,
                        oldestObjIndex: 1,
                        unreadCount: 3,
                    },
                    {
                        id: TEST_IDS.THREAD_2,
                        title: 'Test Thread 2',
                        channelId: TEST_IDS.CHANNEL_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        creatorId: TEST_IDS.USER_2,
                        isUnread: false,
                        isStarred: true,
                        newestObjIndex: 50,
                        oldestObjIndex: 1,
                        unreadCount: 0,
                    },
                ],
                conversations: [
                    {
                        id: TEST_IDS.CONVERSATION_1,
                        title: 'Test Conversation',
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        isUnread: true,
                        unreadCount: 2,
                    },
                ],
            })
            mockTwistApi.inbox.getCount.mockResolvedValue(5)
            mockTwistApi.threads.getUnread.mockResolvedValue([TEST_IDS.THREAD_1])
            mockTwistApi.conversations.getUnread.mockResolvedValue([TEST_IDS.CONVERSATION_1])

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: false },
                mockTwistApi,
            )

            expect(mockTwistApi.inbox.getInbox).toHaveBeenCalledWith({
                workspaceId: TEST_IDS.WORKSPACE_1,
                since: undefined,
                until: undefined,
                limit: 50,
            })
            expect(mockTwistApi.inbox.getCount).toHaveBeenCalledWith(TEST_IDS.WORKSPACE_1)
            expect(mockTwistApi.threads.getUnread).toHaveBeenCalledWith(TEST_IDS.WORKSPACE_1)
            expect(mockTwistApi.conversations.getUnread).toHaveBeenCalledWith(TEST_IDS.WORKSPACE_1)

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should filter only unread items when requested', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue({
                threads: [
                    {
                        id: TEST_IDS.THREAD_1,
                        title: 'Unread Thread',
                        channelId: TEST_IDS.CHANNEL_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        creatorId: TEST_IDS.USER_1,
                        isUnread: true,
                        isStarred: false,
                        newestObjIndex: 100,
                        oldestObjIndex: 1,
                        unreadCount: 3,
                    },
                    {
                        id: TEST_IDS.THREAD_2,
                        title: 'Read Thread',
                        channelId: TEST_IDS.CHANNEL_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        creatorId: TEST_IDS.USER_2,
                        isUnread: false,
                        isStarred: false,
                        newestObjIndex: 50,
                        oldestObjIndex: 1,
                        unreadCount: 0,
                    },
                ],
                conversations: [],
            })
            mockTwistApi.inbox.getCount.mockResolvedValue(1)
            mockTwistApi.threads.getUnread.mockResolvedValue([TEST_IDS.THREAD_1])
            mockTwistApi.conversations.getUnread.mockResolvedValue([])

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: true },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
            expect(extractTextContent(result)).not.toContain('Read Thread')
            expect(extractTextContent(result)).toContain('Unread Thread')
        })

        it('should handle empty inbox', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue({
                threads: [],
                conversations: [],
            })
            mockTwistApi.inbox.getCount.mockResolvedValue(0)
            mockTwistApi.threads.getUnread.mockResolvedValue([])
            mockTwistApi.conversations.getUnread.mockResolvedValue([])

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: false },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should filter by date range', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue({
                threads: [],
                conversations: [],
            })
            mockTwistApi.inbox.getCount.mockResolvedValue(0)
            mockTwistApi.threads.getUnread.mockResolvedValue([])
            mockTwistApi.conversations.getUnread.mockResolvedValue([])

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
