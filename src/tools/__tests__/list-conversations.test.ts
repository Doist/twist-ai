import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockConversation,
    extractStructuredContent,
    extractTextContent,
    TEST_ERRORS,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { listConversations } from '../list-conversations.js'

const mockTwistApi = {
    conversations: {
        getConversations: jest.fn(),
    },
    workspaceUsers: {
        getUserById: jest.fn(),
    },
    batch: jest.fn(),
} as unknown as jest.Mocked<TwistApi>

const { LIST_CONVERSATIONS } = ToolNames

describe(`${LIST_CONVERSATIONS} tool`, () => {
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

    describe('listing conversations', () => {
        it('should list all conversations in a workspace', async () => {
            const mockConversations = [
                createMockConversation({
                    id: TEST_IDS.CONVERSATION_1,
                    title: 'Project Discussion',
                    userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                }),
                createMockConversation({
                    id: TEST_IDS.CONVERSATION_2,
                    title: 'Design Review',
                    userIds: [TEST_IDS.USER_1, TEST_IDS.USER_3],
                }),
            ]

            mockTwistApi.conversations.getConversations.mockResolvedValue(mockConversations)
            mockTwistApi.workspaceUsers.getUserById.mockImplementation(
                async (args: { workspaceId: number; userId: number }) => {
                    if (args.userId === TEST_IDS.USER_1) return { name: 'Alice Johnson' }
                    if (args.userId === TEST_IDS.USER_2) return { name: 'Bob Smith' }
                    if (args.userId === TEST_IDS.USER_3) return { name: 'Carol Davis' }
                    throw new Error('User not found')
                },
            )

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            expect(mockTwistApi.conversations.getConversations).toHaveBeenCalledWith({
                workspaceId: TEST_IDS.WORKSPACE_1,
            })

            const textContent = extractTextContent(result)
            expect(textContent).toContain('Found 2 conversations')
            expect(textContent).toContain('## [Project Discussion]')
            expect(textContent).toContain('## [Design Review]')
            expect(textContent).toContain('Alice Johnson')
            expect(textContent).toContain('Bob Smith')
            expect(textContent).toContain('Carol Davis')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent).toEqual({
                type: 'list_conversations',
                workspaceId: TEST_IDS.WORKSPACE_1,
                totalConversations: 2,
                conversations: expect.arrayContaining([
                    expect.objectContaining({
                        id: TEST_IDS.CONVERSATION_1,
                        title: 'Project Discussion',
                        userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                        participantNames: ['Alice Johnson', 'Bob Smith'],
                        archived: false,
                    }),
                    expect.objectContaining({
                        id: TEST_IDS.CONVERSATION_2,
                        title: 'Design Review',
                        userIds: [TEST_IDS.USER_1, TEST_IDS.USER_3],
                        participantNames: ['Alice Johnson', 'Carol Davis'],
                    }),
                ]),
            })
        })

        it('should handle empty conversation list', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([])

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('No conversations found.')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent).toEqual({
                type: 'list_conversations',
                workspaceId: TEST_IDS.WORKSPACE_1,
                conversations: [],
                totalConversations: 0,
            })
        })

        it('should handle single conversation', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation(),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('Found 1 conversation in')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalConversations).toBe(1)
        })
    })

    describe('conversation details', () => {
        it('should fall back to "Conversation <id>" heading when title is missing', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation({ title: undefined }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain(`## [Conversation ${TEST_IDS.CONVERSATION_1}]`)

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.conversations[0]).not.toHaveProperty('title')
        })

        it('should include snippet when present', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation({ snippet: 'Last message preview' }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Snippet:** Last message preview')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.conversations[0]).toHaveProperty(
                'snippet',
                'Last message preview',
            )
        })

        it('should omit snippet when empty', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation({ snippet: '' }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).not.toContain('**Snippet:**')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.conversations[0]).not.toHaveProperty('snippet')
        })

        it('should show archived status', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation({ archived: true }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain('**Archived:** Yes')

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.conversations[0].archived).toBe(true)
        })

        it('should generate a conversation URL when the SDK does not provide one', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation({ url: undefined }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const structuredContent = extractStructuredContent(result)
            const conversation = structuredContent.conversations[0] as { conversationUrl: string }
            expect(conversation.conversationUrl).toContain(`/a/${TEST_IDS.WORKSPACE_1}/`)
            expect(conversation.conversationUrl).toContain(`/msg/${TEST_IDS.CONVERSATION_1}`)
        })

        it('should use the SDK-provided URL when present', async () => {
            const sdkUrl = 'https://twist.com/a/11111/msg/33333/'
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation({ url: sdkUrl }),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.conversations[0]).toHaveProperty('conversationUrl', sdkUrl)
        })
    })

    describe('participant resolution', () => {
        it('should batch-fetch unique participants across conversations', async () => {
            const mockConversations = [
                createMockConversation({
                    id: TEST_IDS.CONVERSATION_1,
                    userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                }),
                createMockConversation({
                    id: TEST_IDS.CONVERSATION_2,
                    userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                }),
            ]

            mockTwistApi.conversations.getConversations.mockResolvedValue(mockConversations)
            mockTwistApi.workspaceUsers.getUserById.mockImplementation(
                async (args: { workspaceId: number; userId: number }) => {
                    if (args.userId === TEST_IDS.USER_1) return { name: 'Alice' }
                    if (args.userId === TEST_IDS.USER_2) return { name: 'Bob' }
                    throw new Error('User not found')
                },
            )

            await listConversations.execute({ workspaceId: TEST_IDS.WORKSPACE_1 }, mockTwistApi)

            // Should only batch 2 unique participants, not 4
            expect(mockTwistApi.batch).toHaveBeenCalledTimes(1)
            const batchCall = mockTwistApi.batch.mock.calls[0]
            expect(batchCall).toHaveLength(2)
        })

        it('should fall back to participant ID when name lookup fails', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation({ userIds: [TEST_IDS.USER_1] }),
            ])
            mockTwistApi.batch.mockResolvedValue([{ data: undefined }] as never)

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1 },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toContain(`**Participants:** ${TEST_IDS.USER_1}`)

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.conversations[0]).not.toHaveProperty('participantNames')
        })
    })

    describe('includeArchived', () => {
        it('should only fetch active conversations by default', async () => {
            mockTwistApi.conversations.getConversations.mockResolvedValue([
                createMockConversation(),
            ])
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            await listConversations.execute({ workspaceId: TEST_IDS.WORKSPACE_1 }, mockTwistApi)

            expect(mockTwistApi.conversations.getConversations).toHaveBeenCalledTimes(1)
            expect(mockTwistApi.conversations.getConversations).toHaveBeenCalledWith({
                workspaceId: TEST_IDS.WORKSPACE_1,
            })
        })

        it('should batch-fetch active and archived conversations when includeArchived is true', async () => {
            const activeConversation = createMockConversation({
                id: TEST_IDS.CONVERSATION_1,
                title: 'Active Chat',
            })
            const archivedConversation = createMockConversation({
                id: TEST_IDS.CONVERSATION_2,
                title: 'Archived Chat',
                archived: true,
            })

            mockTwistApi.conversations.getConversations.mockImplementation(async (args) => {
                if ('archived' in args && args.archived === true) {
                    return [archivedConversation]
                }
                return [activeConversation]
            })
            mockTwistApi.batch.mockResolvedValueOnce([
                { data: [activeConversation] },
                { data: [archivedConversation] },
            ] as never)
            mockTwistApi.workspaceUsers.getUserById.mockResolvedValue({ name: 'Alice' })

            const result = await listConversations.execute(
                { workspaceId: TEST_IDS.WORKSPACE_1, includeArchived: true },
                mockTwistApi,
            )

            // Should use batch for the two getConversations calls (and a second call for users)
            expect(mockTwistApi.batch).toHaveBeenCalled()

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.totalConversations).toBe(2)
            expect(structuredContent.conversations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ title: 'Active Chat', archived: false }),
                    expect.objectContaining({ title: 'Archived Chat', archived: true }),
                ]),
            )
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error(TEST_ERRORS.API_UNAUTHORIZED)
            mockTwistApi.conversations.getConversations.mockRejectedValue(apiError)

            await expect(
                listConversations.execute({ workspaceId: TEST_IDS.WORKSPACE_1 }, mockTwistApi),
            ).rejects.toThrow(TEST_ERRORS.API_UNAUTHORIZED)
        })
    })
})
