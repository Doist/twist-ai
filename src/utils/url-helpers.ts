import { getFullTwistURL } from '@doist/twist-sdk'

export function getWorkspaceUrl(workspaceId: number): string {
    return getFullTwistURL({ workspaceId })
}

export function getChannelUrl(workspaceId: number, channelId: number): string {
    return getFullTwistURL({ workspaceId, channelId })
}

export function getConversationUrl(workspaceId: number, conversationId: number): string {
    return getFullTwistURL({ workspaceId, conversationId })
}