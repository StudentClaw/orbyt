import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { appAtomRegistry, createAtom, useAtomSubscribe } from "./atomRegistry"

const atom = createAtom("subscription-test", 0)

describe("useAtomSubscribe", () => {
  afterEach(() => {
    appAtomRegistry.set(atom, 0)
  })

  test("delivers updates to the latest listener after rerenders", () => {
    const firstListener = vi.fn()
    const secondListener = vi.fn()

    const { rerender, unmount } = renderHook(
      ({ listener }) => {
        useAtomSubscribe(atom, listener)
      },
      { initialProps: { listener: firstListener } },
    )

    act(() => {
      appAtomRegistry.set(atom, 1)
    })
    expect(firstListener).toHaveBeenCalledWith(1)

    rerender({ listener: secondListener })

    act(() => {
      appAtomRegistry.set(atom, 2)
    })

    expect(firstListener).toHaveBeenCalledTimes(1)
    expect(secondListener).toHaveBeenCalledWith(2)

    unmount()
  })
})
