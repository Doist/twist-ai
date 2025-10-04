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
    conversations: {
        getConversation: jest.fn(),
    },
    conversationMessages: {
        getMessages: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { LOAD_CONVERSATION } = ToolNames

describe(`${LOAD_CONVERSATION} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
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

            const result = await loadConversation.execute(
                { conversationId: TEST_IDS.CONVERSATION_1, limit: 50, includeParticipants: true },
                mockTwistApi,
            )

            expect(mockTwistApi.conversations.getConversation).toHaveBeenCalledWith(
                TEST_IDS.CONVERSATION_1,
            )
            expect(mockTwistApi.conversationMessages.getMessages).toHaveBeenCalledWith({
                conversationId: TEST_IDS.CONVERSATION_1,
                newerThan: undefined,
                olderThan: undefined,
                limit: 50,
            })

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should load conversation without participants when includeParticipants is false', async () => {
            const mockConversation = createMockConversation({
                userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            })
            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.getMessages.mockResolvedValue([])

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
            )

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should handle conversation with no messages', async () => {
            const mockConversation = createMockConversation()
            mockTwistApi.conversations.getConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.getMessages.mockResolvedValue([])

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
