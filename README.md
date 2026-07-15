# Claude in OpenCode

An opencode plugin that rewrites `@ai-sdk/anthropic` `/v1/messages` requests into Claude Code-like requests through an in-process custom `fetch`.

## What this is

- No local HTTP server by default
- No localhost `baseURL`
- No extra process to start
- opencode starts the plugin automatically
- The plugin injects `provider.anthropic.options.fetch`

## Install from source

> This project was previously named `opencode-claude-bridge`. Do not install that npm package; it belongs to another project. The current `claude-in-opencode` version must be built from this repository and loaded from the local plugin file.

Prerequisites:

- Node.js 20 or newer
- npm
- OpenCode
- An Anthropic API key

Clone and build:

```bash
git clone https://github.com/DavidEasden/Claude-in-Opencode.git
cd Claude-in-Opencode
npm ci
npm run build
node -e "const { pathToFileURL } = require('node:url'); const { resolve } = require('node:path'); console.log(pathToFileURL(resolve('dist/plugin.js')).href)"
```

最后一条命令输出完整且已编码的 file URL；将该输出直接粘贴到 OpenCode 的 plugin entry。

不要在此章节调用 `claude-in-opencode init`，因为当前 CLI 会写入裸包名而不是本地 file URL。

## Config

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

将上面的 `pathToFileURL` 命令完整输出直接替换示例中的 `file:///absolute/path/Claude-in-Opencode/dist/plugin.js`；不要手动添加或拼接 `file://`。

- 合并到已有 `opencode.json` 时保留用户原有字段，不要整文件覆盖。
- plugin entry 必须使用上面命令生成的完整绝对 file URL；不要使用相对路径或手动拼接 URL。
- 不要设置 `provider.anthropic.options.baseURL` 为 localhost；bridge 在 Anthropic SDK fetch 路径内运行。

先验证插件路径，再设置 API key 并启动 OpenCode：

```bash
opencode debug config | node -e "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).plugin_origins,null,2)))"
export ANTHROPIC_API_KEY="sk-ant-..."
opencode
```

- 第一条命令只打印 `plugin_origins`，其内容应指向刚构建的 `dist/plugin.js`。
- 不要分享未过滤的 `opencode debug config` 输出，因为它可能包含解析后的凭据。
- `opencode` 需要完全退出后重启，插件配置不会依赖当前已运行进程的热更新。
- API key 建议放在 shell profile 或密钥管理系统，不要提交到配置文件或仓库。

## Update

在源码目录执行：

```bash
git pull
npm ci
npm run build
```

然后完全退出并重启 OpenCode。

## Uninstall

从 `~/.config/opencode/opencode.json` 删除指向 `dist/plugin.js` 的 plugin 条目，删除本地 clone 目录，然后重启 OpenCode。

本地 `file://` 安装不使用 `claude-in-opencode uninstall`；该命令当前只识别裸包名配置。

Optional bridge settings can be passed as the second plugin tuple item:

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

These fields tune the generated Claude Code-like request metadata, thinking effort, tool list, system prompt blocks, user context, and date. `runtimeParity` is disabled by default and must be enabled explicitly. Defaults follow the captured Claude Code 2.1.205 SDK CLI request profile.

`runtimeParity.profile` defaults to `2.1.205-capture`. `source-compatible` enables newer fixture-backed runtime-state providers as they are implemented. `diagnostics` reports unsupported runtime-state gaps. `strictSystem` and `stableFakeMetadata` are opt-in profile-layer compatibility controls inspired by Claude Code CLI request shape; they do not run Claude Code.

Legacy options from earlier bridge profiles are still accepted so existing configs do not fail to load, but strict 2.1.205 emulation ignores request-shape options that would diverge from the capture: `maxTokens`, `effortMap`, `includeBillingHeader`, `rewriteSystemIdentity`, and `removeEagerInputStreaming`.

## Strict Claude Code emulation

The bridge rewrites the outbound Anthropic Messages body to match the captured Claude Code request shape. The following differences are expected:

- `baseURL` is controlled by opencode/provider configuration and is not changed by the bridge.
- API keys are preserved from opencode/provider configuration.
- Captured Claude Code metadata is replayed by default, unless `sessionId`, `deviceId`, or `accountUuid` is configured explicitly.

Runtime parity features mirror observable request-shape inputs:

