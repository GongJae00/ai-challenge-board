import { useSyncExternalStore } from "react"

const loadedAt = Date.now()
const noSubscription = () => () => {}

/**
 * The current time: the build time while the page hydrates, then the time the browser loaded the page.
 * useSyncExternalStore keeps the build time for the hydrating render, so the server's and the browser's first
 * renders agree, and deadlines that passed since the build drop out right after.
 */
export function useNow(builtAt: string): Date {
  return new Date(
    useSyncExternalStore(
      noSubscription,
      () => loadedAt,
      () => Date.parse(builtAt)
    )
  )
}
