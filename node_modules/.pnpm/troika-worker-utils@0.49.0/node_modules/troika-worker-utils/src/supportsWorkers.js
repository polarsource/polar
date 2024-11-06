let supportsWorkers = () => {
  let supported = false

  // Only attempt worker initialization in browsers; elsewhere it would just be
  // noise e.g. loading into a Node environment for SSR.
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    try {
      // TODO additional checks for things like importScripts within the worker?
      //  Would need to be an async check.
      let worker = new Worker(
        URL.createObjectURL(new Blob([''], { type: 'application/javascript' }))
      )
      worker.terminate()
      supported = true
    } catch (err) {
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
        // No console log for node env 'test' (e.g. tests with Jest)
      } else {
        console.log(
          `Troika createWorkerModule: web workers not allowed; falling back to main thread execution. Cause: [${err.message}]`
        )
      }
    }
  }

  // Cached result
  supportsWorkers = () => supported
  return supported
}

export { supportsWorkers }
