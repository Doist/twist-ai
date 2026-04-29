import { getFullTwistURL, type Conversation, type TwistApi } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ListConversationsOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID to list conversations from.'),
    includeArchived: z
        .boolean()
        .optional()
        .describe(
            'Whether to include archived conversations. If true, both active and archived conversations are returned. Defaults to false (active conversations only).',
        ),
}

type ConversationData = {
    id: number
    workspaceId: number
    title?: string
    userIds: number[]
    participantNames?: string[]
    archived: boolean
    lastActive: string
    snippet?: string
    conversationUrl: string
}

type ListConversationsStructured = Record<string, unknown> & {
    type: 'list_conversations'
    workspaceId: number
    conversations: ConversationData[]
    totalConversations: number
}

async function generateConversationsList(
    client: TwistApi,
    workspaceId: number,
    includeArchived: boolean,
): Promise<{ textContent: string; structuredContent: ListConversationsStructured }> {
    // By default only fetch active conversations; optionally include archived ones too
    let conversations: Conversation[]
    if (includeArchived) {
        const [activeResponse, archivedResponse] = await client.batch(
            client.conversations.getConversations({ workspaceId }, { batch: true }),
            client.conversations.getConversations({ workspaceId, archived: true }, { batch: true }),
        )
        conversations = [...activeResponse.data, ...archivedResponse.data]
    } else {
        conversations = await client.conversations.getConversations({ workspaceId })
    }

    if (conversations.length === 0) {
        return {
            textContent: '# Conversations\n\nNo conversations found.',
            structuredContent: {
                type: 'list_conversations',
                workspaceId,
                conversations: [],
                totalConversations: 0,
            },
        }
    }

    // Collect unique participant IDs across all conversations and batch-fetch their names
    const participantIds = new Set<number>()
    for (const conversation of conversations) {
        for (const userId of conversation.userIds) {
            participantIds.add(userId)
        }
    }

    const participantLookup: Record<number, string> = {}
    if (participantIds.size > 0) {
        const userRequests = Array.from(participantIds).map((userId) =>
            client.workspaceUsers.getUserById({ workspaceId, userId }, { batch: true }),
        )
        const userResponses = await client.batch(...userRequests)

        const participantIdArray = Array.from(participantIds)
        for (let i = 0; i < participantIdArray.length; i++) {
            const userId = participantIdArray[i]
            if (userId !== undefined) {
                const user = userResponses[i]?.data
                if (user) {
                    participantLookup[userId] = user.name
                }
            }
        }
    }

    const lines: string[] = ['# Conversations', '']
    lines.push(
        `Found ${conversations.length} conversation${conversations.length === 1 ? '' : 's'} in workspace ${workspaceId}:`,
        '',
    )

    for (const conversation of conversations) {
        const conversationUrl =
            conversation.url ?? getFullTwistURL({ workspaceId, conversationId: conversation.id })
        const heading = conversation.title?.trim()
            ? conversation.title
            : `Conversation ${conversation.id}`

        lines.push(`## [${heading}](${conversationUrl})`)
        lines.push(`**ID:** ${conversation.id}`)
        lines.push(`**Archived:** ${conversation.archived ? 'Yes' : 'No'}`)
        lines.push(`**Last Active:** ${conversation.lastActive.toISOString()}`)

        const participantNames = conversation.userIds.map(
            (id) => participantLookup[id] ?? String(id),
        )
        lines.push(`**Participants:** ${participantNames.join(', ')}`)

        if (conversation.snippet) {
            lines.push(`**Snippet:** ${conversation.snippet}`)
        }

        lines.push('')
    }

    const textContent = lines.join('\n')

    const structuredContent: ListConversationsStructured = {
        type: 'list_conversations',
        workspaceId,
        conversations: conversations.map((conversation) => {
            const resolvedNames = conversation.userIds
                .map((id) => participantLookup[id])
                .filter((name): name is string => name !== undefined)

            return {
                id: conversation.id,
                workspaceId: conversation.workspaceId,
                ...(conversation.title && { title: conversation.title }),
                userIds: conversation.userIds,
                ...(resolvedNames.length > 0 && { participantNames: resolvedNames }),
                archived: conversation.archived,
                lastActive: conversation.lastActive.toISOString(),
                ...(conversation.snippet && { snippet: conversation.snippet }),
                conversationUrl:
                    conversation.url ??
                    getFullTwistURL({ workspaceId, conversationId: conversation.id }),
            }
        }),
        totalConversations: conversations.length,
    }

    return { textContent, structuredContent }
}

const listConversations = {
    name: ToolNames.LIST_CONVERSATIONS,
    description:
        'List conversations (direct messages) in a workspace. By default returns only active conversations; set includeArchived to true to also include archived conversations. Returns conversation IDs, titles, participant user IDs and names, archive status, last-active timestamps, snippets, and URLs.',
    parameters: ArgsSchema,
    outputSchema: ListConversationsOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { workspaceId, includeArchived = false } = args
        const result = await generateConversationsList(client, workspaceId, includeArchived)

        return getToolOutput({
            textContent: result.textContent,
            structuredContent: result.structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof ListConversationsOutputSchema.shape>

export { listConversations, type ListConversationsStructured }
