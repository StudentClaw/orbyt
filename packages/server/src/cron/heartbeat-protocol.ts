export type HeartbeatProtocolDecision = "skip" | "digest"

export interface HeartbeatDigestOutput {
  readonly decision: "digest"
  readonly body: string
}

export interface HeartbeatSkipOutput {
  readonly decision: "skip"
}

export type HeartbeatProtocolOutput = HeartbeatDigestOutput | HeartbeatSkipOutput

const DIGEST_PATTERN = /^DIGEST:\s*([\s\S]+)$/m
const SKIP_TOKEN = "SKIP"

const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}]/gu

const DASH_PATTERN = /[‐-―−]/g

/**
 * Defense-in-depth: enforce Orby's voice rules on whatever the model returned.
 * Strip emoji and any unicode/ascii dashes the prompt forbids, collapsing
 * resulting double spaces. The prompt still tells the model not to use them,
 * but parsers are the safety net.
 */
function sanitizeBody(raw: string): string {
  return raw
    .replace(EMOJI_PATTERN, "")
    .replace(DASH_PATTERN, " ")
    .replace(/\s-\s/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Parse the heartbeat agent's reply protocol.
 *
 *   SKIP
 *     Stay silent this tick.
 *   DIGEST: <body>
 *     Fire one notification with this body. Body may span multiple lines;
 *     everything after the marker (until end of reply) is the digest text.
 *
 * Anything malformed is treated as `skip`. We never invent a fire when the
 * model produced unparseable output.
 */
export function parseHeartbeatProtocol(reply: string): HeartbeatProtocolOutput {
  const trimmed = reply.trim()
  if (trimmed.length === 0) return { decision: "skip" }

  const digestMatch = DIGEST_PATTERN.exec(trimmed)
  if (digestMatch) {
    const rawBody = (digestMatch[1] ?? "").trim()
    const body = sanitizeBody(rawBody)
    if (body.length > 0) {
      return { decision: "digest", body }
    }
    return { decision: "skip" }
  }

  if (trimmed === SKIP_TOKEN || trimmed.startsWith(`${SKIP_TOKEN}\n`)) {
    return { decision: "skip" }
  }

  return { decision: "skip" }
}
