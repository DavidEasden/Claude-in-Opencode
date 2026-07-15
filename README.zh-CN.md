# Claude in OpenCode

[English README](./README.md)

一个 OpenCode 插件。它通过进程内 custom `fetch`，将 `@ai-sdk/anthropic` 的 `/v1/messages` 请求重写为类似 Claude Code 的请求。

## 项目说明

- 默认不启动本地 HTTP server
- 不要求 localhost `baseURL`
- 不需要启动额外进程
- OpenCode 会在启动时加载插件
- 插件注入 `provider.anthropic.options.fetch`

## 从源码安装

> 本项目原名 `opencode-claude-bridge`。请不要安装该 npm 包；它属于另一个项目。当前 `claude-in-opencode` 版本必须从本仓库构建并通过本地插件文件加载。

前置条件：

- Node.js 20 或更高版本
- npm
- OpenCode
- Anthropic API key

克隆并构建：

```bash
git clone https://github.com/DavidEasden/Claude-in-Opencode.git
cd Claude-in-Opencode
npm ci
npm run build
node -e "const { pathToFileURL } = require('node:url'); const { resolve } = require('node:path'); console.log(pathToFileURL(resolve('dist/plugin.js')).href)"
```

最后一条命令会输出完整且已编码的 `file://` URL，请将完整输出直接粘贴到 OpenCode 的 plugin entry。不要手动拼接 `file://`。

不要在本地 file URL 安装流程中运行 `claude-in-opencode init`；当前 CLI 会写入裸包名。

## 配置

编辑 `~/.config/opencode/opencode.json`，将构建产物配置为插件入口：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "file:///absolute/path/Claude-in-Opencode/dist/plugin.js",
      { "mode": "fetch" }
    ]
  ],
  "model": "anthropic/claude-opus-4-8",
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}"
      }
    }
  }
}
```

将上一步 `pathToFileURL` 命令的完整输出直接替换示例中的 `file:///absolute/path/Claude-in-Opencode/dist/plugin.js`；不要手动添加或拼接 `file://`。

- 合并到已有的 `opencode.json` 时保留用户原有字段，不要覆盖整个文件。
- plugin entry 必须使用上一步命令生成的完整绝对 file URL；不要使用相对路径或手动拼接 URL。
- 不要设置 `provider.anthropic.options.baseURL` 为 localhost；bridge 在 Anthropic SDK fetch 路径内运行。

先过滤配置并验证插件路径，再导出 API key 并启动 OpenCode：

```bash
opencode debug config | node -e "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).plugin_origins,null,2)))"
export ANTHROPIC_API_KEY="sk-ant-..."
opencode
```

- 第一条命令只输出 `plugin_origins`，其内容应指向刚构建的 `dist/plugin.js`。
- 不要分享未过滤的 `opencode debug config` 输出，因为它可能包含解析后的凭据。
- 修改插件配置后必须完全退出并重启 OpenCode；插件配置不会依赖当前已运行进程的热更新。
- API key 应放在 shell profile 或密钥管理系统中，不要提交到配置文件或仓库。

## 更新

在源码目录执行：

```bash
git pull
npm ci
npm run build
```

然后完全退出并重启 OpenCode。

## 卸载

从 `~/.config/opencode/opencode.json` 删除指向 `dist/plugin.js` 的 plugin 条目，删除本地 clone 目录，然后重启 OpenCode。

本地 `file://` 安装不使用 `claude-in-opencode uninstall`；当前该命令只识别裸包名配置。

可选的 bridge 设置可以作为 plugin tuple 的第二项传入。

首项直接粘贴上面 `pathToFileURL` 命令输出的完整编码 file URL：

