import type { TwistApi } from '@doist/twist-sdk'
import { extractTextContent } from '../../utils/test-helpers.js'
import { buildLink } from '../build-link.js'

describe('buildLink', () => {
    describe('conversation links', () => {
        test('builds a conversation link', async () => {
            const result = await buildLink.execute(
                {
                    workspaceId: 123,
                    conversationId: 456,
                    fullUrl: true,
                },
                {} as TwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toBe('https://twist.com/a/123/msg/456/')
            expect(result.structuredContent?.type).toBe('link_data')
            expect(result.structuredContent?.linkType).toBe('conversation')
            expect(result.structuredContent?.url).toBe('https://twist.com/a/123/msg/456/')
        })

        test('builds a message link', async () => {
            const result = await buildLink.execute(
                {
                    workspaceId: 123,
                    conversationId: 456,
                    messageId: 789,
                    fullUrl: true,
                },
                {} as TwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toBe('https://twist.com/a/123/msg/456/m/789')
            expect(result.structuredContent?.linkType).toBe('message')
        })

        test('builds a relative conversation link', async () => {
            const result = await buildLink.execute(
                {
                    workspaceId: 123,
                    conversationId: 456,
                    fullUrl: false,
                },
                {} as TwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toBe('/a/123/msg/456/')
        })
    })

    describe('thread links', () => {
        test('builds a thread link with channel', async () => {
            const result = await buildLink.execute(
                {
                    workspaceId: 123,
                    channelId: 42,
                    threadId: 789,
                    fullUrl: true,
                },
                {} as TwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toBe('https://twist.com/a/123/ch/42/t/789/')
            expect(result.structuredContent?.linkType).toBe('thread')
        })

        test('builds a thread link without channel (inbox)', async () => {
            const result = await buildLink.execute(
                {
                    workspaceId: 123,
                    threadId: 789,
                    fullUrl: true,
                },
                {} as TwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toBe('https://twist.com/a/123/inbox/t/789/')
            expect(result.structuredContent?.linkType).toBe('thread')
        })

        test('builds a comment link', async () => {
            const result = await buildLink.execute(
                {
                    workspaceId: 123,
                    channelId: 42,
                    threadId: 789,
                    commentId: 999,
                    fullUrl: true,
                },
                {} as TwistApi,
            )

            const textContent = extractTextContent(result)
            expect(textContent).toBe('https://twist.com/a/123/ch/42/t/789/c/999')
            expect(result.structuredContent?.linkType).toBe('comment')
        })

        test('throws error for comment without channelId', async () => {
            await expect(
                buildLink.execute(
                    {
                        workspaceId: 123,
                        threadId: 789,
                        commentId: 999,
                        fullUrl: true,
                    },
                    {} as TwistApi,
                ),
            ).rejects.toThrow('channelId is required when building a comment link')
        })
    })

    describe('error handling', () => {
        test('throws error when neither conversationId nor threadId provided', async () => {
            await expect(
                buildLink.execute(
                    {
                        workspaceId: 123,
                        fullUrl: true,
                    },
                    {} as TwistApi,
                ),
            ).rejects.toThrow('Must provide either conversationId OR threadId to build a link')
        })
    })

    describe('structured content', () => {
        test('includes all params in structured content', async () => {
            const result = await buildLink.execute(
                {
                    workspaceId: 123,
                    channelId: 42,
                    threadId: 789,
                    commentId: 999,
                    fullUrl: true,
                },
                {} as TwistApi,
            )

            expect(result.structuredContent?.params).toEqual({
                workspaceId: 123,
                channelId: 42,
                threadId: 789,
                commentId: 999,
                conversationId: undefined,
                messageId: undefined,
            })
        })
    })
})
