import { getMcpServer } from './mcp-server.js'
import { buildLink } from './tools/build-link.js'
import { fetchInbox } from './tools/fetch-inbox.js'
import { loadConversation } from './tools/load-conversation.js'
import { loadThread } from './tools/load-thread.js'
import { markDone } from './tools/mark-done.js'
import { react } from './tools/react.js'
import { reply } from './tools/reply.js'
import { searchContent } from './tools/search-content.js'
import { userInfo } from './tools/user-info.js'

const tools = {
    userInfo,
    fetchInbox,
    loadThread,
    loadConversation,
    searchContent,
    reply,
    react,
    markDone,
    buildLink,
}

export { tools, getMcpServer }

export {
    userInfo,
    fetchInbox,
    loadThread,
    loadConversation,
    searchContent,
    reply,
    react,
    markDone,
    buildLink,
}
