export type CanvasVerifyResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: "unauthorized" | "forbidden" | "network" | "bad_response"
      readonly message: string
      readonly fieldErrors: Record<string, string>
    }

type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

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
