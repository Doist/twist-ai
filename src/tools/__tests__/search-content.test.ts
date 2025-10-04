import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { searchContent } from '../search-content.js'

// Mock the Twist API
const mockTwistApi = {
    search: {
        search: jest.fn(),
        searchComments: jest.fn(),
        searchMessages: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { SEARCH_CONTENT } = ToolNames

describe(`${SEARCH_CONTENT} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('workspace (global) search', () => {
        it('should search across workspace with results', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                results: [
                    {
                        id: TEST_IDS.THREAD_1,
                        type: 'thread',
                        content: 'Test thread matching query',
                        creatorId: TEST_IDS.USER_1,
                        createdTs: 1704067200,
                        channelId: TEST_IDS.CHANNEL_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                    },
                    {
                        id: TEST_IDS.COMMENT_1,
                        type: 'comment',
                        content: 'Test comment matching query',
                        creatorId: TEST_IDS.USER_1,
                        createdTs: 1704067200,
                        threadId: TEST_IDS.THREAD_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                    },
                ],
                hasMore: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'test query',
                    scope: 'workspace',
                    objectId: TEST_IDS.WORKSPACE_1,
                    limit: 50,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.search.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: 'test query',
                    workspaceId: TEST_IDS.WORKSPACE_1,
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should search with filters', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                results: [],
                hasMore: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'test',
                    scope: 'workspace',
                    objectId: TEST_IDS.WORKSPACE_1,
                    channelIds: [TEST_IDS.CHANNEL_1],
                    authorIds: [TEST_IDS.USER_1],
                    mentionSelf: true,
                    dateFrom: '2024-01-01',
                    dateTo: '2024-01-31',
                    limit: 50,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.search.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    channelIds: [TEST_IDS.CHANNEL_1],
                    authorIds: [TEST_IDS.USER_1],
                    mentionSelf: true,
                    dateFrom: '2024-01-01',
                    dateTo: '2024-01-31',
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should handle pagination', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                results: [],
                hasMore: true,
                cursor: 'next-cursor',
            })

            const result = await searchContent.execute(
                { query: 'test', scope: 'workspace', objectId: TEST_IDS.WORKSPACE_1, limit: 50 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).toContain('More results available')
        })
    })

    describe('thread search', () => {
        it('should search within thread comments', async () => {
            mockTwistApi.search.searchComments.mockResolvedValue({
                results: [
                    {
                        id: TEST_IDS.COMMENT_1,
                        type: 'comment',
                        content: 'Comment matching query',
                        creatorId: TEST_IDS.USER_1,
                        createdTs: 1704067200,
                        threadId: TEST_IDS.THREAD_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                    },
                ],
                hasMore: false,
            })

            const result = await searchContent.execute(
                { query: 'test', scope: 'thread', objectId: TEST_IDS.THREAD_1, limit: 50 },
                mockTwistApi,
            )

            expect(mockTwistApi.search.searchComments).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: 'test',
                    threadId: TEST_IDS.THREAD_1,
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('conversation search', () => {
        it('should search within conversation messages', async () => {
            mockTwistApi.search.searchMessages.mockResolvedValue({
                results: [
                    {
                        id: TEST_IDS.MESSAGE_1,
                        type: 'message',
                        content: 'Message matching query',
                        creatorId: TEST_IDS.USER_1,
                        createdTs: 1704067200,
                        conversationId: TEST_IDS.CONVERSATION_1,
                        workspaceId: TEST_IDS.WORKSPACE_1,
                    },
                ],
                hasMore: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'test',
                    scope: 'conversation',
                    objectId: TEST_IDS.CONVERSATION_1,
                    limit: 50,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.search.searchMessages).toHaveBeenCalledWith(
                expect.objectContaining({
                    query: 'test',
                    conversationId: TEST_IDS.CONVERSATION_1,
                }),
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('empty results', () => {
        it('should handle no results found', async () => {
            mockTwistApi.search.search.mockResolvedValue({
                results: [],
                hasMore: false,
            })

            const result = await searchContent.execute(
                {
                    query: 'nonexistent',
                    scope: 'workspace',
                    objectId: TEST_IDS.WORKSPACE_1,
                    limit: 50,
                },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error('API Error: Rate limit exceeded')
            mockTwistApi.search.search.mockRejectedValue(apiError)

            await expect(
                searchContent.execute(
                    {
                        query: 'test',
                        scope: 'workspace',
                        objectId: TEST_IDS.WORKSPACE_1,
                        limit: 50,
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('API Error: Rate limit exceeded')
        })
    })
})
