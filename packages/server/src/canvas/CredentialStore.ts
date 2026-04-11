/**
 * Opaque identifier for a Canvas credential stored outside SQLite.
 */
export type CanvasCredentialRef = string & { readonly __brand: "CanvasCredentialRef" }

/**
 * Future storage boundary for Canvas credentials kept out of the local database.
 */
export interface CanvasCredentialStore {
  readonly get: (ref: CanvasCredentialRef) => Promise<string | null>
  readonly put: (token: string) => Promise<CanvasCredentialRef>
  readonly remove: (ref: CanvasCredentialRef) => Promise<void>
}
