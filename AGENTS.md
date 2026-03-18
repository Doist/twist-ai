# Twist AI MCP Server - Development Guidelines

## Adding a New Tool

When adding a new tool, it must be registered in **all** of these locations:

1. `src/utils/tool-names.ts` — add tool name constant
2. `src/tools/<tool-name>.ts` — create tool definition
3. `src/mcp-server.ts` — import, register with `registerTool()`, and add to LLM `instructions` string
4. `src/index.ts` — import and add to both the `tools` object and the named exports
5. `scripts/run-tool.ts` — import and add to the `tools` record
6. `src/tools/__tests__/tool-annotations.test.ts` — add annotation expectation entry
7. `src/tools/__tests__/<tool-name>.test.ts` — create test file

## Testing Requirements

When adding new tool parameters:

1. Add comprehensive test coverage for new fields
2. Test setting values
3. Test clearing values (if applicable)
4. Verify build and type checking pass
5. Run full test suite (all tests must pass)

## Documentation Requirements

When adding new tool features:

1. Update tool schema descriptions in the source file
2. Update `src/mcp-server.ts` tool usage guidelines
3. Add tests demonstrating the feature
4. Include examples in descriptions where helpful

## Running Tools Directly

Use `scripts/run-tool.ts` to execute any tool without the MCP server:

```bash
npx tsx scripts/run-tool.ts <tool-name> '<json-args>'
npx tsx scripts/run-tool.ts --list  # list all tools
```

Examples:
```bash
npx tsx scripts/run-tool.ts user-info '{}'
npx tsx scripts/run-tool.ts search-content '{"query":"project update"}'
npx tsx scripts/run-tool.ts fetch-inbox '{"workspaceId":12345}'
```

Requires `TWIST_API_KEY` in `.env` (and optionally `TWIST_BASE_URL`).
