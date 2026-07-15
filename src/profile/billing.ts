import { createHash } from "node:crypto"

const BILLING_SALT = "59cf53e54c78"

interface BillingHeaderInput {
  firstUserText: string
  cliVersion: string
}

export function computeBillingHeaderText(input: BillingHeaderInput): string {
  const sampled = [4, 7, 20].map((index) => input.firstUserText[index] ?? "0").join("")
  const versionHash = createHash("sha256").update(`${BILLING_SALT}${sampled}${input.cliVersion}`).digest("hex").slice(0, 3)
  return `x-anthropic-billing-header: cc_version=${input.cliVersion}.${versionHash}; cc_entrypoint=cli; cch=00000;`
}
