import { useEffect, useEffectEvent, useSyncExternalStore } from "react"

/**
 * Minimal mutable atom used by the local renderer runtime state stores.
 */
export type Atom<Value> = {
  readonly label: string
  value: Value
  readonly listeners: Set<(value: Value) => void>
}

type SubscribeOptions = {
  readonly immediate?: boolean
}

/**
 * Creates a new in-memory atom with a label for debugging.
 */
export function createAtom<Value>(label: string, initialValue: Value): Atom<Value> {
  return {
    label,
    value: initialValue,
    listeners: new Set(),
  }
}

/**
 * Shared atom registry used by the renderer runtime state modules.
 */
export const appAtomRegistry = {
  get<Value>(atom: Atom<Value>): Value {
    return atom.value
  },

  set<Value>(atom: Atom<Value>, nextValue: Value): void {
    if (Object.is(atom.value, nextValue)) {
      return
    }

    atom.value = nextValue
    for (const listener of atom.listeners) {
      listener(nextValue)
    }
  },

  subscribe<Value>(
    atom: Atom<Value>,
    listener: (value: Value) => void,
    options?: SubscribeOptions,
  ): () => void {
    atom.listeners.add(listener)
    if (options?.immediate) {
      listener(atom.value)
    }
    return () => {
      atom.listeners.delete(listener)
    }
  },
}

/**
 * Reads an atom through `useSyncExternalStore` with an optional selector.
 */
export function useAtomValue<Value, Selected = Value>(
  atom: Atom<Value>,
  selector?: (value: Value) => Selected,
): Selected {
  const read = () => {
    const value = appAtomRegistry.get(atom)
    return selector ? selector(value) : (value as unknown as Selected)
  }

  return useSyncExternalStore(
    (notify) => appAtomRegistry.subscribe(atom, () => notify()),
    read,
    read,
  )
}

/**
 * Subscribes a React effect to atom updates using the latest listener implementation.
 */
export function useAtomSubscribe<Value>(
  atom: Atom<Value>,
  listener: (value: Value) => void,
  options?: SubscribeOptions,
): void {
  const immediate = options?.immediate ?? false
  const notifyListener = useEffectEvent((value: Value) => {
    listener(value)
  })

  useEffect(() => {
    return appAtomRegistry.subscribe(
      atom,
      (value) => notifyListener(value),
      immediate ? { immediate: true } : undefined,
    )
  }, [atom, immediate])
}
