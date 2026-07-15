import { describe, expect, it } from "vitest"
import { normalizeSnapshot } from "../../src/parity/normalize"
import { redactSnapshot, redactString } from "../../src/parity/redact"
import type { ParityRequestSnapshot } from "../../src/parity/types"

describe("parity redaction and normalization", () => {
  it("redacts secrets, home paths, project paths, and known identifiers", () => {
    expect(
      redactString("/Users/david/project uses sk-ant-secret for account acc-123", {
        home: "/Users/david",
        projectRoot: "/Users/david/project",
        accountUuid: "acc-123",
      }),
    ).toBe("$PROJECT_ROOT uses $API_KEY_REDACTED for account $ACCOUNT_UUID")
  })

  it("redacts snapshot headers and body without normalizing header names", () => {
    const snapshot: ParityRequestSnapshot = {
      method: "POST",
      urlKind: "anthropic-messages",
      headers: {
        Authorization: "raw-token",
        "X-API-Key": "raw-api-key",
        "X-Claude-Code-Session-Id": "ses_123",
      },
      body: {
        cwd: "/Users/david/project",
        metadata: {
          user_id: JSON.stringify({ device_id: "dev-1", account_uuid: "acc-1", session_id: "ses_123" }),
        },
      },
    }

    expect(redactSnapshot(snapshot, { projectRoot: "/Users/david/project", deviceId: "dev-1", accountUuid: "acc-1", sessionId: "ses_123" })).toEqual({
      method: "POST",
      urlKind: "anthropic-messages",
      headers: {
        Authorization: "$AUTHORIZATION_REDACTED",
        "X-API-Key": "$API_KEY_REDACTED",
        "X-Claude-Code-Session-Id": "$SESSION_ID",
      },
      body: {
        cwd: "$PROJECT_ROOT",
        metadata: {
          user_id: JSON.stringify({ device_id: "$DEVICE_ID", account_uuid: "$ACCOUNT_UUID", session_id: "$SESSION_ID" }),
        },
      },
    })
  })

  it("normalizes headers and metadata user_id", () => {
    const snapshot: ParityRequestSnapshot = {
      method: "POST",
      urlKind: "anthropic-messages",
      headers: {
        "X-API-Key": "sk-ant-secret",
        Authorization: "Bearer token",
        "X-Claude-Code-Session-Id": "ses_123",
      },
      body: {
        metadata: {
          user_id: JSON.stringify({ device_id: "dev-1", account_uuid: "acc-1", session_id: "ses_123" }),
        },
      },
    }

    expect(normalizeSnapshot(snapshot, { deviceId: "dev-1", accountUuid: "acc-1", sessionId: "ses_123" })).toEqual({
      method: "POST",
      urlKind: "anthropic-messages",
      headers: {
        authorization: "$AUTHORIZATION_REDACTED",
        "x-api-key": "$API_KEY_REDACTED",
        "x-claude-code-session-id": "$SESSION_ID",
      },
      body: {
        metadata: {
          user_id: JSON.stringify({ device_id: "$DEVICE_ID", account_uuid: "$ACCOUNT_UUID", session_id: "$SESSION_ID" }),
        },
      },
    })
  })

  it("normalizes session header and metadata identifiers without redaction map", () => {
    const snapshot: ParityRequestSnapshot = {
      method: "POST",
      urlKind: "anthropic-messages",
      headers: {
        "X-Claude-Code-Session-Id": "ses_123",
      },
      body: {
        metadata: {
          user_id: JSON.stringify({ device_id: "dev-1", account_uuid: "acc-1", session_id: "ses_123" }),
        },
      },
    }

    const normalized = normalizeSnapshot(snapshot)

    expect(normalized.headers["x-claude-code-session-id"]).toBe("$SESSION_ID")
    expect(JSON.stringify(normalized)).not.toContain("ses_123")
    expect(JSON.stringify(normalized)).not.toContain("dev-1")
    expect(JSON.stringify(normalized)).not.toContain("acc-1")
  })

  it("redacts known metadata user_id fields when redaction map is incomplete", () => {
    const snapshot: ParityRequestSnapshot = {
      method: "POST",
      urlKind: "anthropic-messages",
      headers: {},
      body: {
        metadata: {
          user_id: JSON.stringify({ device_id: "dev-1", account_uuid: "acc-1", session_id: "ses_123", other: "keep-me" }),
        },
      },
    }

    expect(normalizeSnapshot(snapshot, { sessionId: "different-session" }).body.metadata).toEqual({
      user_id: JSON.stringify({ device_id: "$DEVICE_ID", account_uuid: "$ACCOUNT_UUID", session_id: "$SESSION_ID", other: "keep-me" }),
    })
  })
})
