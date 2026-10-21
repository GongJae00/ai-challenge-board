export { cn } from "cn"

/** Whether a string, such as a URL parameter, is one of a closed set of values. */
export function isOneOf<T extends string>(
  values: readonly T[],
  value: string
): value is T {
  return (values as readonly string[]).includes(value)
}

/**
 * The `allowed` values found among `values`, such as the parts of a URL parameter, in the order of `allowed`.
 * Case does not matter, so that a link a messenger app lower-cased still finds "NeurIPS".
 */
export function pick<T extends string>(
  values: readonly string[],
  allowed: readonly T[]
): T[] {
  const lower = values.map((value) => value.toLowerCase())
  return allowed.filter((value) => isOneOf(lower, value.toLowerCase()))
}
