import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { searchContent } from '../search-content.js'

// Mock the Twist API
const mockTwistApi = {
    search: {
        search: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { SEARCH_CONTENT } = ToolNames

describe(`${SEARCH_CONTENT} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('workspace search', () => {
        it('should search across workspace with results', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                items: [
                    {
                        id: 'thread-123',
                        type: 'thread' as const,
                        snippet: 'Test thread matching query',
                        snippetCreatorId: TEST_IDS.USER_1,
                        snippetLastUpdated: new Date('2024-01-01T00:00:00Z'),
                        channelId: TEST_IDS.CHANNEL_1,
                        threadId: TEST_IDS.THREAD_1,
                        channelName: 'Test Channel',
                        channelColor: 1,
                        title: 'Test Thread',
                        closed: false,
                    },
                    {
                        id: 'comment-456',
                        type: 'comment' as const,
                        snippet: 'Test comment matching query',
                        snippetCreatorId: TEST_IDS.USER_1,
                        snippetLastUpdated: new Date('2024-01-01T00:00:00Z'),
                        threadId: TEST_IDS.THREAD_1,
                        commentId: TEST_IDS.COMMENT_1,
                    },
                ],
                hasMore: false,
                isPlanRestricted: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'test query',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    limit: 50,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.search.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: 'test query',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    limit: 50,
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'search_results',
                    query: 'test query',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    totalResults: 2,
                    hasMore: false,
                }),
            )
            expect(structuredContent?.results).toHaveLength(2)
            expect(structuredContent?.results[0]).toEqual(
                expect.objectContaining({
                    type: 'thread',
                    content: 'Test thread matching query',
                }),
            )
            const { results } = structuredContent || {}
            if (results?.[0] && results[1]) {
                expect(results[0].created).toBe('2024-01-01T00:00:00.000Z')
                expect(results[1].created).toBe('2024-01-01T00:00:00.000Z')
            }
        })

        it('should search with filters', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                items: [
                    {
                        id: 'thread-789',
                        type: 'thread' as const,
                        snippet: 'Filtered result',
                        snippetCreatorId: TEST_IDS.USER_1,
                        snippetLastUpdated: new Date('2024-01-01T00:00:00Z'),
                        channelId: TEST_IDS.CHANNEL_1,
                        threadId: TEST_IDS.THREAD_1,
                    },
                ],
                hasMore: false,
                isPlanRestricted: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'filtered',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    channelIds: [TEST_IDS.CHANNEL_1],
                    authorIds: [TEST_IDS.USER_1],
                    mentionSelf: true,
                    dateFrom: '2024-01-01',
                    dateTo: '2024-12-31',
                    limit: 25,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.search.search).toHaveBeenCalledWith({
                query: 'filtered',
                workspaceId: TEST_IDS.WORKSPACE_1,
                channelIds: [TEST_IDS.CHANNEL_1],
                authorIds: [TEST_IDS.USER_1],
                mentionSelf: true,
                dateFrom: '2024-01-01',
                dateTo: '2024-12-31',
                limit: 25,
                cursor: undefined,
            })

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should handle pagination', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                items: [
                    {
                        id: 'result-1',
                        type: 'message' as const,
                        snippet: 'Page 1 result',
                        snippetCreatorId: TEST_IDS.USER_1,
                        snippetLastUpdated: new Date('2024-01-01T00:00:00Z'),
                        conversationId: TEST_IDS.CONVERSATION_1,
                    },
                ],
                hasMore: true,
                nextCursorMark: 'next-cursor-123',
                isPlanRestricted: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'paginated',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    limit: 10,
                },
                mockTwistApi,
            )

            const { structuredContent } = result
            expect(structuredContent?.hasMore).toBe(true)
            expect(structuredContent?.cursor).toBe('next-cursor-123')

            expect(extractTextContent(result)).toContain('More results available')
        })
    })

    describe('empty results', () => {
        it('should handle no results found', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                items: [],
                hasMore: false,
                isPlanRestricted: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'nonexistent',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    limit: 50,
                },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('No results found')
            expect(textContent).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            mockTwistApi.search.search.mockRejectedValue(new Error('Search API error'))

            await expect(
                searchContent.execute(
                    {
                        query: 'test',
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        limit: 50,
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Search API error')
        })
    })
})
