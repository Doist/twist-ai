import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockConversation,
    createMockConversationMessage,
    extractStructuredContent,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { createConversation } from '../create-conversation.js'

const mockTwistApi = {
    authToken: 'oauth2:test-token',
    conversations: {
        getOrCreateConversation: jest.fn(),
    },
    conversationMessages: {
        createMessage: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { CREATE_CONVERSATION } = ToolNames

describe(`${CREATE_CONVERSATION} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('creates (or reuses) a conversation and posts the first message', async () => {
        const mockConversation = createMockConversation({
            userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
        })
        const mockMessage = createMockConversationMessage({ content: 'Kickoff message' })
        mockTwistApi.conversations.getOrCreateConversation.mockResolvedValue(mockConversation)
        mockTwistApi.conversationMessages.createMessage.mockResolvedValue(mockMessage)

        const result = await createConversation.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                recipients: [TEST_IDS.USER_2],
                content: 'Kickoff message',
            },
            mockTwistApi,
        )

        expect(mockTwistApi.conversations.getOrCreateConversation).toHaveBeenCalledWith({
            workspaceId: TEST_IDS.WORKSPACE_1,
            userIds: [TEST_IDS.USER_2],
        })
        expect(mockTwistApi.conversationMessages.createMessage).toHaveBeenCalledWith({
            conversationId: mockConversation.id,
            content: 'Kickoff message',
        })

        expect(extractTextContent(result)).toMatchSnapshot()

        const structuredContent = extractStructuredContent(result)
        expect(structuredContent).toEqual(
            expect.objectContaining({
                type: 'create_conversation_result',
                success: true,
                conversationId: mockConversation.id,
                messageId: mockMessage.id,
                workspaceId: TEST_IDS.WORKSPACE_1,
                content: 'Kickoff message',
                recipients: [TEST_IDS.USER_2],
                participants: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            }),
        )
        expect(structuredContent.conversationUrl).toEqual(expect.stringContaining('twist.com'))
        expect(structuredContent.messageUrl).toEqual(expect.stringContaining('twist.com'))
    })

    describe('error handling', () => {
        it('propagates conversation creation errors', async () => {
            mockTwistApi.conversations.getOrCreateConversation.mockRejectedValue(
                new Error('Workspace not found'),
            )

            await expect(
                createConversation.execute(
                    {
                        workspaceId: TEST_IDS.WORKSPACE_1,
                        recipients: [TEST_IDS.USER_2],
                        content: 'Hello',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Workspace not found')

            expect(mockTwistApi.conversationMessages.createMessage).not.toHaveBeenCalled()
        })
    })
})
