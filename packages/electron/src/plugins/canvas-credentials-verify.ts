export type CanvasVerifyResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason:
        | "unauthorized"
        | "forbidden"
        | "network"
        | "bad_response"
        | "invalid_url"
      readonly message: string
      readonly fieldErrors: Record<string, string>
    }

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const PRIVATE_HOSTNAME_PATTERNS: ReadonlyArray<RegExp> = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local + cloud metadata (e.g. 169.254.169.254)
  /^0\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
]

/**
 * Reject non-HTTPS URLs and any host that points at a loopback, link-local,
 * or RFC1918 private network. The Bearer token shipped with this request
 * must never be allowed to leak to internal services or cloud metadata
 * endpoints (e.g. http://169.254.169.254/latest/meta-data).
 */
function validatePublicHttpsUrl(rawUrl: string): CanvasVerifyResult | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return {
      ok: false,
      reason: "invalid_url",
      message: "Canvas base URL is not a valid URL.",
      fieldErrors: { baseUrl: "Enter a valid HTTPS Canvas URL." },
    }
  }
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "invalid_url",
      message: "Canvas base URL must use https://.",
      fieldErrors: { baseUrl: "Use an https:// URL." },
    }
  }
  const host = parsed.hostname
  if (host.length === 0) {
    return {
      ok: false,
      reason: "invalid_url",
      message: "Canvas base URL is missing a hostname.",
      fieldErrors: { baseUrl: "Enter a valid Canvas hostname." },
    }
  }
  for (const pattern of PRIVATE_HOSTNAME_PATTERNS) {
    if (pattern.test(host)) {
      return {
        ok: false,
        reason: "invalid_url",
        message: "Canvas base URL points at a private or loopback address.",
        fieldErrors: { baseUrl: "Use your school's public Canvas URL." },
      }
    }
  }
  return null
}

/**
 * Confirms the Canvas credentials work by hitting /api/v1/users/self.
 * Runs in the Electron main process before saving so a stored "configured"
 * status truly means sync will succeed (or the error explains why it won't).
 */
export async function verifyCanvasCredentials(
  values: { baseUrl: string; token: string },
  fetchImpl: FetchImpl = fetch,
): Promise<CanvasVerifyResult> {
  const trimmedUrl = values.baseUrl.replace(/\/+$/, "")
  const guard = validatePublicHttpsUrl(trimmedUrl)
  if (guard !== null) return guard
  const url = `${trimmedUrl}/api/v1/users/self`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${values.token}`,
        Accept: "application/json",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      reason: "network",
      message: `Could not reach Canvas at ${trimmedUrl}: ${message}`,
      fieldErrors: { baseUrl: "Could not reach this Canvas URL." },
    }
  }

  if (response.status === 401) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "Canvas rejected the access token.",
      fieldErrors: { token: "Canvas rejected this access token." },
    }
  }

  if (response.status === 403) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Token lacks permission to read your Canvas profile.",
      fieldErrors: { token: "Token does not have permission for /users/self." },
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "bad_response",
      message: `Canvas returned HTTP ${response.status} for /api/v1/users/self.`,
      fieldErrors: { baseUrl: `Canvas returned HTTP ${response.status}.` },
    }
  }

  return { ok: true }
}
