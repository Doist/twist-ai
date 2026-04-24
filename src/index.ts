import { getMcpServer } from './mcp-server.js'
import { away } from './tools/away.js'
import { buildLink } from './tools/build-link.js'
import { createThread } from './tools/create-thread.js'
import { fetchInbox } from './tools/fetch-inbox.js'
import { listChannels } from './tools/list-channels.js'
import { loadConversation } from './tools/load-conversation.js'
import { loadThread } from './tools/load-thread.js'
import { markDone } from './tools/mark-done.js'
import { react } from './tools/react.js'
import { reply } from './tools/reply.js'
import { searchContent } from './tools/search-content.js'
import { updateComment } from './tools/update-comment.js'
import { updateThread } from './tools/update-thread.js'
import { userInfo } from './tools/user-info.js'

const tools = {
    away,
    userInfo,
    fetchInbox,
    loadThread,
    loadConversation,
    searchContent,
    createThread,
    updateThread,
    updateComment,
    reply,
    react,
    markDone,
    buildLink,
    listChannels,
}

export { tools, getMcpServer }

export {
    away,
    userInfo,
    fetchInbox,
    loadThread,
    loadConversation,
    searchContent,
    createThread,
    updateThread,
    updateComment,
    reply,
    react,
    markDone,
    buildLink,
    listChannels,
}
