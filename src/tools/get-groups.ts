import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { GetGroupsOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID to get groups from.'),
    groupIds: z
        .array(z.number())
        .optional()
        .describe(
            'Optional array of specific group IDs to fetch. If not provided or empty array, fetches all workspace groups.',
        ),
    searchText: z
        .string()
        .optional()
        .describe('Optional search text to filter groups by name (case-insensitive).'),
}

type GroupData = {
    id: number
    name: string
    description?: string
    workspaceId: number
    userIds: number[]
    memberCount: number
    version: number
}

type GetGroupsStructured = Record<string, unknown> & {
    type: 'get_groups'
    workspaceId: number
    groups: GroupData[]
    totalGroups: number
    filteredGroups: number
}

const getGroups = {
    name: ToolNames.GET_GROUPS,
    description:
        'Get groups from a workspace. Retrieves all workspace groups by default, or specific groups if groupIds array is provided. Supports optional case-insensitive search filtering by group name. Use this before passing group IDs to tools that support group notifications.',
    parameters: ArgsSchema,
    outputSchema: GetGroupsOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { workspaceId, groupIds, searchText } = args

        const workspaceGroups = await client.groups.getGroups(workspaceId)
        const requestedGroupIds = groupIds && groupIds.length > 0 ? new Set(groupIds) : undefined

        const groups = requestedGroupIds
            ? workspaceGroups.filter((group) => requestedGroupIds.has(group.id))
            : workspaceGroups
        const totalGroups = groups.length

        let filteredGroups = groups
        if (searchText) {
            const searchLower = searchText.toLowerCase()
            filteredGroups = groups.filter((group) =>
                group.name.toLowerCase().includes(searchLower),
            )
        }

        const lines: string[] = ['# Workspace Groups', '']

        lines.push(`**Workspace ID:** ${workspaceId}`)
        lines.push(
            `**Total Groups:** ${totalGroups}${searchText ? ` (${filteredGroups.length} matching search)` : ''}`,
        )
        lines.push('')

        if (filteredGroups.length === 0) {
            lines.push('No groups found.')
        } else {
            for (const group of filteredGroups) {
                lines.push(`## ${group.name}`)
                lines.push(`**ID:** ${group.id}`)
                lines.push(`**Members:** ${group.userIds.length}`)
                if (group.description) {
                    lines.push(`**Description:** ${group.description}`)
                }
                lines.push('')
            }
        }

        const textContent = lines.join('\n')

        const structuredContent: GetGroupsStructured = {
            type: 'get_groups',
            workspaceId,
            groups: filteredGroups.map((group) => ({
                id: group.id,
                name: group.name,
                ...(group.description && { description: group.description }),
                workspaceId: group.workspaceId,
                userIds: group.userIds,
                memberCount: group.userIds.length,
                version: group.version,
            })),
            totalGroups,
            filteredGroups: filteredGroups.length,
        }

        return getToolOutput({
            textContent,
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema, typeof GetGroupsOutputSchema.shape>

export { getGroups, type GetGroupsStructured }
