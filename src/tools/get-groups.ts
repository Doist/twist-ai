import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { type GetGroupsOutput, GetGroupsOutputSchema } from '../utils/output-schemas.js'
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

type GetGroupsStructured = GetGroupsOutput

const getGroups = {
    name: ToolNames.GET_GROUPS,
    description:
        'Get groups from a workspace. Retrieves all workspace groups by default, or specific groups if groupIds array is provided. Supports optional case-insensitive search filtering by group name. Use this before passing group IDs to tools that support group notifications.',
    parameters: ArgsSchema,
    outputSchema: GetGroupsOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async execute(args, client) {
        const { workspaceId, groupIds, searchText } = args

        const requestedGroupIds =
            groupIds && groupIds.length > 0 ? [...new Set(groupIds)] : undefined
        const groups = requestedGroupIds
            ? await (async () => {
                  const groupRequests = requestedGroupIds.map((groupId) =>
                      client.groups.getGroup(groupId, { batch: true }),
                  )
                  const groupResponses = await client.batch(...groupRequests)
                  return groupResponses
                      .map((response) => response.data)
                      .filter((group) => group.workspaceId === workspaceId)
              })()
            : await client.groups.getGroups(workspaceId)
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
                workspaceId: group.workspaceId,
                memberCount: group.userIds.length,
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
