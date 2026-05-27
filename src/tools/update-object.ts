import { getFullTwistURL, type TwistApi } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import {
    type UpdateCommentOutput,
    type UpdateMessageOutput,
    UpdateObjectOutputSchema,
    type UpdateObjectStructured,
    type UpdateThreadOutput,
} from '../utils/output-schemas.js'
import { UpdateTargetTypeSchema } from '../utils/target-types.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    targetType: UpdateTargetTypeSchema.describe(
        'The type of object to update: thread, comment, or message.',
    ),
    targetId: z
        .number()
        .describe('The ID of the thread, comment, or conversation message to update.'),
    content: z
        .string()
        .min(1)
        .optional()
        .describe(
            'The new content/body. Required for comments and messages; for threads, optional if title is provided.',
        ),
    title: z
        .string()
        .min(1)
        .optional()
        .describe('The new title. Only valid when targetType is "thread".'),
}

type Args = z.infer<z.ZodObject<typeof ArgsSchema>>
type Branch = { textContent: string; structuredContent: UpdateObjectStructured }

async function updateThreadBranch(args: Args, client: TwistApi): Promise<Branch> {
    const { targetId, title, content } = args

    if (title === undefined && content === undefined) {
        throw new Error('At least one of `title` or `content` must be provided.')
    }

    const thread = await client.threads.updateThread({ id: targetId, title, content })

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

    return { textContent: lines.join('\n'), structuredContent }
}

async function updateCommentBranch(args: Args, client: TwistApi): Promise<Branch> {
    const { targetId, content } = args
    if (content === undefined) {
        throw new Error('`content` is required when targetType is "comment".')
    }

    const comment = await client.comments.updateComment({ id: targetId, content })

    const commentUrl =
        comment.url ??
        getFullTwistURL({
            workspaceId: comment.workspaceId,
            channelId: comment.channelId,
            threadId: comment.threadId,
            commentId: comment.id,
        })

    const lastEdited = comment.lastEdited ? comment.lastEdited.toISOString() : undefined

    const lines: string[] = [
        `# Comment Updated`,
        '',
        `**Comment ID:** ${comment.id}`,
        `**Thread ID:** ${comment.threadId}`,
        `**Channel ID:** ${comment.channelId}`,
        ...(lastEdited ? [`**Last Edited:** ${lastEdited}`] : []),
        `**URL:** ${commentUrl}`,
        '',
        '## Content',
        '',
        comment.content,
    ]

    const structuredContent: UpdateCommentOutput = {
        type: 'update_comment_result',
        success: true,
        commentId: comment.id,
        threadId: comment.threadId,
        channelId: comment.channelId,
        workspaceId: comment.workspaceId,
        content: comment.content,
        commentUrl,
        lastEdited,
    }

    return { textContent: lines.join('\n'), structuredContent }
}

async function updateMessageBranch(args: Args, client: TwistApi): Promise<Branch> {
    const { targetId, content } = args
    if (content === undefined) {
        throw new Error('`content` is required when targetType is "message".')
    }

    const message = await client.conversationMessages.updateMessage({ id: targetId, content })

    const messageUrl =
        message.url ??
        getFullTwistURL({
            workspaceId: message.workspaceId,
            conversationId: message.conversationId,
            messageId: message.id,
        })

    const lastEdited = message.lastEdited ? message.lastEdited.toISOString() : undefined

    const lines: string[] = [
        `# Message Updated`,
        '',
        `**Message ID:** ${message.id}`,
        `**Conversation ID:** ${message.conversationId}`,
        `**Workspace ID:** ${message.workspaceId}`,
        ...(lastEdited ? [`**Last Edited:** ${lastEdited}`] : []),
        `**URL:** ${messageUrl}`,
        '',
        '## Content',
        '',
        message.content,
    ]

    const structuredContent: UpdateMessageOutput = {
        type: 'update_message_result',
        success: true,
        messageId: message.id,
        conversationId: message.conversationId,
        workspaceId: message.workspaceId,
        content: message.content,
        messageUrl,
        lastEdited,
    }

    return { textContent: lines.join('\n'), structuredContent }
}

const updateObject = {
    name: ToolNames.UPDATE_OBJECT,
    description:
        'Update an existing Twist object. `targetType: "thread"` updates a thread\'s title and/or body; `"comment"` updates a thread comment\'s body; `"message"` updates a direct/group conversation message\'s body. Always pass `targetId`. `content` is required for `"comment"` and `"message"`; for `"thread"` it is optional as long as `title` is provided (i.e. a thread can be renamed without re-sending the body). `title` is only valid when `targetType` is `"thread"`.',
    parameters: ArgsSchema,
    outputSchema: UpdateObjectOutputSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { targetType, title } = args

        if (targetType !== 'thread' && title !== undefined) {
            throw new Error('`title` is only valid when targetType is "thread".')
        }

        const branch =
            targetType === 'thread'
                ? await updateThreadBranch(args, client)
                : targetType === 'comment'
                  ? await updateCommentBranch(args, client)
                  : await updateMessageBranch(args, client)

        return getToolOutput({
            textContent: branch.textContent,
            structuredContent: branch.structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof UpdateObjectOutputSchema.shape>

export { updateObject }
