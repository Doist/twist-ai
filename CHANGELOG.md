# Changelog

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
