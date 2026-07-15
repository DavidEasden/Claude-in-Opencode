interface ProfileUserIDInput {
  sessionId?: string
  deviceId?: string
  accountUuid?: string
  stableFakeMetadata?: boolean
  fallback?: { device_id: string; account_uuid: string; session_id: string }
}

const STABLE_FAKE_USER_ID = {
  device_id: "bridge-device-00000000000000000000000000000000",
  account_uuid: "",
  session_id: "bridge-session-00000000-0000-4000-8000-000000000000",
}

export function buildProfileUserID(input: ProfileUserIDInput): string {
  const fallback = input.stableFakeMetadata ? STABLE_FAKE_USER_ID : input.fallback
  const userID = {
    device_id: input.deviceId ?? fallback?.device_id ?? "",
    account_uuid: input.accountUuid ?? fallback?.account_uuid ?? "",
    session_id: input.sessionId ?? fallback?.session_id ?? "",
  }
  return JSON.stringify(userID)
}
