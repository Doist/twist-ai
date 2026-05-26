import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { createMockThread, extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { createThread } from '../create-thread.js'

const mockTwistApi = {
    threads: {
        createThread: jest.fn(),
    },
    inbox: {
        unarchiveThread: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { CREATE_THREAD } = ToolNames

describe(`${CREATE_THREAD} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
        delete process.env.TWIST_CREATE_THREAD_DISPLAY_IN_INBOX
    })

    describe('creating threads', () => {
        it('should create a thread in a channel', async () => {
            const mockThread = createMockThread({
                title: 'New Discussion',
                content: 'Let us discuss this topic',
            })
            mockTwistApi.threads.createThread.mockResolvedValue(mockThread)

            const result = await createThread.execute(
                {
                    channelId: TEST_IDS.CHANNEL_1,
                    title: 'New Discussion',
                    content: 'Let us discuss this topic',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.createThread).toHaveBeenCalledWith({
                channelId: TEST_IDS.CHANNEL_1,
                title: 'New Discussion',
                content: 'Let us discuss this topic',
                recipients: undefined,
            })
            expect(mockTwistApi.inbox.unarchiveThread).not.toHaveBeenCalled()

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'create_thread_result',
                    success: true,
                    threadId: mockThread.id,
                    title: 'New Discussion',
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    content: 'Let us discuss this topic',
                    threadUrl: expect.stringContaining('twist.com'),
                }),
            )
        })

        it('should create a thread with recipients', async () => {
            const mockThread = createMockThread({
                title: 'Notify Users',
                content: 'Important update',
            })
            mockTwistApi.threads.createThread.mockResolvedValue(mockThread)

            const result = await createThread.execute(
                {
                    channelId: TEST_IDS.CHANNEL_1,
                    title: 'Notify Users',
                    content: 'Important update',
                    recipients: [TEST_IDS.USER_1, TEST_IDS.USER_2],
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.createThread).toHaveBeenCalledWith({
                channelId: TEST_IDS.CHANNEL_1,
                title: 'Notify Users',
                content: 'Important update',
                recipients: [TEST_IDS.USER_1, TEST_IDS.USER_2],
            })
            expect(mockTwistApi.inbox.unarchiveThread).not.toHaveBeenCalled()

            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should unarchive the thread when displayInInbox is true', async () => {
            const mockThread = createMockThread({
                title: 'Inbox Thread',
                content: 'Should appear in Inbox',
            })
            mockTwistApi.threads.createThread.mockResolvedValue(mockThread)
            mockTwistApi.inbox.unarchiveThread.mockResolvedValue(undefined as never)

            const result = await createThread.execute(
                {
                    channelId: TEST_IDS.CHANNEL_1,
                    title: 'Inbox Thread',
                    content: 'Should appear in Inbox',
                    displayInInbox: true,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.inbox.unarchiveThread).toHaveBeenCalledWith(mockThread.id)
            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should unarchive the thread when TWIST_CREATE_THREAD_DISPLAY_IN_INBOX env var is set', async () => {
            process.env.TWIST_CREATE_THREAD_DISPLAY_IN_INBOX = 'true'

            const mockThread = createMockThread({
                title: 'Env Var Thread',
                content: 'Should appear in Inbox via env var',
            })
            mockTwistApi.threads.createThread.mockResolvedValue(mockThread)
            mockTwistApi.inbox.unarchiveThread.mockResolvedValue(undefined as never)

            const result = await createThread.execute(
                {
                    channelId: TEST_IDS.CHANNEL_1,
                    title: 'Env Var Thread',
                    content: 'Should appear in Inbox via env var',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.inbox.unarchiveThread).toHaveBeenCalledWith(mockThread.id)
            expect(extractTextContent(result)).toMatchSnapshot()
        })

        it('should not unarchive when displayInInbox is false even if env var is set', async () => {
            process.env.TWIST_CREATE_THREAD_DISPLAY_IN_INBOX = 'true'

            const mockThread = createMockThread({
                title: 'Explicit False Thread',
                content: 'Should not unarchive',
            })
            mockTwistApi.threads.createThread.mockResolvedValue(mockThread)

            await createThread.execute(
                {
                    channelId: TEST_IDS.CHANNEL_1,
                    title: 'Explicit False Thread',
                    content: 'Should not unarchive',
                    displayInInbox: false,
                },
                mockTwistApi,
            )

            expect(mockTwistApi.inbox.unarchiveThread).not.toHaveBeenCalled()
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error('Channel not found')
            mockTwistApi.threads.createThread.mockRejectedValue(apiError)

            await expect(
                createThread.execute(
                    {
                        channelId: TEST_IDS.CHANNEL_1,
                        title: 'Test Thread',
                        content: 'Test content',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Channel not found')
        })
    })
})
