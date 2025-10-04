import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type MarkDoneType, MarkDoneTypeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    type: MarkDoneTypeSchema.describe('The type of items to mark as done.'),
    ids: z
        .array(z.number())
        .min(1)
        .describe('The IDs of threads or conversations to mark as done.'),
    markRead: z.boolean().optional().default(true).describe('Mark items as read.'),
    archive: z.boolean().optional().default(true).describe('Archive items in the inbox.'),
}

type MarkDoneStructured = {
    type: 'mark_done_result'
    itemType: MarkDoneType
    completed: number[]
    failed: Array<{ item: number; error: string }>
    totalRequested: number
    successCount: number
    failureCount: number
    operations: {
        markRead: boolean
        archive: boolean
    }
}

const markDone = {
    name: ToolNames.MARK_DONE,
    description:
        'Mark threads or conversations as done by marking them as read and/or archiving them. Supports bulk operations.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { type, ids, markRead, archive } = args

        const completed: number[] = []
        const failed: Array<{ item: number; error: string }> = []

        for (const id of ids) {
            try {
                if (type === 'thread') {
                    // Mark thread as read
                    if (markRead) {
                        await client.threads.markRead(id)
                    }

                    // Archive thread in inbox
                    if (archive) {
                        await client.inbox.archiveThread(id)
                    }
                } else {
                    // Mark conversation as read
                    if (markRead) {
                        await client.conversations.markRead(id)
                    }

                    // Note: Conversations don't have a separate inbox archive operation
                    // They are archived via the conversations client
                    if (archive) {
                        await client.conversations.archiveConversation(id)
                    }
                }

                completed.push(id)
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                failed.push({
                    item: id,
                    error: errorMessage,
                })
            }
        }

        // Build text content
        const lines: string[] = [
            `# Mark ${type === 'thread' ? 'Threads' : 'Conversations'} Done`,
            '',
        ]

        lines.push(`**Total Requested:** ${ids.length}`)
        lines.push(`**Successful:** ${completed.length}`)
        lines.push(`**Failed:** ${failed.length}`)
        lines.push(`**Mark Read:** ${markRead ? 'Yes' : 'No'}`)
        lines.push(`**Archive:** ${archive ? 'Yes' : 'No'}`)
        lines.push('')

        if (completed.length > 0) {
            lines.push('## Completed')
            lines.push('')
            lines.push(completed.join(', '))
            lines.push('')
        }

        if (failed.length > 0) {
            lines.push('## Failed')
            lines.push('')
            for (const failure of failed) {
                lines.push(`- ${type} ${failure.item}: ${failure.error}`)
            }
            lines.push('')
        }

        // Add next steps
        if (failed.length === 0 && completed.length > 0) {
            lines.push('## Next Steps')
            lines.push('')
            lines.push(
                `All ${type}s marked as done successfully. ${type === 'thread' ? 'Use fetch_inbox to see remaining unread threads.' : 'Check your conversations for remaining unread messages.'}`,
            )
        } else if (failed.length > 0) {
            lines.push('## Next Steps')
            lines.push('')
            lines.push('Review failed items and retry if needed.')
        }

        const structuredContent: MarkDoneStructured = {
            type: 'mark_done_result',
            itemType: type,
            completed,
            failed,
            totalRequested: ids.length,
            successCount: completed.length,
            failureCount: failed.length,
            operations: {
                markRead,
                archive,
            },
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { markDone, type MarkDoneStructured }
