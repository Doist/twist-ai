import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { getMcpServer } from './mcp-server.js'
import { ToolNames } from './utils/tool-names.js'

const JSON_SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema'

describe('advertised tool schema dialects', () => {
    it('uses JSON Schema 2020-12 for every tool schema', async () => {
        const server = getMcpServer({ twistApiKey: 'test-token' })
        const client = new Client({ name: 'schema-dialect-test', version: '1.0.0' })
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

        try {
            const { tools } = await client.listTools()

            expect(tools).toHaveLength(Object.values(ToolNames).length)
            for (const tool of tools) {
                expect(tool.inputSchema.$schema).toBe(JSON_SCHEMA_2020_12)
                expect(tool.outputSchema?.$schema).toBe(JSON_SCHEMA_2020_12)
            }
        } finally {
            await client.close()
            await server.close()
        }
    })
})
