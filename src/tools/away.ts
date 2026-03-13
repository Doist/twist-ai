import { AWAY_MODE_TYPES, type AwayModeType, type TwistApi } from '@doist/twist-sdk'
import { z } from 'zod'
import { getToolOutput } from '../mcp-helpers.js'
import type { TwistTool } from '../twist-tool.js'
import { AWAY_ACTIONS, type AwayOutput, AwayOutputSchema } from '../utils/output-schemas.js'
import { ToolNames } from '../utils/tool-names.js'

const ArgsSchema = {
    action: z.enum(AWAY_ACTIONS).describe('The action to perform.'),
    type: z
        .enum(AWAY_MODE_TYPES)
        .optional()
        .describe('The away mode type. Required when action is "set".'),
    from: z
        .string()
        .optional()
        .describe('Start date (YYYY-MM-DD). Only used when action is "set". Defaults to today.'),
    until: z.string().optional().describe('End date (YYYY-MM-DD). Required when action is "set".'),
}

const AWAY_TYPE_LABELS: Record<AwayModeType, string> = {
    vacation: 'Vacation',
    parental: 'Parental leave',
    sickleave: 'Sick leave',
    other: 'Away',
}

function formatAwayType(type: AwayModeType): string {
    return AWAY_TYPE_LABELS[type]
}

function getTodayDate(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

async function executeGet(
    client: TwistApi,
): Promise<{ textContent: string; structuredContent: AwayOutput }> {
    const user = await client.users.getSessionUser()
    const awayMode = user.awayMode ?? null

    const lines: string[] = ['# Away Status']
    if (awayMode) {
        lines.push(
            '',
            `**Status:** Away`,
            `**Type:** ${formatAwayType(awayMode.type as AwayModeType)}`,
            `**From:** ${awayMode.dateFrom}`,
            `**To:** ${awayMode.dateTo}`,
        )
    } else {
        lines.push('', '**Status:** Not away')
    }

    return {
        textContent: lines.join('\n'),
        structuredContent: {
            type: 'away_status',
            action: 'get',
            isAway: awayMode !== null,
            awayMode: awayMode
                ? {
                      type: awayMode.type,
                      dateFrom: awayMode.dateFrom,
                      dateTo: awayMode.dateTo,
                  }
                : null,
        },
    }
}

async function executeSet(
    client: TwistApi,
    awayType: AwayModeType,
    dateFrom: string,
    dateTo: string,
): Promise<{ textContent: string; structuredContent: AwayOutput }> {
    await client.users.update({
        awayMode: { type: awayType, dateFrom, dateTo },
    })

    return {
        textContent: [
            '# Away Status Set',
            '',
            `**Type:** ${formatAwayType(awayType)}`,
            `**From:** ${dateFrom}`,
            `**To:** ${dateTo}`,
        ].join('\n'),
        structuredContent: {
            type: 'away_status',
            action: 'set',
            isAway: true,
            awayMode: {
                type: awayType,
                dateFrom,
                dateTo,
            },
        },
    }
}

async function executeClear(
    client: TwistApi,
): Promise<{ textContent: string; structuredContent: AwayOutput }> {
    await client.users.update({ awayMode: undefined })

    return {
        textContent: '# Away Status Cleared\n\n**Status:** Not away',
        structuredContent: {
            type: 'away_status',
            action: 'clear',
            isAway: false,
            awayMode: null,
        },
    }
}

const away = {
    name: ToolNames.AWAY,
    description:
        "Manage the current user's away status. Supports getting, setting, and clearing away mode with types: parental, vacation, sickleave, other.",
    parameters: ArgsSchema,
    outputSchema: AwayOutputSchema.shape,
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
    },
    async execute(args, client) {
        switch (args.action) {
            case 'get': {
                const result = await executeGet(client)
                return getToolOutput(result)
            }
            case 'set': {
                if (!args.type) {
                    throw new Error('The "type" parameter is required when action is "set".')
                }
                if (!args.until) {
                    throw new Error('The "until" parameter is required when action is "set".')
                }
                const dateFrom = args.from ?? getTodayDate()
                const result = await executeSet(client, args.type, dateFrom, args.until)
                return getToolOutput(result)
            }
            case 'clear': {
                const result = await executeClear(client)
                return getToolOutput(result)
            }
        }
    },
} satisfies TwistTool<typeof ArgsSchema, typeof AwayOutputSchema.shape>

export { away }