```json
[
  "file:///absolute/path/Claude-in-Opencode/dist/plugin.js",
  {
    "mode": "fetch",
    "sessionId": "session-id",
    "deviceId": "device-id",
    "accountUuid": "account-uuid",
    "effort": "high",
    "toolNames": ["bash", "read"],
    "systemPrompt": "Replacement system prompt",
    "appendSystemPrompt": "Extra system guidance",
    "userContextBlock": "User context text",
    "currentDate": "2026-07-11",
    "runtimeParity": {
      "enabled": true,
      "profile": "source-compatible",
      "diagnostics": true,
      "strictSystem": true,
      "stableFakeMetadata": true,
      "cwd": "/absolute/project/path",
      "scanClaudeMd": true,
      "preReadFiles": true,
      "preReadMessages": [],
      "mirrorMcpTools": true,
      "simulateHooks": true,
      "simulatePermissions": true,
      "cache": true,
      "hookSystemMessages": [],
      "permissionSystemMessages": [],
      "mcpTools": []
    }
  }
]
```

这些字段用于调整生成的 Claude Code-like 请求 metadata、thinking effort、tool list、system prompt blocks、user context 和 date。`runtimeParity` 默认禁用，必须显式启用。默认值遵循捕获的 Claude Code 2.1.205 SDK CLI request profile。

`runtimeParity.profile` 默认为 `2.1.205-capture`。`source-compatible` 会在实现新版本 fixture-backed runtime-state provider 时启用它们。`diagnostics` 会报告不受支持的 runtime-state 缺口。`strictSystem` 和 `stableFakeMetadata` 是受 Claude Code CLI request shape 启发的、可选启用的 profile-layer compatibility control；它们不会运行 Claude Code。

早期 bridge profile 的 legacy options 仍会被接受，因此现有配置不会加载失败；但严格的 2.1.205 emulation 会忽略与 capture 不一致的 request-shape options：`maxTokens`、`effortMap`、`includeBillingHeader`、`rewriteSystemIdentity` 和 `removeEagerInputStreaming`。

## 严格的 Claude Code 模拟

bridge 会将出站 Anthropic Messages body 重写为符合已捕获 Claude Code request shape 的形式。以下差异是预期行为：

- `baseURL` 由 opencode/provider 配置控制，bridge 不会修改它。
- API keys 会保留来自 opencode/provider 配置的值。
- 默认会重放捕获的 Claude Code metadata，除非显式配置了 `sessionId`、`deviceId` 或 `accountUuid`。

runtime parity 功能会镜像可观察到的 request-shape 输入：

- 启用 `runtimeParity.enabled`、明确设置 `runtimeParity.cwd`、设置 `scanClaudeMd: true` 和 `readWorkspaceFiles: true` 时，bridge 会读取限定在 cwd 内的 `CLAUDE.md`、`.claude/CLAUDE.md`、`CLAUDE.local.md` 以及直接位于 `.claude/rules/*.md` 的文件，展开限定在 cwd 内的 memory `@include` 指令；当提供 `runtimeParity.activePaths` 时，还支持窄范围的 frontmatter `paths` 过滤。超出 `runtimeParity.cwd` 的父目录遍历、符号链接逃逸、缺失的 include、二进制文件、超大文件、include 循环，以及没有 active paths 的 frontmatter paths，都会报告为 runtime gaps。
- 启用 `runtimeParity.enabled`、明确设置 `runtimeParity.cwd`、设置 `preReadFiles: true` 和 `readWorkspaceFiles: true` 时，bridge 会扫描用户文本中的限定在 cwd 内的文本 `@file` 引用，包括带引号的路径和 `@src/a.ts#L10-20` 或 `@src/a.ts:10-20` 这样的行范围，并插入由 bridge 生成的 pre-read request fragments。调用方提供的 `runtimeParity.preReadMessages` 仍是优先级最高的 replay 路径，并会跳过自动读取。缺失文件、目录、二进制文件、PDF/图片/ notebook、超大文件、不支持的编码、无效范围、父目录遍历和符号链接逃逸，都会报告为 `AttachmentDomain` runtime gaps。
- OpenCode 负责 MCP 配置、传输、身份验证、生命周期和工具执行。启用 runtime parity 后，bridge 会自动验证并镜像从拦截的 Anthropic 请求中已经暴露的 `mcp__*` tool schemas。设置 `mirrorMcpTools: false` 可选择退出。`runtimeParity.mcpTools` 是确定性的 replay/fallback 来源。`executeMcpServers` 已弃用且不受支持：它不会启动 server，而是报告 `McpDomain` ownership gap。
- 只有在启用 `simulateHooks` / `simulatePermissions` 且提供明确的 `hookSystemMessages` / `permissionSystemMessages` 时，才会镜像 hook 和 permission effects；bridge 不会执行 hooks 或 permission prompts。
- Runtime cache 是进程本地且按 session 作用域保存的；重启 `opencode` 会清除它。

