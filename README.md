# Twist AI and MCP SDK

Library for connecting AI agents to Twist. Includes tools that can be integrated into LLMs,
enabling them to access and interact with a Twist workspace on the user's behalf.

These tools can be used both through an MCP server, or imported directly in other projects to
integrate them to your own AI conversational interfaces.

## Using tools

### 1. Add this repository as a dependency

```sh
npm install @doist/twist-ai
```

### 2. Import the tools and plug them to an AI

Here's an example using [Vercel's AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/generating-text#streamtext).

```js
import { fetchInbox, reply, markDone } from "@doist/twist-ai";
import { streamText } from "ai";

const result = streamText({
  model: yourModel,
  system: "You are a helpful Twist assistant",
  tools: {
    fetchInbox,
    reply,
    markDone,
  },
});
```

## Using as an MCP server

### Quick Start

You can run the MCP server directly with npx:

```bash
npx @doist/twist-ai
```

### Setup Guide

#### Claude Desktop

Add to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "twist": {
      "command": "npx",
      "args": ["-y", "@doist/twist-ai"],
      "env": {
        "TWIST_API_KEY": "your-twist-api-key-here"
      }
    }
  }
}
```

#### Cursor

Create a configuration file:

- **Global:** `~/.cursor/mcp.json`
- **Project-specific:** `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "twist": {
      "command": "npx",
      "args": ["-y", "@doist/twist-ai"],
      "env": {
        "TWIST_API_KEY": "your-twist-api-key-here"
      }
    }
  }
}
```

Then enable the server in Cursor settings if prompted.

#### Claude Code (CLI)

```bash
claude mcp add twist npx @doist/twist-ai
```

Then set your API key:

```bash
export TWIST_API_KEY=your-twist-api-key-here
```

#### Visual Studio Code

1. Open Command Palette → MCP: Add Server
2. Configure the server:

```json
{
  "servers": {
    "twist": {
      "command": "npx",
      "args": ["-y", "@doist/twist-ai"],
      "env": {
        "TWIST_API_KEY": "your-twist-api-key-here"
      }
    }
  }
}
```

### Getting your Twist API Key

1. Visit [https://twist.com/app_console](https://twist.com/app_console)
2. Create a new integration or use an existing one
3. Copy your API key
4. Add it to your MCP configuration as shown above

## Features

A key feature of this project is that tools can be reused, and are not written specifically for use in an MCP server. They can be hooked up as tools to other conversational AI interfaces (e.g. Vercel's AI SDK).

This project is in its early stages. Expect more and/or better tools soon.

Nevertheless, our goal is to provide a small set of tools that enable complete workflows, rather than just atomic actions, striking a balance between flexibility and efficiency for LLMs.

### Available Tools

- **userInfo** - Get information about the current user and their workspaces
- **fetchInbox** - Fetch threads and conversations from the inbox
- **loadThread** - Load a specific thread with its comments
- **loadConversation** - Load a specific conversation with its messages
- **searchContent** - Search across a workspace for threads, comments, and messages
- **reply** - Reply to threads or conversations
- **react** - Add reactions to threads, comments, conversations, or messages
- **markDone** - Mark threads or conversations as done (read and/or archived)
- **buildLink** - Build URLs to Twist resources

For more details on each tool, see the [src/tools](src/tools) directory.

## Dependencies

- MCP server using the official [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#installation)
- Twist TypeScript SDK [@doist/twist-sdk](https://github.com/Doist/twist-sdk-typescript)

## Local Development Setup

### Prerequisites

- Node.js 18 or higher
- npm
- A Twist account with API access

### Setup

1. Clone the repository:

```bash
git clone https://github.com/doist/twist-ai.git
cd twist-ai
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with your Twist API key:

```bash
TWIST_API_KEY=your-twist-api-key-here
```

4. Build the project:

```bash
npm run build
```

### Development Commands

- `npm start` - Build and run the MCP inspector for testing
- `npm run dev` - Development mode with auto-rebuild and restart
- `npm test` - Run all tests
- `npm run type-check` - Run TypeScript type checking
- `npm run lint:check` - Run linting checks
- `npm run format:check` - Check code formatting
- `npm run format:write` - Auto-fix formatting issues

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass (`npm test`)
2. Code is properly typed (`npm run type-check`)
3. Code follows the project's linting rules (`npm run lint:check`)
4. Code is properly formatted (`npm run format:check`)

Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `test:` for test changes
- `chore:` for maintenance tasks

## License

MIT
