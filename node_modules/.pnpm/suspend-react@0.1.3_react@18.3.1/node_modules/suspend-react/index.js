const isPromise = promise => typeof promise === 'object' && typeof promise.then === 'function';

const globalCache = [];

function shallowEqualArrays(arrA, arrB, equal = (a, b) => a === b) {
  if (arrA === arrB) return true;
  if (!arrA || !arrB) return false;
  const len = arrA.length;
  if (arrB.length !== len) return false;

  for (let i = 0; i < len; i++) if (!equal(arrA[i], arrB[i])) return false;

  return true;
}

function query(fn, keys = null, preload = false, config = {}) {
  // If no keys were given, the function is the key
  if (keys === null) keys = [fn];

  for (const entry of globalCache) {
    // Find a match
    if (shallowEqualArrays(keys, entry.keys, entry.equal)) {
      // If we're pre-loading and the element is present, just return
      if (preload) return undefined; // If an error occurred, throw

      if (Object.prototype.hasOwnProperty.call(entry, 'error')) throw entry.error; // If a response was successful, return

      if (Object.prototype.hasOwnProperty.call(entry, 'response')) {
        if (config.lifespan && config.lifespan > 0) {
          if (entry.timeout) clearTimeout(entry.timeout);
          entry.timeout = setTimeout(entry.remove, config.lifespan);
        }

        return entry.response;
      } // If the promise is still unresolved, throw


      if (!preload) throw entry.promise;
    }
  } // The request is new or has changed.


  const entry = {
    keys,
    equal: config.equal,
    remove: () => {
      const index = globalCache.indexOf(entry);
      if (index !== -1) globalCache.splice(index, 1);
    },
    promise: // Execute the promise
    (isPromise(fn) ? fn : fn(...keys) // When it resolves, store its value
    ).then(response => {
      entry.response = response; // Remove the entry in time if a lifespan was given

      if (config.lifespan && config.lifespan > 0) {
        entry.timeout = setTimeout(entry.remove, config.lifespan);
      }
    }) // Store caught errors, they will be thrown in the render-phase to bubble into an error-bound
    .catch(error => entry.error = error)
  }; // Register the entry

  globalCache.push(entry); // And throw the promise, this yields control back to React

  if (!preload) throw entry.promise;
  return undefined;
}

const suspend = (fn, keys, config) => query(fn, keys, false, config);

const preload = (fn, keys, config) => void query(fn, keys, true, config);

const peek = keys => {
  var _globalCache$find;

  return (_globalCache$find = globalCache.find(entry => shallowEqualArrays(keys, entry.keys, entry.equal))) == null ? void 0 : _globalCache$find.response;
};

const clear = keys => {
  if (keys === undefined || keys.length === 0) globalCache.splice(0, globalCache.length);else {
    const entry = globalCache.find(entry => shallowEqualArrays(keys, entry.keys, entry.equal));
    if (entry) entry.remove();
  }
};

export { clear, peek, preload, suspend };
