import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

type RequiredToolAnnotations = ToolAnnotations & {
    readOnlyHint: boolean
    destructiveHint: boolean
    idempotentHint: boolean
}

function formatToolTitle(toolName: string): string {
    const formatted = toolName
        .split(/[_-]+/)
        .filter(Boolean)
        .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
        .join(' ')

    return `Twist: ${formatted}`
}

export { formatToolTitle, type RequiredToolAnnotations }
