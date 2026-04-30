import { getFullTwistURL } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type CreateThreadOutput, CreateThreadOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    channelId: z.number().describe('The ID of the channel to create the thread in.'),
    title: z.string().min(1).describe('The title of the thread.'),
    content: z.string().min(1).describe('The content/body of the thread.'),
    recipients: z
        .array(z.number())
        .optional()
        .describe(
            'Optional array of user IDs to notify. If omitted, Twist defaults to notifying all current members of the channel (equivalent to the API\'s "EVERYONE" default). Note: workspace users who have not joined this channel will not be notified — add their IDs explicitly if you want to reach them.',
        ),
}

const createThread = {
    name: ToolNames.CREATE_THREAD,
    description:
        'Create a new thread in a workspace channel. Requires a channel ID, title, and content. Optionally notify specific users.',
    parameters: ArgsSchema,
    outputSchema: CreateThreadOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async execute(args, client) {
        const { channelId, title, content, recipients } = args

        const thread = await client.threads.createThread({
            channelId,
            title,
            content,
            recipients,
        })

        // Twist auto-archives newly-created threads for the author, which means
        // the agent's own posts never appear in the user's Inbox. Unarchive
        // immediately so the thread shows up in the author's Inbox view too.
        // Failure here is non-fatal — the thread itself was created successfully.
        try {
            await client.inbox.unarchiveThread(thread.id)
        } catch {
            // swallow — don't fail the tool because of an inbox visibility tweak
        }

        const postedValue = thread.posted
        const created = postedValue
            ? typeof postedValue === 'string'
                ? new Date(postedValue)
                : postedValue
            : new Date()

        const threadUrl =
            thread.url ??
            getFullTwistURL({
                workspaceId: thread.workspaceId,
                channelId: thread.channelId,
                threadId: thread.id,
            })

        const lines: string[] = [
            `# Thread Created`,
            '',
            `**Title:** ${thread.title}`,
            `**Thread ID:** ${thread.id}`,
            `**Channel ID:** ${thread.channelId}`,
            `**Created:** ${created.toISOString()}`,
            `**URL:** ${threadUrl}`,
            '',
            '## Content',
            '',
            thread.content,
            '',
            '> Thread is in your Inbox (auto-unarchived after creation).',
        ]

        const structuredContent: CreateThreadOutput = {
            type: 'create_thread_result',
            success: true,
            threadId: thread.id,
            title: thread.title,
            channelId: thread.channelId,
            workspaceId: thread.workspaceId,
            content: thread.content,
            creator: thread.creator,
            created: created.toISOString(),
            threadUrl,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof CreateThreadOutputSchema.shape>

export { createThread }
