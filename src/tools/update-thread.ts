import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type UpdateThreadOutput, UpdateThreadOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    id: z.number().describe('The ID of the thread to update.'),
    title: z.string().min(1).optional().describe('The new title for the thread.'),
    content: z.string().min(1).optional().describe('The new content/body for the thread.'),
}

const updateThread = {
    name: ToolNames.UPDATE_THREAD,
    description:
        "Update an existing thread's title and/or content. Requires the thread ID and at least one of title or content to update.",
    parameters: ArgsSchema,
    outputSchema: UpdateThreadOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { id, title, content } = args

        if (title === undefined && content === undefined) {
            throw new Error('At least one of `title` or `content` must be provided.')
        }

        const thread = await client.threads.updateThread({
            id,
            title,
            content,
        })

        const threadUrl =
            thread.url ??
            getFullTwistURL({
                workspaceId: thread.workspaceId,
                channelId: thread.channelId,
                threadId: thread.id,
            })

        const lastEdited = thread.lastEdited ? thread.lastEdited.toISOString() : undefined

        const lines: string[] = [
            `# Thread Updated`,
            '',
            `**Title:** ${thread.title}`,
            `**Thread ID:** ${thread.id}`,
            `**Channel ID:** ${thread.channelId}`,
            ...(lastEdited ? [`**Last Edited:** ${lastEdited}`] : []),
            `**URL:** ${threadUrl}`,
            '',
            '## Content',
            '',
            thread.content,
        ]

        const structuredContent: UpdateThreadOutput = {
            type: 'update_thread_result',
            success: true,
            threadId: thread.id,
            title: thread.title,
            channelId: thread.channelId,
            workspaceId: thread.workspaceId,
            content: thread.content,
            threadUrl,
            lastEdited,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof UpdateThreadOutputSchema.shape>

export { updateThread }
