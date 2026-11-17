import { useSyncExternalStore } from "react"

/** Tailwind's `sm` breakpoint, where the table's `WIDE_ONLY` columns appear; keep the two in step. */
const WIDE = "(min-width: 40rem)"

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** Whether the screen is wide enough for every column; true on the server, which renders the default order. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => true
  )
}
