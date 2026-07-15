import { describe, expect, it, vi } from "vitest"
import { createBridgeFetch } from "../src/fetch"
import { resolveBridgeOptions } from "../src/config"

function parseSSEDataLines(text: string) {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)))
}

describe("createBridgeFetch", () => {
  it("rewrites Anthropic messages request bodies", async () => {
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.max_tokens).toBe(64000)
      expect(body.thinking).toEqual({ type: "adaptive" })
      expect(body.output_config).toEqual({ effort: "high" })
      return new Response("event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      })
    })

    const bridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({}),
      upstreamFetch: upstream,
    })

    const response = await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-session-id": "ses_test", "content-type": "application/json" },
      body: JSON.stringify({
        max_tokens: 32000,
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "max" },
        system: [],
        messages: [],
        stream: true,
      }),
    })

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledOnce()
  })

  it("normalizes Claude Code-like Anthropic headers and prefers configured session id", async () => {
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("accept")).toBe("application/json")
      expect(headers.get("content-type")).toBe("application/json")
      expect(headers.get("x-api-key")).toBe("keep-me")
      expect(headers.get("authorization")).toBe("Bearer keep-auth")
      expect(headers.get("anthropic-version")).toBe("2023-06-01")
      expect(headers.get("anthropic-beta")).toBe(
        "claude-code-20250219,interleaved-thinking-2025-05-14,thinking-token-count-2026-05-13,context-management-2025-06-27,prompt-caching-scope-2026-01-05,mid-conversation-system-2026-04-07,effort-2025-11-24",
      )
      expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true")
      expect(headers.get("x-app")).toBe("cli")
      expect(headers.get("user-agent")).toBe("claude-cli/2.1.205 (external, sdk-cli)")
      expect(headers.get("x-claude-code-session-id")).toBe("configured-session")
      expect(headers.get("x-session-id")).toBeNull()
      expect(headers.get("session_id")).toBeNull()
      expect(headers.get("conversation_id")).toBeNull()
      expect(headers.get("x-session-affinity")).toBeNull()
      return new Response("ok")
    })
    const bridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({ sessionId: "configured-session" }),
      upstreamFetch: upstream,
    })

    await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "Application/JSON; charset=utf-8",
        "x-api-key": "keep-me",
        authorization: "Bearer keep-auth",
        "anthropic-beta": "structured-outputs-2025-11-13",
        "anthropic-version": "wrong",
        "x-session-id": "ses_test",
        session_id: "session-id",
        conversation_id: "conversation-id",
        "x-session-affinity": "affinity",
        "user-agent": "opencode/1.17.16",
      },
      body: JSON.stringify({
        system: [],
        messages: [],
        tools: [],
        thinking: { type: "adaptive" },
        output_config: { effort: "max" },
      }),
    })
  })

  it("uses source-compatible profile headers only when opted in", async () => {
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("user-agent")).toBe("claude-cli/2.1.205 (external, cli)")
      expect(headers.get("x-stainless-lang")).toBe("js")
      expect(headers.get("x-stainless-helper-method")).toBe("stream")
      expect(headers.get("anthropic-beta")).toContain("effort-2025-11-24")
      return new Response("ok")
    })
    const bridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({ runtimeParity: { enabled: true, profile: "source-compatible" } }),
      upstreamFetch: upstream,
    })

    await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-id": "ses_source" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], stream: true }),
    })

    const defaultUpstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("user-agent")).toBe("claude-cli/2.1.205 (external, sdk-cli)")
      expect(headers.get("x-stainless-lang")).toBeNull()
      return new Response("ok")
    })
    const defaultBridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({ runtimeParity: { enabled: true, profile: "2.1.205-capture" } }),
      upstreamFetch: defaultUpstream,
    })

    await defaultBridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-session-id": "ses_default" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], stream: true }),
    })
  })

  it("uses incoming session id when no configured session id is set", async () => {
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("x-claude-code-session-id")).toBe("incoming-session")
      return new Response("ok")
    })
    const bridgeFetch = createBridgeFetch({ options: resolveBridgeOptions({}), upstreamFetch: upstream })

    await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-session-id": "incoming-session",
      },
      body: JSON.stringify({ system: [], messages: [] }),
    })
  })

  it("passes through invalid JSON requests without throwing", async () => {
    const upstreamResponse = new Response("ok")
    const upstream = vi.fn(async () => upstreamResponse)
    const bridgeFetch = createBridgeFetch({ options: resolveBridgeOptions({}), upstreamFetch: upstream })
    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    }

    const response = await bridgeFetch("https://api.anthropic.com/v1/messages", init)

    expect(response).toBe(upstreamResponse)
    expect(upstream).toHaveBeenCalledOnce()
    expect(upstream).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", init)
  })

  it("rewrites Anthropic messages request bodies with case-insensitive JSON content type", async () => {
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.max_tokens).toBe(64000)
      expect(body.thinking).toEqual({ type: "adaptive" })
      expect(body.output_config).toEqual({ effort: "high" })
      return new Response("event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      })
    })

    const bridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({}),
      upstreamFetch: upstream,
    })

    const response = await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-session-id": "ses_test", "content-type": "Application/JSON" },
      body: JSON.stringify({
        max_tokens: 32000,
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "max" },
        system: [],
        messages: [],
        stream: true,
      }),
    })

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledOnce()
  })

  it("passes through non-JSON content types without reading the body", async () => {
    const upstreamResponse = new Response("ok")
    const upstream = vi.fn(async () => upstreamResponse)
    const bridgeFetch = createBridgeFetch({ options: resolveBridgeOptions({}), upstreamFetch: upstream })
    const init: RequestInit = {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: {
        toString() {
          throw new Error("body should not be read")
        },
      } as unknown as BodyInit,
    }

    const response = await bridgeFetch("https://api.anthropic.com/v1/messages", init)

    expect(response).toBe(upstreamResponse)
    expect(upstream).toHaveBeenCalledOnce()
    expect(upstream).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", init)
  })

  it("passes through non-message requests", async () => {
    const upstream = vi.fn(async () => new Response("ok"))
    const bridgeFetch = createBridgeFetch({ options: resolveBridgeOptions({}), upstreamFetch: upstream })

    await bridgeFetch("https://api.anthropic.com/v1/models", { method: "GET" })

    expect(upstream).toHaveBeenCalledWith("https://api.anthropic.com/v1/models", { method: "GET" })
  })

  it("handles opencode title-generation requests locally", async () => {
    const upstream = vi.fn(async () => new Response("should not be called"))
    const bridgeFetch = createBridgeFetch({ options: resolveBridgeOptions({}), upstreamFetch: upstream })
    const model = "claude-test-title-model"

    const response = await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "keep-me" },
      body: JSON.stringify({
        model,
        max_tokens: 48000,
        system: [{ type: "text", text: "You are a title generator. You output ONLY a thread title." }],
        messages: [{ role: "user", content: [{ type: "text", text: "Title this" }] }],
        stream: true,
      }),
    })

    expect(upstream).not.toHaveBeenCalled()
    expect(response.headers.get("content-type")).toContain("text/event-stream")
    const text = await response.text()
    expect(text).toContain("event: message_stop")

    const dataLines = parseSSEDataLines(text)
    expect(dataLines).toContainEqual({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "New chat" },
    })
    expect(dataLines).toContainEqual(
      expect.objectContaining({
        type: "message_start",
        message: expect.objectContaining({ model }),
      }),
    )
  })

  it("passes through non-streaming title-generation-like requests", async () => {
    const upstreamResponse = new Response("upstream title response")
    const upstream = vi.fn(async () => upstreamResponse)
    const bridgeFetch = createBridgeFetch({ options: resolveBridgeOptions({}), upstreamFetch: upstream })

    const response = await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "keep-me" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 48000,
        system: [{ type: "text", text: "You are a title generator. You output ONLY a thread title." }],
        messages: [{ role: "user", content: [{ type: "text", text: "Title this" }] }],
        stream: false,
      }),
    })

    expect(response).toBe(upstreamResponse)
    expect(upstream).toHaveBeenCalledOnce()
  })

  it("injects CLAUDE.md and caller-supplied pre-read runtime context through bridge fetch", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const cwd = await mkdtemp(join(tmpdir(), "bridge-fetch-runtime-"))
    await writeFile(join(cwd, "CLAUDE.md"), "Always include project memory.")
    let requestBody: unknown
    const bridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({
        runtimeParity: {
          cwd,
          scanClaudeMd: true,
          readWorkspaceFiles: true,
          preReadFiles: true,
          preReadMessages: ["Called the Read tool with captured fixture output: alpha beta"],
        },
      }),
      upstreamFetch: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
      },
    })

    await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test", "x-claude-code-session-id": "session-1" },
      body: JSON.stringify({ messages: [{ role: "user", content: "summarize @sample.txt" }] }),
    })

    const body = requestBody as { messages: Array<{ role: string; content: unknown }> }
    expect(JSON.stringify(body.messages)).toContain("Always include project memory.")
    expect(JSON.stringify(body.messages)).toContain("Called the Read tool")
    expect(JSON.stringify(body.messages)).toContain("alpha beta")
  })

  it("injects automatic @file pre-read messages through bridge fetch", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const cwd = await mkdtemp(join(tmpdir(), "bridge-fetch-attachments-"))
    await writeFile(join(cwd, "sample.txt"), "alpha beta")
    let requestBody: unknown
    const bridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({ runtimeParity: { cwd, preReadFiles: true, readWorkspaceFiles: true } }),
      upstreamFetch: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
      },
    })

    await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({ messages: [{ role: "user", content: "summarize @sample.txt" }] }),
    })

    const serialized = JSON.stringify((requestBody as { messages: unknown }).messages)
    expect(serialized).toContain("Bridge-generated automatic @file pre-read for sample.txt")
    expect(serialized).toContain("alpha beta")
  })

  it("mirrors OpenCode MCP schemas into the transformed request by default", async () => {
    let requestBody: unknown
    const bridgeFetch = createBridgeFetch({
      options: resolveBridgeOptions({ runtimeParity: { enabled: true } }),
      upstreamFetch: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body))
        return new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
      },
    })

    await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "test" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "search" }],
        tools: [
          {
            name: "mcp__demo__search",
            description: "Search",
            input_schema: { type: "object" },
            eager_input_streaming: true,
          },
        ],
      }),
    })

    const tools = (requestBody as { tools: Array<Record<string, unknown>> }).tools
    const mcpTool = tools.find((tool) => tool.name === "mcp__demo__search")
    expect(mcpTool).toEqual({ name: "mcp__demo__search", description: "Search", input_schema: { type: "object" } })
  })

  it("bridges tool loop requests and responses between opencode and Claude Code shapes", async () => {
    const upstreamBodies: unknown[] = []
    const upstream = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      upstreamBodies.push(JSON.parse(String(init?.body)))
      return new Response(
        [
          "event: content_block_start",
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"Bash","input":{}}}',
          "",
          "event: message_delta",
          'data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":1}}',
          "",
        ].join("\n"),
        { headers: { "content-type": "text/event-stream; charset=utf-8" } },
      )
    })
    const bridgeFetch = createBridgeFetch({ options: resolveBridgeOptions({}), upstreamFetch: upstream })

    const firstResponse = await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "keep-me" },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 32000,
        system: [{ type: "text", text: "You are OpenCode" }],
        messages: [{ role: "user", content: [{ type: "text", text: "Use bash", cache_control: { type: "ephemeral" } }] }],
        tools: [{ name: "bash", input_schema: { type: "object" } }],
        tool_choice: { type: "auto" },
        stream: true,
      }),
    })

    const firstUpstream = upstreamBodies[0] as { tools?: Array<{ name?: string }> }
    expect(firstUpstream).not.toHaveProperty("tool_choice")
    expect(firstUpstream.tools?.some((tool) => tool.name === "Bash")).toBe(true)
    expect(firstUpstream.tools?.some((tool) => tool.name === "bash")).toBe(false)

    const firstResponseText = await firstResponse.text()
    expect(firstResponseText).toContain('"name":"bash"')
    expect(firstResponseText).not.toContain('"name":"Bash"')

    await bridgeFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "keep-me" },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 32000,
        system: [{ type: "text", text: "You are OpenCode" }],
        messages: [
          { role: "user", content: [{ type: "text", text: "Use bash" }] },
          {
            role: "assistant",
            content: [{ type: "tool_use", id: "toolu_1", name: "bash", input: { command: "printf ok" } }],
          },
          { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "ok" }] },
        ],
        tools: [{ name: "bash", input_schema: { type: "object" } }],
        tool_choice: { type: "auto" },
        stream: true,
      }),
    })

    const continuation = upstreamBodies[1] as { messages: Array<{ role: string; content: Array<Record<string, unknown>> }> }
    expect(continuation.messages[1]?.content[0]).toEqual({
      type: "tool_use",
      id: "toolu_1",
      name: "Bash",
      input: { command: "printf ok" },
    })
    expect(continuation.messages[2]?.content[0]).toEqual({
      type: "tool_result",
      tool_use_id: "toolu_1",
      content: "ok",
      cache_control: { type: "ephemeral" },
    })
  })
})
