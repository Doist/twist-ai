import type { TwistApi, WorkspacePlan } from '@doist/twist-sdk'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {}

type WorkspaceData = {
    id: number
    name: string
    creator: number
    creatorName?: string
    created: string
    defaultChannel?: number
    defaultChannelName?: string
    defaultConversation?: number
    defaultConversationTitle?: string
    plan?: WorkspacePlan
    avatarId?: string
    avatarUrls?: {
        s35: string
        s60: string
        s195: string
        s640: string
    }
}

type GetWorkspacesStructured = Record<string, unknown> & {
    type: 'get_workspaces'
    workspaces: WorkspaceData[]
}

async function generateWorkspacesList(
    client: TwistApi,
): Promise<{ textContent: string; structuredContent: GetWorkspacesStructured }> {
    const workspaces = await client.workspaces.getWorkspaces()

    if (workspaces.length === 0) {
        return {
            textContent: '# Workspaces\n\nNo workspaces found.',
            structuredContent: {
                type: 'get_workspaces',
                workspaces: [],
            },
        }
    }

    // Collect all unique channel IDs, conversation IDs, and creator IDs
    const channelIds = new Set<number>()
    const conversationIds = new Set<number>()
    const creatorIds = new Set<number>()

    for (const workspace of workspaces) {
        if (workspace.defaultChannel) {
            channelIds.add(workspace.defaultChannel)
        }
        if (workspace.defaultConversation) {
            conversationIds.add(workspace.defaultConversation)
        }
        creatorIds.add(workspace.creator)
    }

    // Fetch channels, conversations, and users in separate batch calls
    // This makes the code clearer and easier to maintain

    // Batch 1: Fetch all channels
    const channelLookup: Record<number, string> = {}
    if (channelIds.size > 0) {
        const channelRequests = Array.from(channelIds).map((channelId) =>
            client.channels.getChannel(channelId, { batch: true }),
        )
        const channelResponses = await client.batch(...channelRequests)

        const channelIdArray = Array.from(channelIds)
        for (let i = 0; i < channelIdArray.length; i++) {
            const channelId = channelIdArray[i]
            if (channelId !== undefined) {
                const channel = channelResponses[i]?.data
                if (channel) {
                    channelLookup[channelId] = channel.name
                }
            }
        }
    }

    // Batch 2: Fetch all conversations
    const conversationLookup: Record<number, string> = {}
    if (conversationIds.size > 0) {
        const conversationRequests = Array.from(conversationIds).map((conversationId) =>
            client.conversations.getConversation(conversationId, { batch: true }),
        )
        const conversationResponses = await client.batch(...conversationRequests)

        const conversationIdArray = Array.from(conversationIds)
        for (let i = 0; i < conversationIdArray.length; i++) {
            const conversationId = conversationIdArray[i]
            if (conversationId !== undefined) {
                const conversation = conversationResponses[i]?.data
                if (conversation) {
                    // Conversations have a 'title' field which may be null, fallback to user IDs
                    const title =
                        conversation.title ||
                        `Conversation with users: ${conversation.userIds.join(', ')}`
                    conversationLookup[conversationId] = title
                }
            }
        }
    }

    // Batch 3: Fetch all workspace users
    // Note: We need to know the workspace ID for getUserById
    const creatorLookup: Record<number, string> = {}
    if (creatorIds.size > 0) {
        const workspaceIdByCreatorId = new Map<number, number>()
        for (const workspace of workspaces) {
            workspaceIdByCreatorId.set(workspace.creator, workspace.id)
        }

        const userRequests = Array.from(creatorIds)
            .map((creatorId) => {
                const workspaceId = workspaceIdByCreatorId.get(creatorId)
                if (!workspaceId) return null
                return client.workspaceUsers.getUserById(workspaceId, creatorId, { batch: true })
            })
            .filter((req): req is Exclude<typeof req, null> => req !== null)

        const userResponses = await client.batch(...userRequests)

        const creatorIdArray = Array.from(creatorIds)
        for (let i = 0; i < creatorIdArray.length; i++) {
            const creatorId = creatorIdArray[i]
            if (creatorId !== undefined) {
                const user = userResponses[i]?.data
                if (user) {
                    creatorLookup[creatorId] = user.name
                }
            }
        }
    }

    const lines: string[] = ['# Workspaces', '']
    lines.push(`Found ${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}:`, '')

    for (const workspace of workspaces) {
        const creatorName = creatorLookup[workspace.creator]
        const defaultChannelName = workspace.defaultChannel
            ? channelLookup[workspace.defaultChannel]
            : undefined
        const defaultConversationTitle = workspace.defaultConversation
            ? conversationLookup[workspace.defaultConversation]
            : undefined

        lines.push(`## ${workspace.name}`)
        lines.push(`**ID:** ${workspace.id}`)
        lines.push(
            `**Creator:** ${creatorName ? `${creatorName} (${workspace.creator})` : workspace.creator}`,
        )
        lines.push(`**Created:** ${workspace.created.toISOString()}`)

        if (workspace.defaultChannel) {
            lines.push(
                `**Default Channel:** ${defaultChannelName ? `${defaultChannelName} (${workspace.defaultChannel})` : workspace.defaultChannel}`,
            )
        }

        if (workspace.defaultConversation) {
            lines.push(
                `**Default Conversation:** ${defaultConversationTitle ? `${defaultConversationTitle} (${workspace.defaultConversation})` : workspace.defaultConversation}`,
            )
        }

        if (workspace.plan) {
            lines.push(`**Plan:** ${workspace.plan}`)
        }

        lines.push('')
    }

    const textContent = lines.join('\n')

    const structuredContent: GetWorkspacesStructured = {
        type: 'get_workspaces',
        workspaces: workspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            creator: workspace.creator,
            ...(creatorLookup[workspace.creator] && {
                creatorName: creatorLookup[workspace.creator],
            }),
            created: workspace.created.toISOString(),
            ...(workspace.defaultChannel && { defaultChannel: workspace.defaultChannel }),
            ...(workspace.defaultChannel &&
                channelLookup[workspace.defaultChannel] && {
                    defaultChannelName: channelLookup[workspace.defaultChannel],
                }),
            ...(workspace.defaultConversation && {
                defaultConversation: workspace.defaultConversation,
            }),
            ...(workspace.defaultConversation &&
                conversationLookup[workspace.defaultConversation] && {
                    defaultConversationTitle: conversationLookup[workspace.defaultConversation],
                }),
            ...(workspace.plan && { plan: workspace.plan }),
            ...(workspace.avatarId && { avatarId: workspace.avatarId }),
            ...(workspace.avatarUrls && { avatarUrls: workspace.avatarUrls }),
        })),
    }

    return { textContent, structuredContent }
}

const getWorkspaces = {
    name: ToolNames.GET_WORKSPACES,
    description:
        'Get all workspaces that the user belongs to. Returns a list of workspaces with their IDs, names, creators, creation dates, and optional default channels, conversations, and plan information.',
    parameters: ArgsSchema,
    async execute(_args, client) {
        const result = await generateWorkspacesList(client)

        return getToolOutput({
            textContent: result.textContent,
            structuredContent: result.structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { getWorkspaces, type GetWorkspacesStructured }
