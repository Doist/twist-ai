import type { UserType } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    workspaceId: z.number().describe('The workspace ID to get users from.'),
    userIds: z
        .array(z.number())
        .optional()
        .describe(
            'Optional array of specific user IDs to fetch. If not provided or empty array, fetches all workspace users.',
        ),
    searchText: z
        .string()
        .optional()
        .describe('Optional search text to filter users by name or email (case-insensitive).'),
}

type UserData = {
    id: number
    name: string
    shortName: string
    email?: string
    userType: UserType
    bot: boolean
    removed: boolean
    timezone: string
}

type GetUsersStructured = Record<string, unknown> & {
    type: 'get_users'
    workspaceId: number
    users: UserData[]
    totalUsers: number
    filteredUsers: number
    appliedFilters: z.infer<z.ZodObject<typeof ArgsSchema>>
}

const getUsers = {
    name: ToolNames.GET_USERS,
    description:
        'Get users from a workspace. Retrieves all workspace users by default, or specific users if userIds array is provided. Supports optional case-insensitive search filtering by name or email.',
    parameters: ArgsSchema,
    async execute(args, client) {
        const { workspaceId, userIds, searchText } = args

        // Fetch users based on userIds parameter
        const users =
            !userIds || userIds.length === 0
                ? await client.workspaceUsers.getWorkspaceUsers({ workspaceId })
                : await (async () => {
                      const userRequests = userIds.map((userId) =>
                          client.workspaceUsers.getUserById(
                              { workspaceId, userId },
                              { batch: true },
                          ),
                      )
                      const userResponses = await client.batch(...userRequests)
                      return userResponses.map((response) => response.data)
                  })()

        const totalUsers = users.length

        // Apply search filter if provided
        let filteredUsers = users
        if (searchText) {
            const searchLower = searchText.toLowerCase()
            filteredUsers = users.filter((user) => {
                const nameMatch = user.name.toLowerCase().includes(searchLower)
                const emailMatch = user.email?.toLowerCase().includes(searchLower) || false
                return nameMatch || emailMatch
            })
        }

        // Build text content
        const lines: string[] = ['# Workspace Users', '']

        lines.push(`**Workspace ID:** ${workspaceId}`)
        lines.push(
            `**Total Users:** ${totalUsers}${searchText ? ` (${filteredUsers.length} matching search)` : ''}`,
        )
        lines.push('')

        if (filteredUsers.length === 0) {
            lines.push('No users found.')
        } else {
            for (const user of filteredUsers) {
                lines.push(`## ${user.name}${user.bot ? ' 🤖' : ''}`)
                lines.push(`**ID:** ${user.id}`)
                if (user.email) {
                    lines.push(`**Email:** ${user.email}`)
                }
                lines.push(`**User Type:** ${user.userType}`)
                lines.push(`**Timezone:** ${user.timezone}`)
                lines.push(`**Status:** ${user.removed ? 'Removed' : 'Active'}`)
                lines.push('')
            }
        }

        const textContent = lines.join('\n')

        const structuredContent: GetUsersStructured = {
            type: 'get_users',
            workspaceId,
            users: filteredUsers.map((user) => ({
                id: user.id,
                name: user.name,
                shortName: user.shortName,
                ...(user.email && { email: user.email }),
                userType: user.userType,
                bot: user.bot,
                removed: user.removed,
                timezone: user.timezone,
            })),
            totalUsers,
            filteredUsers: filteredUsers.length,
            appliedFilters: args,
        }

        return getToolOutput({
            textContent,
            structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { getUsers, type GetUsersStructured }
