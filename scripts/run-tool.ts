#!/usr/bin/env npx tsx
/**
 * Run any Twist tool directly without going through MCP.
 *
 * Usage:
 *   npx tsx scripts/run-tool.ts <tool-name> '<json-args>'
 *   npx tsx scripts/run-tool.ts <tool-name> --file <args.json>
 *   npx tsx scripts/run-tool.ts --list
 *
 * Examples:
 *   npx tsx scripts/run-tool.ts user-info '{}'
 *   npx tsx scripts/run-tool.ts search-content '{"query":"project update"}'
 *   npx tsx scripts/run-tool.ts fetch-inbox '{"workspaceId":12345}'
 *
 * Requires TWIST_API_KEY in .env file (and optionally TWIST_BASE_URL).
 */
import { readFileSync } from 'node:fs'
import { TwistApi } from '@doist/twist-sdk'
import { config } from 'dotenv'
import { away } from '../src/tools/away.js'
import { buildLink } from '../src/tools/build-link.js'
import { createThread } from '../src/tools/create-thread.js'
import { fetchInbox } from '../src/tools/fetch-inbox.js'
import { getMentions } from '../src/tools/get-mentions.js'
import { getUsers } from '../src/tools/get-users.js'
import { getWorkspaces } from '../src/tools/get-workspaces.js'
import { listChannels } from '../src/tools/list-channels.js'
import { loadConversation } from '../src/tools/load-conversation.js'
import { loadThread } from '../src/tools/load-thread.js'
import { markDone } from '../src/tools/mark-done.js'
import { react } from '../src/tools/react.js'
import { reply } from '../src/tools/reply.js'
import { searchContent } from '../src/tools/search-content.js'
import { updateObject } from '../src/tools/update-object.js'
import { userInfo } from '../src/tools/user-info.js'

// Define a minimal type for tool execution that works with any tool
type ExecutableTool = {
    name: string
    description: string
    execute: (
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any -- tools have varying parameter schemas
        args: any,
        client: TwistApi,
    ) => Promise<{
        content?: Array<{ type: string; text: string }>
        structuredContent?: unknown
    }>
}

const tools: Record<string, ExecutableTool> = {
    'user-info': userInfo,
    'fetch-inbox': fetchInbox,
    'load-thread': loadThread,
    'load-conversation': loadConversation,
    'search-content': searchContent,
    'get-mentions': getMentions,
    'create-thread': createThread,
    'update-object': updateObject,
    reply: reply,
    react: react,
    'mark-done': markDone,
    'build-link': buildLink,
    'get-workspaces': getWorkspaces,
    'get-users': getUsers,
    away: away,
    'list-channels': listChannels,
}

function printUsage() {
    console.log(`
Usage:
  npx tsx scripts/run-tool.ts <tool-name> '<json-args>'
  npx tsx scripts/run-tool.ts <tool-name> --file <args.json>
  npx tsx scripts/run-tool.ts --list

Available tools:
${Object.keys(tools)
    .sort()
    .map((name) => `  - ${name}`)
    .join('\n')}
`)
}

async function main() {
    const args = process.argv.slice(2)

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printUsage()
        process.exit(0)
    }

    if (args[0] === '--list') {
        console.log('Available tools:')
        for (const name of Object.keys(tools).sort()) {
            const tool = tools[name]
            console.log(`\n${name}:`)
            console.log(`  ${tool.description}`)
        }
        process.exit(0)
    }

    config()

    const toolName = args[0]
    const tool = tools[toolName]

    if (!tool) {
        console.error(`Unknown tool: ${toolName}`)
        console.error(`Available tools: ${Object.keys(tools).sort().join(', ')}`)
        process.exit(1)
    }

    let jsonArgs: string
    if (args[1] === '--file') {
        if (!args[2]) {
            console.error('--file requires a path argument')
            process.exit(1)
        }
        try {
            jsonArgs = readFileSync(args[2], 'utf-8')
        } catch {
            console.error(`Failed to read file: ${args[2]}`)
            process.exit(1)
        }
    } else {
        jsonArgs = args[1] || '{}'
    }

    let parsedArgs: unknown
    try {
        parsedArgs = JSON.parse(jsonArgs)
    } catch (e) {
        console.error('Invalid JSON args:', e)
        process.exit(1)
    }

    const apiKey = process.env.TWIST_API_KEY
    if (!apiKey) {
        console.error('TWIST_API_KEY not found in environment or .env file')
        process.exit(1)
    }

    const baseUrl = process.env.TWIST_BASE_URL
    const client = new TwistApi(apiKey, { baseUrl })

    console.log(`Running ${toolName} with args:`)
    console.log(JSON.stringify(parsedArgs, null, 2))
    console.log('---')

    try {
        const result = await tool.execute(parsedArgs, client)

        if (result.content?.[0]?.text) {
            console.log('\nText output:')
            console.log(result.content[0].text)
        }

        if (result.structuredContent) {
            console.log('\nStructured output:')
            console.log(JSON.stringify(result.structuredContent, null, 2))
        }
    } catch (error) {
        console.error('Tool execution failed:', error)
        process.exit(1)
    }
}

main()
