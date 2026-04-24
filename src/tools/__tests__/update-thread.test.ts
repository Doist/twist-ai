import type { TwistApi } from '@doist/twist-sdk'
import { jest } from '@jest/globals'
import { createMockThread, extractTextContent, TEST_IDS } from '../../utils/test-helpers.js'
import { ToolNames } from '../../utils/tool-names.js'
import { updateThread } from '../update-thread.js'

const mockTwistApi = {
    threads: {
        updateThread: jest.fn(),
    },
} as unknown as jest.Mocked<TwistApi>

const { UPDATE_THREAD } = ToolNames

describe(`${UPDATE_THREAD} tool`, () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('updating threads', () => {
        it('should update a thread title and content', async () => {
            const mockThread = createMockThread({
                title: 'Updated Title',
                content: 'Updated content',
                lastEdited: new Date('2025-02-03T12:34:56Z'),
            })
            mockTwistApi.threads.updateThread.mockResolvedValue(mockThread)

            const result = await updateThread.execute(
                {
                    id: TEST_IDS.THREAD_1,
                    title: 'Updated Title',
                    content: 'Updated content',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.updateThread).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                title: 'Updated Title',
                content: 'Updated content',
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_thread_result',
                    success: true,
                    threadId: mockThread.id,
                    title: 'Updated Title',
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    content: 'Updated content',
                    threadUrl: expect.stringContaining('twist.com'),
                    lastEdited: '2025-02-03T12:34:56.000Z',
                }),
            )
        })

        it('should update only the thread title', async () => {
            const mockThread = createMockThread({
                title: 'New Title Only',
            })
            mockTwistApi.threads.updateThread.mockResolvedValue(mockThread)

            const result = await updateThread.execute(
                {
                    id: TEST_IDS.THREAD_1,
                    title: 'New Title Only',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.updateThread).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                title: 'New Title Only',
                content: undefined,
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_thread_result',
                    success: true,
                    threadId: mockThread.id,
                    title: 'New Title Only',
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    content: mockThread.content,
                    threadUrl: expect.stringContaining('twist.com'),
                }),
            )
        })

        it('should update only the thread content', async () => {
            const mockThread = createMockThread({
                content: 'New content only',
            })
            mockTwistApi.threads.updateThread.mockResolvedValue(mockThread)

            const result = await updateThread.execute(
                {
                    id: TEST_IDS.THREAD_1,
                    content: 'New content only',
                },
                mockTwistApi,
            )

            expect(mockTwistApi.threads.updateThread).toHaveBeenCalledWith({
                id: TEST_IDS.THREAD_1,
                title: undefined,
                content: 'New content only',
            })

            expect(extractTextContent(result)).toMatchSnapshot()

            const { structuredContent } = result
            expect(structuredContent).toEqual(
                expect.objectContaining({
                    type: 'update_thread_result',
                    success: true,
                    threadId: mockThread.id,
                    title: mockThread.title,
                    channelId: TEST_IDS.CHANNEL_1,
                    workspaceId: TEST_IDS.WORKSPACE_1,
                    content: 'New content only',
                    threadUrl: expect.stringContaining('twist.com'),
                }),
            )
        })
    })

    describe('validation', () => {
        it('should throw when neither title nor content is provided', async () => {
            await expect(
                updateThread.execute({ id: TEST_IDS.THREAD_1 }, mockTwistApi),
            ).rejects.toThrow('At least one of `title` or `content` must be provided.')

            expect(mockTwistApi.threads.updateThread).not.toHaveBeenCalled()
        })
    })

    describe('error handling', () => {
        it('should propagate API errors', async () => {
            const apiError = new Error('Thread not found')
            mockTwistApi.threads.updateThread.mockRejectedValue(apiError)

            await expect(
                updateThread.execute(
                    {
                        id: TEST_IDS.THREAD_1,
                        title: 'Updated Title',
                    },
                    mockTwistApi,
                ),
            ).rejects.toThrow('Thread not found')
        })
    })
})
