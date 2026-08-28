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

// Only resolve names for the first few participants of each conversation. A large
// group DM would otherwise produce an unbounded participant string; callers that
// need every participant should load the conversation directly.
const MAX_DISPLAYED_PARTICIPANTS = 5

// The Twist API accepts at most this many requests in a single batch call.
const BATCH_REQUEST_LIMIT = 10

// Resolve user IDs to names, splitting the lookups into batches that respect the
// API's per-batch request limit. IDs whose lookup fails are simply absent from
// the returned map.
async function resolveParticipantNames(
    client: TwistApi,
    workspaceId: number,
    userIds: number[],
): Promise<Record<number, string>> {
    const lookup: Record<number, string> = {}
    for (let i = 0; i < userIds.length; i += BATCH_REQUEST_LIMIT) {
        const chunk = userIds.slice(i, i + BATCH_REQUEST_LIMIT)
        const responses = await client.batch(
            ...chunk.map((userId) =>
                client.workspaceUsers.getUserById({ workspaceId, userId }, { batch: true }),
            ),
        )
        responses.forEach((response, j) => {
            const userId = chunk[j]
            const user = response?.data
            if (userId !== undefined && user) {
                lookup[userId] = user.name
            }
        })
    }
    return lookup
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

    // For each conversation, only the first few participants are shown, so we only
    // need names for those. Collect them into a deduplicated set and resolve in
    // batches that respect the API's per-batch request limit.
    const displayUserIdsByConversation = new Map<number, number[]>()
    const idsToResolve = new Set<number>()
    for (const conversation of conversations) {
        const displayIds = conversation.userIds.slice(0, MAX_DISPLAYED_PARTICIPANTS)
        displayUserIdsByConversation.set(conversation.id, displayIds)
        for (const userId of displayIds) {
            idsToResolve.add(userId)
        }
    }

    const participantLookup = await resolveParticipantNames(
        client,
        workspaceId,
        Array.from(idsToResolve),
    )

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

        const displayIds = displayUserIdsByConversation.get(conversation.id) ?? []
        const displayNames = displayIds.map((id) => participantLookup[id] ?? String(id))
        const remaining = conversation.userIds.length - displayIds.length
        const participantsSummary =
            remaining > 0
                ? `${displayNames.join(', ')}, and ${remaining} more`
                : displayNames.join(', ')
        lines.push(`**Participants:** ${participantsSummary}`)

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
            const displayIds = displayUserIdsByConversation.get(conversation.id) ?? []
            const resolvedNames = displayIds
                .map((id) => participantLookup[id])
                .filter((name): name is string => name !== undefined)

            return {
                id: conversation.id,
                workspaceId: conversation.workspaceId,
                ...(conversation.title && { title: conversation.title }),
                userIds: displayIds,
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
        'List conversations (direct messages) in a workspace. By default returns only active conversations; set includeArchived to true to also include archived conversations. Returns conversation IDs, titles, partial list of participant user IDs and names, archive status, last-active timestamps, snippets, and URLs.',
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
