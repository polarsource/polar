/**
 * Fallback for `defineWorkerModule` that behaves identically but runs in the main
 * thread, for when the execution environment doesn't support web workers or they
 * are disallowed due to e.g. CSP security restrictions.
 */
export function defineMainThreadModule(options) {
  let moduleFunc = function(...args) {
    return moduleFunc._getInitResult().then(initResult => {
      if (typeof initResult === 'function') {
        return initResult(...args)
      } else {
        throw new Error('Worker module function was called but `init` did not return a callable function')
      }
    })
  }
  moduleFunc._getInitResult = function() {
    // We can ignore getTransferables in main thread. TODO workerId?
    let {dependencies, init} = options

    // Resolve dependencies
    dependencies = Array.isArray(dependencies) ? dependencies.map(dep =>
      dep && dep._getInitResult ? dep._getInitResult() : dep
    ) : []

    // Invoke init with the resolved dependencies
    let initPromise = Promise.all(dependencies).then(deps => {
      return init.apply(null, deps)
    })

    // Cache the resolved promise for subsequent calls
    moduleFunc._getInitResult = () => initPromise

    return initPromise
  }
  return moduleFunc
}
