import type { ErrorEvent } from '@sentry/nextjs'

const INJECTED_SCRIPTS = [
  /^app:\/\/\/executors\//,
  /^app:\/\/\/inpage\.js/,
  /^app:\/\/\/userscript\.html/,
  /^app:\/\/\/background\.bundle\.js/,
  /_injected[^/]*\.js/,
]

export const isInjectedScriptError = (event: ErrorEvent): boolean => {
  const frames =
    event.exception?.values?.flatMap(
      (value) => value.stacktrace?.frames ?? [],
    ) ?? []

  return (
    frames.length > 0 &&
    frames.every(({ filename }) =>
      INJECTED_SCRIPTS.some((pattern) => filename && pattern.test(filename)),
    )
  )
}
