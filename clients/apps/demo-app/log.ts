export const log = Object.assign(
  (...args: unknown[]) => {
    console.log(`[${performance.now().toFixed(2)}ms]`, ...args)
  },
  {
    start(label: string) {
      const startedAt = performance.now()
      let duration: number | undefined

      log(`${label}: start`)

      return {
        log(...args: unknown[]) {
          log(
            `[${label} +${(performance.now() - startedAt).toFixed(2)}ms]`,
            ...args,
          )
        },
        end(...args: unknown[]) {
          if (duration === undefined) {
            duration = performance.now() - startedAt
            log(`${label}: end (${duration.toFixed(2)}ms)`, ...args)
          }

          return duration
        },
      }
    },
  },
)