bridge 仍不保证任意 Claude Code runtime equivalence。版本漂移、精确的 build suffixes、完整的 MCP server lifecycle、真实 hooks、真实 permission prompts、compaction、background agents、binary/PDF pre-read semantics，以及此前的 Claude Code session history，都需要 Claude Code 本身或专门的 captures。

## Parity lab 诊断

`parity` commands 是开发专用工具，用于将 bridge 输出与经过清理的 Claude Code golden fixtures 进行比较。它们不会在构建后的 bridge runtime 中运行 Claude Code，也不要求终端用户安装 Claude Code。

Runtime diagnostics 会区分 JSON request diffs 与缺失的 runtime-state inputs。只有在 normalized diff 为空且没有任何必需 domain 报告 gap 时，请求才能声称 exact parity。

Phase 1 仅包含 diagnostics 和 infrastructure：兼容性以 fixture 覆盖并绑定到已捕获的 Claude Code request profiles 版本，而不是对未来任意 Claude Code equivalence 的承诺。

名称为 `full-single-turn`、`multi-turn` 和 `tool-loop` 的 Phase 3A baseline fixtures 是 bridge 生成的 scaffolds。它们用于测试 full-body comparison 和 runtime gate plumbing，但在能够证明外部 Claude Code parity 之前，必须替换为经过清理的 Claude Code `2.1.205` golden captures。

Phase 3B memory fixtures 是 bridge 生成的 scaffolds；它们用于测试 runtime gate 和 memory domain shape，但在证明外部 parity 之前，必须替换为经过清理的 Claude Code `2.1.205` captures。

Phase 3C attachment fixtures 是 bridge 生成的 scaffolds；它们用于测试 runtime gate 和 AttachmentDomain shape，但在证明外部 parity 之前，必须替换为经过清理的 Claude Code `2.1.205` captures。

Phase 3D MCP fixtures 是 bridge 生成的 scaffolds；它们用于测试 OpenCode-owned MCP schema mirroring 和 runtime gaps，但在证明外部 parity 之前，必须替换为经过清理的 Claude Code `2.1.205` captures。

完成构建后，在源码目录执行：

```bash
node dist/cli.js parity sanitize --input raw-fixture.json --output sanitized-fixture.json
node dist/cli.js parity diff --fixture sanitized-fixture.json --input opencode-request-body.json
```

`parity diff` 会打印结构化差异，并在发现差异时以非零状态退出。

使用 `--runtime` 可加入 runtime gap diagnostics 和 parity gate result：

```bash
node dist/cli.js parity diff --runtime --fixture sanitized-fixture.json --input opencode-request-body.json
```

当 normalized request diff 非空或存在 runtime gaps 时，runtime mode 会以非零状态退出。

Fixtures 在提交或分享前必须经过清理。sanitizer 会脱敏 API keys、authorization headers、已知的 session/device/account identifiers，以及配置的本地路径前缀。

## Doctor

当前 `doctor` 只识别裸包名配置，不适用于本 README 的本地 `file://` 安装。请在导出 API key 前使用以下命令验证本地插件配置：

```bash
opencode debug config | node -e "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).plugin_origins,null,2)))"
```

该命令只输出 `plugin_origins`，其内容应指向刚构建的 `dist/plugin.js`。不要分享未过滤的 `opencode debug config` 输出，因为它可能包含解析后的凭据。

## 许可证

本项目采用 GNU Affero General Public License v3.0（AGPL-3.0-only）许可，详情见 [LICENSE](./LICENSE)。
