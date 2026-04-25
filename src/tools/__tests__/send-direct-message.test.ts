import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockConversation,
    createMockConversationMessage,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { sendDirectMessage } from '../send-direct-message.js'

const mockTwistApi = {
    conversations: {
        getOrCreateConversation: jest.fn(),
    },
    conversationMessages: {
        createMessage: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { SEND_DIRECT_MESSAGE } = ToolNames

describe(`${SEND_DIRECT_MESSAGE} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should create a new DM conversation and post a message when none exists', async () => {
        const mockConversation = createMockConversation({
            userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            messageCount: 0,
        })
        const mockMessage = createMockConversationMessage()

        mockTwistApi.conversations.getOrCreateConversation.mockResolvedValue(mockConversation)
        mockTwistApi.conversationMessages.createMessage.mockResolvedValue(mockMessage)

        const result = await sendDirectMessage.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                userIds: [TEST_IDS.USER_2],
                content: 'Hello there',
            },
            mockTwistApi,
        )

        expect(mockTwistApi.conversations.getOrCreateConversation).toHaveBeenCalledWith({
            workspaceId: TEST_IDS.WORKSPACE_1,
            userIds: [TEST_IDS.USER_2],
        })
        expect(mockTwistApi.conversationMessages.createMessage).toHaveBeenCalledWith({
            conversationId: mockConversation.id,
            content: 'Hello there',
        })

        expect(extractTextContent(result)).toMatchSnapshot()

        const { structuredContent } = result
        expect(structuredContent).toEqual(
            expect.objectContaining({
                type: 'send_direct_message_result',
                success: true,
                conversationId: mockConversation.id,
                workspaceId: mockConversation.workspaceId,
                userIds: mockConversation.userIds,
                messageId: mockMessage.id,
                content: 'Hello there',
                createdConversation: true,
                conversationUrl: expect.stringContaining('twist.com'),
                messageUrl: expect.stringContaining('twist.com'),
            }),
        )
    })

    it('should reuse an existing conversation and flag it as not newly created', async () => {
        const mockConversation = createMockConversation({
            userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            messageCount: 12,
        })
        const mockMessage = createMockConversationMessage()

        mockTwistApi.conversations.getOrCreateConversation.mockResolvedValue(mockConversation)
        mockTwistApi.conversationMessages.createMessage.mockResolvedValue(mockMessage)

        const result = await sendDirectMessage.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                userIds: [TEST_IDS.USER_2],
                content: 'Hello again',
            },
            mockTwistApi,
        )

        const { structuredContent } = result
        expect(structuredContent?.createdConversation).toBe(false)
    })

    it('should support a group DM with multiple user IDs', async () => {
        const mockConversation = createMockConversation({
            userIds: [TEST_IDS.USER_1, TEST_IDS.USER_2, 99999],
            messageCount: 0,
        })
        mockTwistApi.conversations.getOrCreateConversation.mockResolvedValue(mockConversation)
        mockTwistApi.conversationMessages.createMessage.mockResolvedValue(
            createMockConversationMessage(),
        )

        await sendDirectMessage.execute(
            {
                workspaceId: TEST_IDS.WORKSPACE_1,
                userIds: [TEST_IDS.USER_2, 99999],
                content: 'Group ping',
            },
            mockTwistApi,
        )

        expect(mockTwistApi.conversations.getOrCreateConversation).toHaveBeenCalledWith({
            workspaceId: TEST_IDS.WORKSPACE_1,
            userIds: [TEST_IDS.USER_2, 99999],
        })
    })

    it('should propagate getOrCreateConversation errors', async () => {
        mockTwistApi.conversations.getOrCreateConversation.mockRejectedValue(
            new Error('Workspace not found'),
        )

        await expect(
            sendDirectMessage.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    userIds: [TEST_IDS.USER_2],
                    content: 'Hi',
                },
                mockTwistApi,
            ),
        ).rejects.toThrow('Workspace not found')

        expect(mockTwistApi.conversationMessages.createMessage).not.toHaveBeenCalled()
    })

    it('should propagate createMessage errors after the conversation exists', async () => {
        mockTwistApi.conversations.getOrCreateConversation.mockResolvedValue(
            createMockConversation(),
        )
        mockTwistApi.conversationMessages.createMessage.mockRejectedValue(new Error('Rate limited'))

        await expect(
            sendDirectMessage.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    userIds: [TEST_IDS.USER_2],
                    content: 'Hi',
                },
                mockTwistApi,
            ),
        ).rejects.toThrow('Rate limited')
    })
})
