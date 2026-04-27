import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import {
    createMockConversationMessage,
    extractTextContent,
    TEST_IDS,
} from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { updateMessage } from '../update-message.js'

const mockTwistApi = {
    conversationMessages: {
        updateMessage: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { UPDATE_MESSAGE } = ToolNames

describe(`${UPDATE_MESSAGE} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('updating messages', () => {
        it('should update a conversation message content', async () => {
            const mockMessage = createMockConversationMessage({
                content: 'Updated message content',
                lastEdited: new Date('2025-02-03T12:34:56Z'),
            })
            mockTwistApi.conversationMessages.updateMessage.mockResolvedValue(mockMessage)

            const result = await updateMessage.execute(
                {
                    id: TEST_IDS.MESSAGE_1,
                    content: 'Updated message content',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.updateMessage).toHaveBeenCalledWith({
                id: TEST_IDS.MESSAGE_1,
                content: 'Updated message content',
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_message_result',
                    success: true,
                    messageId: mockMessage.id,
                    conversationId: mockMessage.conversationId,
                    workspaceId: mockMessage.workspaceId,
                    content: 'Updated message content',
                    messageUrl: expect.stringContaining('twist.com'),
                    lastEdited: '2025-02-03T12:34:56.000Z',
                }),
            )
        })

        it('should omit lastEdited when not returned by the API', async () => {
            const mockMessage = createMockConversationMessage({
                content: 'Edited again',
                lastEdited: null,
            })
            mockTwistApi.conversationMessages.updateMessage.mockResolvedValue(mockMessage)

            const result = await updateMessage.execute(
                {
                    id: TEST_IDS.MESSAGE_1,
                    content: 'Edited again',
                },
                mockTwistApi,
            )

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_message_result',
                    success: true,
                    lastEdited: undefined,
                }),
            )
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error('Message not found')
            mockTwistApi.conversationMessages.updateMessage.mockRejectedValue(apiError)

            await expect(
                updateMessage.execute(
                    {
                        id: TEST_IDS.MESSAGE_1,
                        content: 'Updated content',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Message not found')
        })
    })
})
