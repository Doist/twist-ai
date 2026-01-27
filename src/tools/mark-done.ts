import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { MarkDoneOutputSchema } from '../utils/output-schemas.js'
import { type MarkDoneType, MarkDoneTypeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    type: MarkDoneTypeSchema.describe('The type of items to mark as done: thread or conversation.'),

    // Individual IDs
    ids: z
        .array(z.number())
        .optional()
        .describe(
            'Specific thread or conversation IDs to mark as done. Use this OR bulk selectors.',
        ),

    // Bulk selectors (for threads only)
    workspaceId: z
        .number()
        .optional()
        .describe('Mark all threads in this workspace as done (threads only).'),
    channelId: z
        .number()
        .optional()
        .describe('Mark all threads in this channel as done (threads only).'),

    // Operations
    markRead: z.boolean().optional().describe('Mark items as read (default: true).'),
    archive: z
        .boolean()
        .optional()
        .describe('Archive items in the inbox (threads only, default: true).'),
    clearUnread: z
        .boolean()
        .optional()
        .describe(
            'Clear all unread markers for workspace (threads only, requires workspaceId, default: false).',
        ),
}

type MarkDoneStructured = {
    type: 'mark_done_result'
    itemType: MarkDoneType
    mode: 'individual' | 'bulk'
    completed: number[]
    failed: Array<{ item: number; error: string }>
    totalRequested: number
    successCount: number
    failureCount: number
    operations: {
        markRead: boolean
        archive: boolean
        clearUnread: boolean
    }
    selectors?: {
        workspaceId?: number
        channelId?: number
    }
}

const markDone = {
    name: ToolNames.MARK_DONE,
    description:
        'Mark threads or conversations as done. Supports individual IDs or bulk operations (mark all in workspace/channel). For threads: can mark as read, archive in inbox, or clear all unread. For conversations: can mark as read and archive.',
    parameters: ArgsSchema,
    outputSchema: MarkDoneOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async execute(args, client) {
        const {
            type,
            ids,
            workspaceId,
            channelId,
            markRead = true,
            archive = true,
            clearUnread = false,
        } = args

        const completed: number[] = []
        const failed: Array<{ item: number; error: string }> = []
        let mode: 'individual' | 'bulk' = 'individual'

        // Validate arguments
        if (!ids && !workspaceId && !channelId) {
            throw new Error('Must provide either ids, workspaceId, or channelId')
        }

        if (type === 'conversation' && (workspaceId || channelId || clearUnread)) {
            throw new Error(
                'Bulk operations (workspaceId, channelId, clearUnread) are only supported for threads',
            )
        }

        try {
            // Bulk operations (threads only)
            if (type === 'thread' && (workspaceId || channelId)) {
                mode = 'bulk'

                // Clear unread takes precedence
                if (clearUnread && workspaceId) {
                    await client.threads.clearUnread(workspaceId)
                } else {
                    // Mark all read
                    if (markRead) {
                        if (workspaceId) {
                            await client.threads.markAllRead({ workspaceId })
                        } else if (channelId) {
                            await client.threads.markAllRead({ channelId })
                        }
                    }

                    // Archive all (inbox operations)
                    if (archive) {
                        if (workspaceId) {
                            await client.inbox.archiveAll({ workspaceId })
                        } else if (channelId) {
                            await client.inbox.archiveAll({
                                workspaceId: 0,
                                channelIds: [channelId],
                            })
                        }
                    }
                }

                // We don't get individual IDs back from bulk operations
                // Just indicate success
            } else if (ids && ids.length > 0) {
                // Individual operations - batch them together
                mode = 'individual'

                // Build array of batch operations for each ID
                const operations = []
                for (const id of ids) {
                    if (type === 'thread') {
                        // Mark thread as read
                        if (markRead) {
                            operations.push(
                                client.threads.markRead({ id, objIndex: 0 }, { batch: true }),
                            )
                        }
                        // Archive thread in inbox
                        if (archive) {
                            operations.push(client.inbox.archiveThread(id, { batch: true }))
                        }
                    } else {
                        // Mark conversation as read
                        if (markRead) {
                            operations.push(client.conversations.markRead({ id }, { batch: true }))
                        }
                        // Archive conversation
                        if (archive) {
                            operations.push(
                                client.conversations.archiveConversation(id, { batch: true }),
                            )
                        }
                    }
                }

                // Execute all operations in batch
                try {
                    await client.batch(...operations)
                    // All operations succeeded
                    completed.push(...ids)
                } catch (_error) {
                    // If batch fails, we need to fall back to individual operations to track which ones failed
                    for (const id of ids) {
                        try {
                            if (type === 'thread') {
                                if (markRead) {
                                    await client.threads.markRead({ id, objIndex: 0 })
                                }
                                if (archive) {
                                    await client.inbox.archiveThread(id)
                                }
                            } else {
                                if (markRead) {
                                    await client.conversations.markRead({ id })
                                }
                                if (archive) {
                                    await client.conversations.archiveConversation(id)
                                }
                            }
                            completed.push(id)
                        } catch (individualError) {
                            const errorMessage =
                                individualError instanceof Error
                                    ? individualError.message
                                    : 'Unknown error'
                            failed.push({
                                item: id,
                                error: errorMessage,
                            })
                        }
                    }
                }
            }
        } catch (error) {
            // Bulk operation failed entirely
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            throw new Error(`Bulk operation failed: ${errorMessage}`)
        }

        // Build text content
        const lines: string[] = [
            `# Mark ${type === 'thread' ? 'Threads' : 'Conversations'} Done`,
            '',
        ]

        lines.push(`**Mode:** ${mode === 'bulk' ? 'Bulk Operation' : 'Individual IDs'}`)

        if (mode === 'bulk') {
            if (workspaceId) {
                lines.push(`**Workspace ID:** ${workspaceId}`)
            }
            if (channelId) {
                lines.push(`**Channel ID:** ${channelId}`)
            }
            if (clearUnread) {
                lines.push('**Operation:** Clear all unread markers')
            } else {
                lines.push(`**Mark Read:** ${markRead ? 'Yes' : 'No'}`)
                lines.push(`**Archive:** ${archive ? 'Yes' : 'No'}`)
            }
            lines.push('')
            lines.push('✅ Bulk operation completed successfully')
        } else {
            lines.push(`**Total Requested:** ${ids?.length ?? 0}`)
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
        }

        // Add next steps
        lines.push('## Next Steps')
        lines.push('')
        if (mode === 'bulk' || (failed.length === 0 && completed.length > 0)) {
            lines.push(
                type === 'thread'
                    ? 'Use `fetch-inbox` to see remaining unread threads.'
                    : 'Check your conversations for remaining unread messages.',
            )
        } else if (failed.length > 0) {
            lines.push('Review failed items and retry if needed.')
        }

        const structuredContent: MarkDoneStructured = {
            type: 'mark_done_result',
            itemType: type,
            mode,
            completed,
            failed,
            totalRequested: ids?.length ?? 0,
            successCount: completed.length,
            failureCount: failed.length,
            operations: {
                markRead,
                archive,
                clearUnread,
            },
            selectors:
                workspaceId || channelId
                    ? {
                          workspaceId,
                          channelId,
                      }
                    : undefined,
        }

        return getToolOutput({
            textContent: lines.join('\n'),
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof MarkDoneOutputSchema.shape>

export { markDone, type MarkDoneStructured }
