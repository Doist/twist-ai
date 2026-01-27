# Changelog

## [4.0.0](https://github.com/Doist/twist-ai/compare/v3.1.0...v4.0.0) (2026-01-27)


### ⚠ BREAKING CHANGES

* **mcp:** Tool names changed (e.g. load_thread -> load-thread, fetch_inbox -> fetch-inbox, mark_done -> mark-done).

### Features

* **mcp:** switch tool names to kebab-case ([06f4404](https://github.com/Doist/twist-ai/commit/06f4404dcf90168d89f91e3abdee499ad0462df5)), closes [#82](https://github.com/Doist/twist-ai/issues/82)

## [3.1.0](https://github.com/Doist/twist-ai/compare/v3.0.1...v3.1.0) (2026-01-27)


### Features

* **mcp:** add ToolAnnotations hints ([fc8eaa4](https://github.com/Doist/twist-ai/commit/fc8eaa4d019ea996edac31259c4ff8b48335e4cb))

## [3.0.1](https://github.com/Doist/twist-ai/compare/v3.0.0...v3.0.1) (2026-01-27)


### Bug Fixes

* register build_link tool in MCP server ([#83](https://github.com/Doist/twist-ai/issues/83)) ([d4ed5b4](https://github.com/Doist/twist-ai/commit/d4ed5b4cf094b8d9418648619c6fed93f8524e38))

## [3.0.0](https://github.com/Doist/twist-ai/compare/v2.0.0...v3.0.0) (2025-12-30)


### ⚠ BREAKING CHANGES

* @modelcontextprotocol/sdk moved to peerDependencies. Consumers must now explicitly install: npm install @modelcontextprotocol/sdk@^1.25.0

### Features

* make MCP SDK a peer dependency ([50eeba2](https://github.com/Doist/twist-ai/commit/50eeba20736bb8e6204ac1c25d2e43550a946443))


### Bug Fixes

* **deps:** update dependency @modelcontextprotocol/sdk to v1.25.1 ([#66](https://github.com/Doist/twist-ai/issues/66)) ([ae4f9c8](https://github.com/Doist/twist-ai/commit/ae4f9c82d85b7591e38fdcdd44bffec9e4233dc8))

## [2.0.0](https://github.com/Doist/twist-ai/compare/v1.2.2...v2.0.0) (2025-12-16)


### ⚠ BREAKING CHANGES

* upgrade to Zod v4 ([#59](https://github.com/Doist/twist-ai/issues/59))

### Features

* upgrade to Zod v4 ([#59](https://github.com/Doist/twist-ai/issues/59)) ([1ce1254](https://github.com/Doist/twist-ai/commit/1ce1254df67d56207426b0cb541939e089a5301c))


### Bug Fixes

* **deps:** update dependency @modelcontextprotocol/sdk to v1.24.0 [security] ([#57](https://github.com/Doist/twist-ai/issues/57)) ([21023c5](https://github.com/Doist/twist-ai/commit/21023c59a5d9fa94defcbd8cb661df0febbc0a07))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.24.1 ([#61](https://github.com/Doist/twist-ai/issues/61)) ([b5e52a2](https://github.com/Doist/twist-ai/commit/b5e52a2d37207a76b0720915a7772041d17ac1c1))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.24.3 ([#63](https://github.com/Doist/twist-ai/issues/63)) ([cb0e8e9](https://github.com/Doist/twist-ai/commit/cb0e8e92779e65c400b7593818af29c8ad00c221))

## [1.2.2](https://github.com/Doist/twist-ai/compare/v1.2.1...v1.2.2) (2025-12-02)


### Bug Fixes

* always include structuredContent in tool outputs to prevent MCP validation errors ([#55](https://github.com/Doist/twist-ai/issues/55)) ([40fc577](https://github.com/Doist/twist-ai/commit/40fc5776196b443add18a746e49405349eb57980))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.23.0 ([#52](https://github.com/Doist/twist-ai/issues/52)) ([16f7d46](https://github.com/Doist/twist-ai/commit/16f7d4606b6bb8d98a3993ab52bef5cb2fead30d))

## [1.2.1](https://github.com/Doist/twist-ai/compare/v1.2.0...v1.2.1) (2025-11-27)


### Bug Fixes

* **deps:** update production dependencies ([#47](https://github.com/Doist/twist-ai/issues/47)) ([0c4e020](https://github.com/Doist/twist-ai/commit/0c4e020d2f2ea22519055ad2534dfd70aa84a784))

## [1.2.0](https://github.com/Doist/twist-ai/compare/v1.1.1...v1.2.0) (2025-11-20)


### Features

* add read-only and destructive hints to all tools ([#44](https://github.com/Doist/twist-ai/issues/44)) ([234f3de](https://github.com/Doist/twist-ai/commit/234f3de1dab0d5eb7b8fb6284aec1b7f36d8f00e))

## [1.1.1](https://github.com/Doist/twist-ai/compare/v1.1.0...v1.1.1) (2025-11-19)


### Bug Fixes

* Correct repository URL case for npm provenance ([3af8429](https://github.com/Doist/twist-ai/commit/3af8429b4575c1b64c69dc9fee1a92eb58ca498a))
* **deps:** update dependency @modelcontextprotocol/sdk to v1.21.1 ([#40](https://github.com/Doist/twist-ai/issues/40)) ([be0a8b3](https://github.com/Doist/twist-ai/commit/be0a8b38e51608a0b375495369e4ec5f248641f3))

## [1.1.0](https://github.com/Doist/twist-ai/compare/v1.0.0...v1.1.0) (2025-11-12)


### Features

* Switch publishing from GitHub Packages to npmjs ([fda0f3b](https://github.com/Doist/twist-ai/commit/fda0f3bb6c683a0251535da5771d556cd865041e))


### Bug Fixes

* **deps:** pin dependencies ([#35](https://github.com/Doist/twist-ai/issues/35)) ([af53226](https://github.com/Doist/twist-ai/commit/af53226503cfd5b7b5209117211fd7cb941ed044))

## [1.0.0](https://github.com/Doist/twist-ai/compare/v0.2.2...v1.0.0) (2025-11-08)


### ⚠ BREAKING CHANGES

* Update to v1 of Twist SDK ([#30](https://github.com/Doist/twist-ai/issues/30))

### Features

* Add output schema support to all tools ([#28](https://github.com/Doist/twist-ai/issues/28)) ([355a341](https://github.com/Doist/twist-ai/commit/355a3414ccdd35b47e2b81d007fba71e651950ff))
* Update to v1 of Twist SDK ([#30](https://github.com/Doist/twist-ai/issues/30)) ([a2d7110](https://github.com/Doist/twist-ai/commit/a2d7110b898e3b621f7fcadbeaf2ca164833ff38))

## [0.2.2-alpha.2](https://github.com/Doist/twist-ai/compare/v0.2.1-alpha.2...v0.2.2-alpha.2) (2025-10-28)

### Bug Fixes

- Migrate to twist-sdk v0.1.0-alpha.4 API

## [0.2.1-alpha.2](https://github.com/Doist/twist-ai/compare/v0.2.0-alpha.2...v0.2.1-alpha.2) (2025-10-26)

### Bug Fixes

- Add --repo parameter to workflow run command ([a1dce5e](https://github.com/Doist/twist-ai/commit/a1dce5e44978869af7ebd7856327d2981fd85e0f))

## [0.2.0-alpha.2](https://github.com/Doist/twist-ai/compare/v0.1.0-alpha.2...v0.2.0-alpha.2) (2025-10-26)

### Features

- Adds `get-workspaces` and `get-users` tools ([#13](https://github.com/Doist/twist-ai/issues/13)) ([2c86c85](https://github.com/Doist/twist-ai/commit/2c86c85ff9f216608624c5baf915a95ee0d5211e))
- Set up release-please automation with workflow_dispatch trigger ([#15](https://github.com/Doist/twist-ai/issues/15)) ([9216665](https://github.com/Doist/twist-ai/commit/9216665d926b6376a1eb165686af05800cfcaf4f))
