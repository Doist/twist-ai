import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { getMentions } from '../get-mentions.js'

const mockTwistApi = {
    batch: jest.fn(),
    search: {
        search: jest.fn(),
    },
    channels: {
        getChannel: jest.fn(),
    },
    workspaceUsers: {
        getUserById: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { GET_MENTIONS } = ToolNames

describe(`${GET_MENTIONS} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockTwistApi.batch.mockImplementation(async (...args: readonly unknown[]) => {
            const results = []
            for (const arg of args) {
                const result = await arg
                results.push({ data: result })
            }
            return results as never
        })
    })

    it('calls search.search with mentionSelf=true and no query', async () => {
        mockTwistApi.search.search.mockResolvedValue({
            items: [],
            hasMore: false,
            isPlanRestricted: false,
        })

        await getMentions.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                limit: 50,
            },
            mockTwistApi,
        )

        const call = mockTwistApi.search.search.mock.calls[0]?.[0] as Record<string, unknown>
        expect(call).toBeDefined()
        expect(call.mentionSelf).toBe(true)
        expect(call.workspaceId).toBe(TEST_IDS.WORKSPACE_1)
        expect(call.limit).toBe(50)
        expect('query' in call).toBe(false)
    })

    it('forwards filters to search.search', async () => {
        mockTwistApi.search.search.mockResolvedValue({
            items: [],
            hasMore: false,
            isPlanRestricted: false,
        })

        await getMentions.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                channelIds: [TEST_IDS.CHANNEL_1],
                authorIds: [TEST_IDS.USER_1],
                dateFrom: '2024-01-01',
                dateTo: '2024-12-31',
                limit: 25,
                cursor: 'cursor-abc',
            },
            mockTwistApi,
        )

        expect(mockTwistApi.search.search).toHaveBeenCalledWith({
            workspaceId: TEST_IDS.WORKSPACE_1,
            mentionSelf: true,
            channelIds: [TEST_IDS.CHANNEL_1],
            authorIds: [TEST_IDS.USER_1],
            dateFrom: '2024-01-01',
            dateTo: '2024-12-31',
            limit: 25,
            cursor: 'cursor-abc',
        })
    })

    it('returns structured mentions_results with enriched names and URLs', async () => {
        mockTwistApi.search.search.mockResolvedValue({
            items: [
                {
                    id: 'thread-123',
                    type: 'thread' as const,
                    snippet: 'You were mentioned here',
                    snippetCreatorId: TEST_IDS.USER_1,
                    snippetLastUpdated: new Date('2024-01-01T00:00:00Z'),
                    channelId: TEST_IDS.CHANNEL_1,
                    threadId: TEST_IDS.THREAD_1,
                    title: 'Mention thread',
                    closed: false,
                },
            ],
            hasMore: false,
            isPlanRestricted: false,
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

        const result = await getMentions.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                limit: 50,
            },
            mockTwistApi,
        )

        const { structuredContent } = result
        expect(structuredContent).toEqual(
            expect.objectContaining({
                type: 'mentions_results',
                workspaceId: TEST_IDS.WORKSPACE_1,
                totalResults: 1,
                hasMore: false,
            }),
        )
        expect(structuredContent?.results[0]).toEqual(
            expect.objectContaining({
                type: 'thread',
                content: 'You were mentioned here',
                creatorName: 'Test User 1',
                channelName: 'Test Channel',
            }),
        )
        expect(structuredContent?.results[0]?.url).toContain(`${TEST_IDS.THREAD_1}`)
        expect(extractTextContent(result)).toContain('# Mentions in Workspace')
    })

    it('exposes pagination cursor when hasMore is true', async () => {
        mockTwistApi.search.search.mockResolvedValue({
            items: [
                {
                    id: 'comment-1',
                    type: 'comment' as const,
                    snippet: 'A mention',
                    snippetCreatorId: TEST_IDS.USER_1,
                    snippetLastUpdated: new Date('2024-01-01T00:00:00Z'),
                    threadId: TEST_IDS.THREAD_1,
                    channelId: TEST_IDS.CHANNEL_1,
                    commentId: TEST_IDS.COMMENT_1,
                },
            ],
            hasMore: true,
            nextCursorMark: 'next-cursor-xyz',
            isPlanRestricted: false,
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

        const result = await getMentions.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                limit: 1,
            },
            mockTwistApi,
        )

        expect(result.structuredContent?.hasMore).toBe(true)
        expect(result.structuredContent?.cursor).toBe('next-cursor-xyz')
        expect(extractTextContent(result)).toContain('More results available')
    })

    it('handles no results found', async () => {
        mockTwistApi.search.search.mockResolvedValue({
            items: [],
            hasMore: false,
            isPlanRestricted: false,
        })

        const result = await getMentions.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                limit: 50,
            },
            mockTwistApi,
        )

        expect(extractTextContent(result)).toContain('No mentions found')
        expect(result.structuredContent?.totalResults).toBe(0)
    })

    it('propagates API errors', async () => {
        mockTwistApi.search.search.mockRejectedValue(new Error('Search API error'))

        await expect(
            getMentions.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    limit: 50,
                },
                mockTwistApi,
            ),
        ).rejects.toThrow('Search API error')
    })
})
