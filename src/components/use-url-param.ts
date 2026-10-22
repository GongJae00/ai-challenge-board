import { useCallback, useSyncExternalStore } from "react"

const CHANGE = "acb:url-param"

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange)
  window.addEventListener(CHANGE, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(CHANGE, onChange)
  }
}

/** The page's query string, such as `?platform=dacon`, as it changes; empty on the server. */
export function useSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => ""
  )
}

/**
 * A view setting kept in the page's query string, such as `?view=calendar`, so that it survives a reload or a
 * return from a listing's site. The server renders `fallback`, and the browser takes the URL's value right after
 * hydration. Setting the fallback removes the parameter.
 */
export function useUrlParam(
  name: string,
  fallback: string
): [string, (value: string) => void] {
  const search = useSearch()
  const value = new URLSearchParams(search).get(name) ?? fallback
  const setValue = useCallback(
    (next: string) => {
      const url = new URL(window.location.href)
      if (next === fallback) url.searchParams.delete(name)
      else url.searchParams.set(name, next)
      // Commas between several values stay readable in a shared link; a query string allows them unencoded.
      url.search = url.searchParams.toString().replaceAll("%2C", ",")
      window.history.replaceState(window.history.state, "", url)
      window.dispatchEvent(new Event(CHANGE))
    },
    [name, fallback]
  )
  return [value, setValue]
}
