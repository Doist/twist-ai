#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import dotenv from 'dotenv'
import { getMcpServer } from './mcp-server.js'

function main() {
    const twistApiKey = process.env.TWIST_API_KEY
    if (!twistApiKey) {
        throw new Error('TWIST_API_KEY is not set')
    }

    const server = getMcpServer({ twistApiKey })
    const transport = new StdioServerTransport()
    server
        .connect(transport)
        .then(() => {
            // We use console.error because standard I/O is being used for the MCP server communication.
            console.error('Server started')
        })
        .catch((error) => {
            console.error('Error starting the Twist MCP server:', error)
            process.exit(1)
        })
}

dotenv.config()
main()