- With `runtimeParity.enabled`, explicit `runtimeParity.cwd`, `scanClaudeMd: true`, and `readWorkspaceFiles: true`, the bridge reads cwd-confined `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, and direct `.claude/rules/*.md` files, expands cwd-confined memory `@include` directives, and supports narrow frontmatter `paths` filtering when `runtimeParity.activePaths` is supplied. Parent traversal outside `runtimeParity.cwd`, symlink escape, missing includes, binary files, oversized files, include cycles, and frontmatter paths without active paths are reported as runtime gaps.
- With `runtimeParity.enabled`, explicit `runtimeParity.cwd`, `preReadFiles: true`, and `readWorkspaceFiles: true`, the bridge scans user text for cwd-confined text `@file` mentions, including quoted paths and line ranges such as `@src/a.ts#L10-20` or `@src/a.ts:10-20`, and inserts bridge-generated pre-read request fragments. Caller-supplied `runtimeParity.preReadMessages` remain the highest-priority replay path and skip automatic reads. Missing files, directories, binary files, PDFs/images/notebooks, oversized files, unsupported encodings, invalid ranges, parent traversal, and symlink escape are reported as `AttachmentDomain` runtime gaps.
- OpenCode owns MCP configuration, transports, authentication, lifecycle, and tool execution. When runtime parity is enabled, the bridge automatically validates and mirrors already-exposed `mcp__*` tool schemas from the intercepted Anthropic request. Set `mirrorMcpTools: false` to opt out. `runtimeParity.mcpTools` is a deterministic replay/fallback source. `executeMcpServers` is deprecated and unsupported: it never starts a server and instead reports an `McpDomain` ownership gap.
- Hook and permission effects are mirrored only when `simulateHooks` / `simulatePermissions` are enabled and explicit `hookSystemMessages` / `permissionSystemMessages` are supplied; the bridge does not execute hooks or permission prompts.
- Runtime cache is process-local and session-scoped; restarting opencode clears it.

The bridge still does not guarantee arbitrary Claude Code runtime equivalence. Version drift, exact build suffixes, full MCP server lifecycle, real hooks, real permission prompts, compaction, background agents, binary/PDF pre-read semantics, and prior Claude Code session history require Claude Code itself or dedicated captures.

## Parity lab diagnostics

The `parity` commands are development-only tools for comparing bridge output against sanitized Claude Code golden fixtures. They do not run Claude Code in the built bridge runtime and do not require end users to install Claude Code.

Runtime diagnostics distinguish JSON request diffs from missing runtime-state inputs. A request can only claim exact parity when both the normalized diff is empty and no required domain reports a gap.

Phase 1 is diagnostics and infrastructure only: compatibility is fixture-covered and versioned to captured Claude Code request profiles, not a promise of arbitrary future Claude Code equivalence.

Phase 3A baseline fixtures named `full-single-turn`, `multi-turn`, and `tool-loop` are bridge-generated scaffolds. They exercise full-body comparison and runtime gate plumbing, but they must be replaced by sanitized Claude Code `2.1.205` golden captures before they can prove external Claude Code parity.

Phase 3B memory fixtures are bridge-generated scaffolds; they exercise the runtime gate and memory domain shape, but must be replaced by sanitized Claude Code `2.1.205` captures before proving external parity.

Phase 3C attachment fixtures are bridge-generated scaffolds; they exercise the runtime gate and AttachmentDomain shape, but must be replaced by sanitized Claude Code `2.1.205` captures before proving external parity.

Phase 3D MCP fixtures are bridge-generated scaffolds; they exercise OpenCode-owned MCP schema mirroring and runtime gaps, but must be replaced by sanitized Claude Code `2.1.205` captures before proving external parity.

完成构建后，在源码目录执行：

```bash
node dist/cli.js parity sanitize --input raw-fixture.json --output sanitized-fixture.json
node dist/cli.js parity diff --fixture sanitized-fixture.json --input opencode-request-body.json
```

`parity diff` prints structural differences and exits non-zero when differences are found.

Use `--runtime` to include runtime gap diagnostics and the parity gate result:

```bash
node dist/cli.js parity diff --runtime --fixture sanitized-fixture.json --input opencode-request-body.json
```

Runtime mode exits non-zero when either the normalized request diff is non-empty or runtime gaps are present.

Fixtures must be sanitized before committing or sharing. The sanitizer redacts API keys, authorization headers, known session/device/account identifiers, and configured local path prefixes.

## Doctor

当前 `doctor` 只识别裸包名配置，不适用于本 README 的本地 `file://` 安装。请在导出 API key 前使用以下命令验证本地插件配置：

```bash
opencode debug config | node -e "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).plugin_origins,null,2)))"
```

该命令只输出 `plugin_origins`，其内容应指向刚构建的 `dist/plugin.js`。不要分享未过滤的 `opencode debug config` 输出，因为它可能包含解析后的凭据。

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only). See [LICENSE](./LICENSE).
