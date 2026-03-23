import type { Channel, TwistApi } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ListChannelsOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'
import { getChannelUrl } from '../utils/url-helpers.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID to list channels from.'),
    includeArchived: z
        .boolean()
        .optional()
        .describe(
            'Whether to include archived channels. If true, both active and archived channels are returned. Defaults to false (active channels only).',
        ),
}

type ChannelData = {
    id: number
    name: string
    description?: string
    public: boolean
    archived: boolean
    creatorId: number
    creatorName?: string
    created: string
    channelUrl: string
    color?: number
}

type ListChannelsStructured = Record<string, unknown> & {
    type: 'list_channels'
    workspaceId: number
    channels: ChannelData[]
    totalChannels: number
}

async function generateChannelsList(
    client: TwistApi,
    workspaceId: number,
    includeArchived: boolean,
): Promise<{ textContent: string; structuredContent: ListChannelsStructured }> {
    // By default only fetch active channels; optionally include archived ones too
    let channels: Channel[]
    if (includeArchived) {
        const [activeResponse, archivedResponse] = await client.batch(
            client.channels.getChannels({ workspaceId }, { batch: true }),
            client.channels.getChannels({ workspaceId, archived: true }, { batch: true }),
        )
        channels = [...activeResponse.data, ...archivedResponse.data]
    } else {
        channels = await client.channels.getChannels({ workspaceId })
    }

    if (channels.length === 0) {
        return {
            textContent: '# Channels\n\nNo channels found.',
            structuredContent: {
                type: 'list_channels',
                workspaceId,
                channels: [],
                totalChannels: 0,
            },
        }
    }

    // Collect unique creator IDs and batch-fetch their names
    const creatorIds = new Set<number>()
    for (const channel of channels) {
        creatorIds.add(channel.creator)
    }

    const creatorLookup: Record<number, string> = {}
    if (creatorIds.size > 0) {
        const userRequests = Array.from(creatorIds).map((userId) =>
            client.workspaceUsers.getUserById({ workspaceId, userId }, { batch: true }),
        )
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

    const lines: string[] = ['# Channels', '']
    lines.push(
        `Found ${channels.length} channel${channels.length === 1 ? '' : 's'} in workspace ${workspaceId}:`,
        '',
    )

    for (const channel of channels) {
        const creatorName = creatorLookup[channel.creator]
        const channelUrl = getChannelUrl(workspaceId, channel.id)

        lines.push(`## [${channel.name}](${channelUrl})`)
        lines.push(`**ID:** ${channel.id}`)
        lines.push(`**Public:** ${channel.public ? 'Yes' : 'No'}`)
        lines.push(`**Archived:** ${channel.archived ? 'Yes' : 'No'}`)
        lines.push(
            `**Creator:** ${creatorName ? `${creatorName} (${channel.creator})` : channel.creator}`,
        )
        lines.push(`**Created:** ${channel.created.toISOString()}`)

        if (channel.description) {
            lines.push(`**Description:** ${channel.description}`)
        }

        lines.push('')
    }

    const textContent = lines.join('\n')

    const structuredContent: ListChannelsStructured = {
        type: 'list_channels',
        workspaceId,
        channels: channels.map((channel) => ({
            id: channel.id,
            name: channel.name,
            ...(channel.description && { description: channel.description }),
            public: channel.public,
            archived: channel.archived,
            creatorId: channel.creator,
            ...(creatorLookup[channel.creator] && {
                creatorName: creatorLookup[channel.creator],
            }),
            created: channel.created.toISOString(),
            channelUrl: getChannelUrl(workspaceId, channel.id),
            ...(channel.color != null && { color: channel.color }),
        })),
        totalChannels: channels.length,
    }

    return { textContent, structuredContent }
}

const listChannels = {
    name: ToolNames.LIST_CHANNELS,
    description:
        'List channels in a workspace. By default returns only active channels; set includeArchived to true to also include archived channels. Returns channel IDs, names, descriptions, visibility (public/private), archive status, creators, creation dates, URLs, and colors.',
    parameters: ArgsSchema,
    outputSchema: ListChannelsOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { workspaceId, includeArchived = false } = args
        const result = await generateChannelsList(client, workspaceId, includeArchived)

        return getToolOutput({
            textContent: result.textContent,
            structuredContent: result.structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof ListChannelsOutputSchema.shape>

export { listChannels, type ListChannelsStructured }
