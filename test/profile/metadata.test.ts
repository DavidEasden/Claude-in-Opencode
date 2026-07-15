import { describe, expect, it } from "vitest"
import { buildProfileUserID } from "../../src/profile/metadata"

describe("buildProfileUserID", () => {
  it("uses explicit ids before stable fallback ids", () => {
    const userID = JSON.parse(
      buildProfileUserID({
        sessionId: "ses_explicit",
        deviceId: "dev_explicit",
        accountUuid: "acc_explicit",
        stableFakeMetadata: true,
      }),
    )

    expect(userID).toEqual({ device_id: "dev_explicit", account_uuid: "acc_explicit", session_id: "ses_explicit" })
  })

  it("generates deterministic fake metadata when enabled", () => {
    const first = buildProfileUserID({ stableFakeMetadata: true })
    const second = buildProfileUserID({ stableFakeMetadata: true })

    expect(first).toBe(second)
    expect(JSON.parse(first)).toEqual({
      device_id: "bridge-device-00000000000000000000000000000000",
      account_uuid: "",
      session_id: "bridge-session-00000000-0000-4000-8000-000000000000",
    })
  })
})
