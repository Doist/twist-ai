import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockConversation,
    createMockConversationMessage,
    createMockThread,
    extractStructuredContent,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { markRead } from '../mark-read.js'

const mockTwistApi = {
    batch: jest.fn(),
    threads: {
        getUnread: jest.fn(),
        getThread: jest.fn(),
        markRead: jest.fn(),
    },
    conversations: {
        getUnread: jest.fn(),
        getConversation: jest.fn(),
        markRead: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { MARK_READ } = ToolNames

// Twist reports -1 here for a fully unread thread; it is a marker, not a read position.
const unreadThread = (threadId: number) => ({
    threadId,
    channelId: TEST_IDS.CHANNEL_1,
    objIndex: -1,
    directMention: false,
})

const unreadConversation = (conversationId: number) => ({
    conversationId,
    objIndex: -1,
    directMention: false,
})

/**
 * The tool batches twice: first the two unread lookups, then one getThread per target
 * thread. Threads are keyed by ID so a test can give each its own last object index.
 */
function mockUnreadState({
    threads = [] as ReturnType<typeof unreadThread>[],
    conversations = [] as ReturnType<typeof unreadConversation>[],
    lastObjIndexes = {} as Record<number, number>,
} = {}) {
    mockTwistApi.batch.mockImplementation((...descriptors: unknown[]) => {
        const isUnreadLookup = descriptors.some(
            (d) => (d as { kind?: string }).kind === 'unread-lookup',
        )
        if (isUnreadLookup) {
            return Promise.resolve([{ data: threads }, { data: conversations }]) as never
        }
        return Promise.resolve(
            descriptors.map((d) => {
                const id = (d as { threadId: number }).threadId
                return {
                    data: createMockThread({
                        id,
                        commentCount: 5,
                        lastObjIndex: lastObjIndexes[id] ?? 4,
                    }),
                }
            }),
        ) as never
    })
}

describe(`${MARK_READ} tool`, () => {
    const originalConsoleError = console.error

    beforeEach(() => {
        jest.clearAllMocks()
        console.error = jest.fn()

        mockTwistApi.threads.getUnread.mockReturnValue({ kind: 'unread-lookup' } as never)
        mockTwistApi.conversations.getUnread.mockReturnValue({ kind: 'unread-lookup' } as never)
        mockTwistApi.threads.getThread.mockImplementation(
            (id: number) => ({ threadId: id }) as never,
        )
        mockTwistApi.threads.markRead.mockResolvedValue(undefined as never)
        mockTwistApi.conversations.markRead.mockResolvedValue(undefined as never)
        mockTwistApi.conversations.getConversation.mockResolvedValue(
            createMockConversation({
                id: TEST_IDS.CONVERSATION_1,
                lastObjIndex: 42,
                lastMessage: createMockConversationMessage({ id: TEST_IDS.MESSAGE_1 }),
            }) as never,
        )
    })

    afterEach(() => {
        console.error = originalConsoleError
    })

    describe('argument validation', () => {
        it('rejects a call with no ids and all unset', async () => {
            await expect(
                markRead.execute({ workspaceId: TEST_IDS.WORKSPACE_1, all: false }, mockTwistApi),
            ).rejects.toThrow('Must provide threadIds, conversationIds, or all: true')
        })

        it('rejects combining all with explicit ids', async () => {
            await expect(
                markRead.execute(
                    {
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        threadIds: [TEST_IDS.THREAD_1],
                        all: true,
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('all cannot be combined with threadIds or conversationIds')
        })
    })

    describe('marking threads read', () => {
        it("reads up to the thread's last object index, not the unread marker", async () => {
            mockUnreadState({
                threads: [unreadThread(TEST_IDS.THREAD_1)],
                lastObjIndexes: { [TEST_IDS.THREAD_1]: 7 },
            })

            const result = await markRead.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, threadIds: [TEST_IDS.THREAD_1], all: false },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.markRead).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                objIndex: 7,
            })

            const structured = extractStructuredContent(result as never)
            expect(structured.threads).toEqual({ marked: [TEST_IDS.THREAD_1], alreadyRead: [] })
            expect(structured.markedCount).toBe(1)
        })

        it('falls back to the comment count when a thread has no last object index', async () => {
            mockUnreadState({ threads: [unreadThread(TEST_IDS.THREAD_1)] })
            mockTwistApi.batch.mockImplementationOnce(
                () =>
                    Promise.resolve([
                        { data: [unreadThread(TEST_IDS.THREAD_1)] },
                        { data: [] },
                    ]) as never,
            )
            mockTwistApi.batch.mockImplementationOnce(
                () =>
                    Promise.resolve([
                        {
                            data: createMockThread({
                                id: TEST_IDS.THREAD_1,
                                commentCount: 5,
                                lastObjIndex: null,
                            }),
                        },
                    ]) as never,
            )

            await markRead.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, threadIds: [TEST_IDS.THREAD_1], all: false },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.markRead).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                objIndex: 5,
            })
        })

        it('reports threads that are already read instead of failing', async () => {
            mockUnreadState({ threads: [unreadThread(TEST_IDS.THREAD_1)] })

            const result = await markRead.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    threadIds: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2],
                    all: false,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.markRead).toHaveBeenCalledTimes(1)

            const structured = extractStructuredContent(result as never)
            expect(structured.threads).toEqual({
                marked: [TEST_IDS.THREAD_1],
                alreadyRead: [TEST_IDS.THREAD_2],
            })
            expect(extractTextContent(result as never)).toContain('Already Read')
        })

        it('records a failure without aborting the remaining items', async () => {
            mockUnreadState({
                threads: [unreadThread(TEST_IDS.THREAD_1), unreadThread(TEST_IDS.THREAD_2)],
            })
            mockTwistApi.threads.markRead
                .mockRejectedValueOnce(new Error('API error') as never)
                .mockResolvedValueOnce(undefined as never)

            const result = await markRead.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    threadIds: [TEST_IDS.THREAD_1, TEST_IDS.THREAD_2],
                    all: false,
                },
                mockTwistApi,
            )

            const structured = extractStructuredContent(result as never)
            expect(structured.threads).toEqual({ marked: [TEST_IDS.THREAD_2], alreadyRead: [] })
            expect(structured.failed).toEqual([
                { item: TEST_IDS.THREAD_1, itemType: 'thread', error: 'API error' },
            ])
            expect(structured.failureCount).toBe(1)
        })
    })

    describe('marking conversations read', () => {
        it('marks by last message ID when the conversation has one', async () => {
            mockUnreadState({
                conversations: [unreadConversation(TEST_IDS.CONVERSATION_1)],
            })

            await markRead.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    conversationIds: [TEST_IDS.CONVERSATION_1],
                    all: false,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversations.markRead).toHaveBeenCalledWith({
                id: TEST_IDS.CONVERSATION_1,
                messageId: TEST_IDS.MESSAGE_1,
            })
        })

        it('falls back to the last object index when there is no last message', async () => {
            mockUnreadState({
                conversations: [unreadConversation(TEST_IDS.CONVERSATION_1)],
            })
            mockTwistApi.conversations.getConversation.mockResolvedValue(
                createMockConversation({
                    id: TEST_IDS.CONVERSATION_1,
                    lastObjIndex: 42,
                }) as never,
            )

            await markRead.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    conversationIds: [TEST_IDS.CONVERSATION_1],
                    all: false,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversations.markRead).toHaveBeenCalledWith({
                id: TEST_IDS.CONVERSATION_1,
                objIndex: 42,
            })
        })
    })

    describe('all mode', () => {
        it('marks every unread thread and conversation in the workspace', async () => {
            mockUnreadState({
                threads: [unreadThread(TEST_IDS.THREAD_1), unreadThread(TEST_IDS.THREAD_2)],
                conversations: [unreadConversation(TEST_IDS.CONVERSATION_1)],
            })

            const result = await markRead.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, all: true },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.markRead).toHaveBeenCalledTimes(2)
            expect(mockTwistApi.conversations.markRead).toHaveBeenCalledTimes(1)

            const structured = extractStructuredContent(result as never)
            expect(structured.mode).toBe('all')
            expect(structured.markedCount).toBe(3)
        })

        it('is a no-op when nothing is unread', async () => {
            mockUnreadState()

            const result = await markRead.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, all: true },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.markRead).not.toHaveBeenCalled()
            expect(mockTwistApi.conversations.markRead).not.toHaveBeenCalled()

            const structured = extractStructuredContent(result as never)
            expect(structured.markedCount).toBe(0)
            expect(structured.failureCount).toBe(0)
        })
    })

    describe('tool definition', () => {
        it('is not marked destructive, unlike mark-done', () => {
            expect(markRead.annotations).toEqual({
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: true,
            })
        })
    })
})
