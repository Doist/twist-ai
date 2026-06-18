import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
        expect(structuredContent).not.toHaveProperty('attachmentNames')
    })

    describe('with attachments', () => {
        let tmpDir: string
        const originalFetch = globalThis.fetch

        beforeEach(async () => {
            tmpDir = await mkdtemp(join(tmpdir(), 'twist-cc-'))
        })

        afterEach(async () => {
            globalThis.fetch = originalFetch
            await rm(tmpDir, { recursive: true, force: true })
        })

        it('uploads files and attaches them to the first message', async () => {
            const filePath = join(tmpDir, 'spec.pdf')
            await writeFile(filePath, 'binary')

            const uploaded = { attachmentId: 'att-1', fileName: 'spec.pdf', urlType: 'file' }
            globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => uploaded,
                text: async () => JSON.stringify(uploaded),
            } as unknown as Response)

            const mockConversation = createMockConversation()
            const mockMessage = createMockConversationMessage({ content: 'See attached' })
            mockTwistApi.conversations.getOrCreateConversation.mockResolvedValue(mockConversation)
            mockTwistApi.conversationMessages.createMessage.mockResolvedValue(mockMessage)

            const result = await createConversation.execute(
                {
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    recipients: [TEST_IDS.USER_2],
                    content: 'See attached',
                    attachments: [filePath],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.conversationMessages.createMessage).toHaveBeenCalledWith({
                conversationId: mockConversation.id,
                content: 'See attached',
                attachments: [uploaded],
            })

            const structuredContent = extractStructuredContent(result)
            expect(structuredContent.attachmentCount).toBe(1)
            expect(structuredContent.attachmentNames).toEqual(['spec.pdf'])
        })
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
