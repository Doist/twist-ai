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
    conversations: {
        getUnread: jest.fn(),
        getConversation: jest.fn(),
    },
    channels: {
        getChannel: jest.fn(),
    },
    workspaceUsers: {
        getUserById: jest.fn(),
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
            mockTwistApi.conversations.getUnread.mockResolvedValue([])
            mockTwistApi.channels.getChannel.mockResolvedValue({
                id: TEST_IDS.CHANNEL_1,
                name: 'Test Channel',
                workspaceId: TEST_IDS.WORKSPACE_1,
                created: new Date(),
                archived: false,
                public: true,
                color: 0,
                creator: TEST_IDS.USER_1,
                version: 1,
            })

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
            expect(mockTwistApi.conversations.getUnread).toHaveBeenCalledWith(
                TEST_IDS.WORKSPACE_1,
                {
                    batch: true,
                },
            )
            // Verify channel info is fetched for each thread
            expect(mockTwistApi.channels.getChannel).toHaveBeenCalledWith(TEST_IDS.CHANNEL_1, {
                batch: true,
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'inbox_data',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    unreadCount: 1,
                    totalThreads: 2,
                    totalConversations: 0,
                }),
            )
            expect(structuredContent?.threads).toHaveLength(2)
            expect(structuredContent?.conversations).toHaveLength(0)
            const { threads } = structuredContent || {}
            if (threads?.[0] && threads[1]) {
                expect(threads[0].id).toBe(TEST_IDS.THREAD_1)
                expect(threads[0].channelName).toBe('Test Channel')
                expect(threads[0].threadUrl).toContain('twist.com')
                expect(threads[0].isUnread).toBe(true)
                expect(threads[1].isStarred).toBe(true)
            }
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
            mockTwistApi.conversations.getUnread.mockResolvedValue([])
            mockTwistApi.channels.getChannel.mockResolvedValue({
                id: TEST_IDS.CHANNEL_1,
                name: 'Test Channel',
                workspaceId: TEST_IDS.WORKSPACE_1,
                created: new Date(),
                archived: false,
                public: true,
                color: 0,
                creator: TEST_IDS.USER_1,
                version: 1,
            })

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
            mockTwistApi.conversations.getUnread.mockResolvedValue([])

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
                { batch: true },
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should fetch inbox with unread conversations', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue([])
            mockTwistApi.inbox.getCount.mockResolvedValue(0)
            mockTwistApi.threads.getUnread.mockResolvedValue([])
            mockTwistApi.conversations.getUnread.mockResolvedValue([
                {
                    conversationId: TEST_IDS.CONVERSATION_1,
                    objIndex: 5,
                    directMention: false,
                },
                {
                    conversationId: TEST_IDS.CONVERSATION_2,
                    objIndex: 3,
                    directMention: true,
                },
            ])
            mockTwistApi.conversations.getConversation.mockImplementation((id: number) => {
                if (id === TEST_IDS.CONVERSATION_1) {
                    return Promise.resolve({
                        id: TEST_IDS.CONVERSATION_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                        messageCount: 10,
                        lastObjIndex: 5,
                        snippet: 'Latest message',
                        snippetCreators: [TEST_IDS.USER_2],
                        lastActive: new Date(),
                        archived: false,
                        created: new Date(),
                        creator: TEST_IDS.USER_1,
                    }) as never
                }
                return Promise.resolve({
                    id: TEST_IDS.CONVERSATION_2,
                    title: 'Project Discussion',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    userIds: [TEST_IDS.USER_1, TEST_IDS.USER_3],
                    messageCount: 3,
                    lastObjIndex: 3,
                    snippet: 'Project update',
                    snippetCreators: [TEST_IDS.USER_3],
                    lastActive: new Date(),
                    archived: false,
                    created: new Date(),
                    creator: TEST_IDS.USER_1,
                }) as never
            })
            mockTwistApi.workspaceUsers.getUserById.mockImplementation(
                (_workspaceId: number, userId: number) => {
                    if (userId === TEST_IDS.USER_1) {
                        return Promise.resolve({
                            id: TEST_IDS.USER_1,
                            name: 'Alice',
                            shortName: 'Alice',
                            bot: false,
                            timezone: 'UTC',
                            removed: false,
                            userType: 'MEMBER' as const,
                            version: 1,
                        }) as never
                    }
                    if (userId === TEST_IDS.USER_2) {
                        return Promise.resolve({
                            id: TEST_IDS.USER_2,
                            name: 'Bob',
                            shortName: 'Bob',
                            bot: false,
                            timezone: 'UTC',
                            removed: false,
                            userType: 'MEMBER' as const,
                            version: 1,
                        }) as never
                    }
                    return Promise.resolve({
                        id: TEST_IDS.USER_3,
                        name: 'Charlie',
                        shortName: 'Charlie',
                        bot: false,
                        timezone: 'UTC',
                        removed: false,
                        userType: 'MEMBER' as const,
                        version: 1,
                    }) as never
                },
            )

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: false },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
            expect(extractTextContent(result)).toContain('## Conversations (2)')
            expect(extractTextContent(result)).toContain('DM with Alice, Bob')
            expect(extractTextContent(result)).toContain('Project Discussion')

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    totalConversations: 2,
                }),
            )
            expect(structuredContent?.conversations).toHaveLength(2)
            const { conversations } = structuredContent || {}
            if (conversations?.[0] && conversations[1]) {
                expect(conversations[0].id).toBe(TEST_IDS.CONVERSATION_1)
                expect(conversations[0].participantNames).toEqual(['Alice', 'Bob'])
                expect(conversations[0].isUnread).toBe(true)
                expect(conversations[0].conversationUrl).toContain('twist.com')
                expect(conversations[1].title).toBe('Project Discussion')
            }
        })

        it('should not display conversations when none are unread', async () => {
            mockTwistApi.inbox.getInbox.mockResolvedValue([
                {
                    id: TEST_IDS.THREAD_1,
                    title: 'Test Thread',
                    content: 'Thread content',
                    creator: TEST_IDS.USER_1,
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    commentCount: 0,
                    lastUpdated: new Date(),
                    posted: new Date(),
                    snippet: 'Thread snippet',
                    snippetCreator: TEST_IDS.USER_1,
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
                    objIndex: 1,
                    directMention: false,
                },
            ])
            mockTwistApi.conversations.getUnread.mockResolvedValue([])
            mockTwistApi.channels.getChannel.mockResolvedValue({
                id: TEST_IDS.CHANNEL_1,
                name: 'Test Channel',
                workspaceId: TEST_IDS.WORKSPACE_1,
                created: new Date(),
                archived: false,
                public: true,
                color: 0,
                creator: TEST_IDS.USER_1,
                version: 1,
            })

            const result = await fetchInbox.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, limit: 50, onlyUnread: false },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
            expect(extractTextContent(result)).not.toContain('## Conversations')
            expect(extractTextContent(result)).not.toContain('Total Conversations')

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent?.totalConversations).toBe(0)
            expect(structuredContent?.conversations).toHaveLength(0)
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
