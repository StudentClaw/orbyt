import { useEffect, useRef, useSyncExternalStore } from "react"

export type Atom<Value> = {
  readonly label: string
  value: Value
  readonly listeners: Set<(value: Value) => void>
}

type SubscribeOptions = {
  readonly immediate?: boolean
}

export function createAtom<Value>(label: string, initialValue: Value): Atom<Value> {
  return {
    label,
    value: initialValue,
    listeners: new Set(),
  }
}

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

export function useAtomSubscribe<Value>(
  atom: Atom<Value>,
  listener: (value: Value) => void,
  options?: SubscribeOptions,
): void {
  const listenerRef = useRef(listener)
  listenerRef.current = listener

  useEffect(() => {
    return appAtomRegistry.subscribe(atom, (value) => listenerRef.current(value), options)
  }, [atom, options?.immediate])
}
