import type { TwistApi } from '@doist/twist-sdk'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {}

type UserInfoStructured = Record<string, unknown> & {
    type: 'user_info'
    userId: number
    name: string
    email: string
    timezone: string
    bot: boolean
    defaultWorkspace: number | null
}

async function generateUserInfo(
    client: TwistApi,
): Promise<{ textContent: string; structuredContent: UserInfoStructured }> {
    const user = await client.users.getSessionUser()

    const lines: string[] = [
        '# User Information',
        '',
        `**User ID:** ${user.id}`,
        `**Name:** ${user.name}`,
        `**Email:** ${user.email}`,
        `**Timezone:** ${user.timezone}`,
        `**Bot:** ${user.bot ? 'Yes' : 'No'}`,
        `**Language:** ${user.lang}`,
    ]

    if (user.defaultWorkspace) {
        lines.push(`**Default Workspace:** ${user.defaultWorkspace}`)
    }

    if (user.awayMode) {
        lines.push('', '## Away Mode')
        lines.push(`**Type:** ${user.awayMode.type}`)
        lines.push(`**From:** ${user.awayMode.dateFrom}`)
        lines.push(`**To:** ${user.awayMode.dateTo}`)
    }

    const textContent = lines.join('\n')

    const structuredContent: UserInfoStructured = {
        type: 'user_info',
        userId: user.id,
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        bot: user.bot,
        defaultWorkspace: user.defaultWorkspace ?? null,
    }

    return { textContent, structuredContent }
}

const userInfo = {
    name: ToolNames.USER_INFO,
    description:
        'Get comprehensive user information including user ID, name, email, timezone, bot status, default workspace, and away mode status.',
    parameters: ArgsSchema,
    async execute(_args, client) {
        const result = await generateUserInfo(client)

        return getToolOutput({
            textContent: result.textContent,
            structuredContent: result.structuredContent,
        })
    },
} satisfies TwistTool<typeof ArgsSchema>

export { userInfo, type UserInfoStructured }
