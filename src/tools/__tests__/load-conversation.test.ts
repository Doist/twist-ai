import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockConversation,
    createMockConversationMessage,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { loadConversation } from '../load-conversation.js'

// Mock the Twist API
const mockTwistApi = {
    batch: jest.fn(),
    conversations: {
        getConversation: jest.fn(),
    },
    conversationMessages: {
        getMessages: jest.fn(),
    },
    workspaceUsers: {
        getUserById: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { LOAD_CONVERSATION } = ToolNames

describe(`${LOAD_CONVERSATION} tool`, () => {
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

    describe('loading conversations successfully', () => {
        it('should load conversation with messages and participants', async () => {
            const mockConversation = createMockConversation({
                userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            })
            const mockMessages = [
                createMockConversationMessage({ id: TEST_IDS.MESSAGE_1 }),
                createMockConversationMessage({ id: TEST_IDS.MESSAGE_2 }),
            ]

            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.getMessages.mockResolvedValue(mockMessages)
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

            const result = await loadConversation.execute(
                { conversationId: TEST_IDS.CONVERSATION_1, limit: 50, includeParticipants: true },
                mockTwistApi,
            )

            expect(mockTwistApi.conversations.getConversation).toHaveBeenCalledWith(
                TEST_IDS.CONVERSATION_1,
                { batch: true },
            )
            expect(mockTwistApi.conversationMessages.getMessages).toHaveBeenCalledWith(
                {
                    conversationId: TEST_IDS.CONVERSATION_1,
                    newerThan: undefined,
                    olderThan: undefined,
                    limit: 50,
                },
                { batch: true },
            )
            // Verify user info is fetched for each participant
            expect(mockTwistApi.workspaceUsers.getUserById).toHaveBeenCalledWith(
                mockConversation.workspaceId,
                TEST_IDS.USER_1,
                { batch: true },
            )
            expect(mockTwistApi.workspaceUsers.getUserById).toHaveBeenCalledWith(
                mockConversation.workspaceId,
                TEST_IDS.USER_2,
                { batch: true },
            )

            expect(extractTextContent(result)).toMatchSnapshot()

            // Verify structured content
            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'conversation_data',
                    totalMessages: mockConversation.messageCount,
                }),
            )
            expect(structuredContent?.conversation.id).toBe(TEST_IDS.CONVERSATION_1)
            expect(structuredContent?.conversation.workspaceId).toBe(mockConversation.workspaceId)
            expect(structuredContent?.conversation.lastActive).toBe('2024-01-01T00:00:00.000Z')
            expect(structuredContent?.conversation.userIds).toEqual([
                TEST_IDS.USER_1,
                TEST_IDS.USER_2,
            ])
            expect(structuredContent?.messages).toHaveLength(2)
            const { messages } = structuredContent || {}
            if (messages?.[0]) {
                expect(messages[0].id).toBe(TEST_IDS.MESSAGE_1)
                expect(messages[0].posted).toBe('2024-01-01T00:00:00.000Z')
                expect(messages[0].creatorName).toBe('Test User 1')
            }
        })

        it('should load conversation without participants when includeParticipants is false', async () => {
            const mockConversation = createMockConversation({
                userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            })
            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.getMessages.mockResolvedValue([])
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

            const result = await loadConversation.execute(
                {
                    conversationId: TEST_IDS.CONVERSATION_1,
                    limit: 50,
                    includeParticipants: false,
                },
                mockTwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toMatchSnapshot()
            expect(textContent).not.toContain('## Participants')
        })

        it('should filter messages by date range', async () => {
            const mockConversation = createMockConversation()
            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.getMessages.mockResolvedValue([])
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

            const result = await loadConversation.execute(
                {
                    conversationId: TEST_IDS.CONVERSATION_1,
                    newerThanDate: '2024-01-01',
                    olderThanDate: '2024-01-31',
                    limit: 50,
                    includeParticipants: true,
                },
                mockTwistApi,
            )

            // Verify dates were converted to Date objects
            expect(mockTwistApi.conversationMessages.getMessages).toHaveBeenCalledWith(
                expect.objectContaining({
                    newerThan: expect.any(Date),
                    olderThan: expect.any(Date),
                }),
                { batch: true },
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should handle conversation with no messages', async () => {
            const mockConversation = createMockConversation()
            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.getMessages.mockResolvedValue([])
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

            const result = await loadConversation.execute(
                { conversationId: TEST_IDS.CONVERSATION_1, limit: 50, includeParticipants: true },
                mockTwistApi,
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })
    })

    describe('error handling', () => {
        it('should propagate conversation not found error', async () => {
            const apiError = new Error('Conversation not found')
            mockTwistApi.conversations.getConversation.mockRejectedValue(apiError)

            await expect(
                loadConversation.execute(
                    {
                        conversationId: TEST_IDS.CONVERSATION_1,
                        limit: 50,
                        includeParticipants: true,
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Conversation not found')
        })
    })
})
