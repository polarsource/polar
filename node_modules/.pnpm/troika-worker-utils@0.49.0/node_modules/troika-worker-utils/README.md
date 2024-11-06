# `troika-worker-utils`

This package provides utilities for making Web Workers easier to use.


## Worker Modules

Troika's "Worker Modules" system, exposed by the `defineWorkerModule` export, allows you to define a function that will be executed with a web worker. This provides a simple interface for moving chunks of logic off the main thread, which can be critical in WebGL/WebXR scenes where frame rate cannot be interrupted by long-running code.

Similar utilities like [Greenlet](https://github.com/developit/greenlet) have existed for a while. However, `defineWorkerModule` introduces the ability for worker modules to _depend on one another_. This means you can define modular chunks of code in separate functions, and then inject them into a worker where they can reference and call each other.

### `defineWorkerModule(options)`

This function defines a Worker Module. It takes an `options` object that can contain the following:

#### options.init

Required. This is the main function that initializes the module; it will be executed within the Worker the first time it is invoked. If any `dependencies` are defined, the resolved values of those dependencies will be passed in as arguments.

Its return value becomes the module's "value". That can be:

- A function, which can be called any number of times from the main thread by calling the function returned from `defineWorkerModule()`.

- Any other value, which will be used as the value passed to the `init` of other worker modules using it as a dependency.

> Note: As with any function-in-worker utility, the `init` function must not use any variables from the parent closure in which it is defined; its internal content must be completely standalone. Any external values you want to use must be passed in as `dependencies`.

#### options.dependencies

An optional array of dependencies required by the init function. Dependencies can be:

- Primitives like strings, numbers, booleans

- Functions; these will be stringified and rehydrated within the worker so they must not depend on anything from their parent closures

- Other worker modules created by `defineWorkerModule`; these will be resolved within the worker, and therefore modules that provide functions can be called without having to cross the worker/main thread boundary.

#### options.getTransferables

An optional function that will be run in the worker just before posting the response value from a module call back to the main thread. This function will be passed that response value, and if it returns an array then that will be used as the "transferables" parameter to `postMessage`. Use this if there are values in the response that can/should be transfered rather than cloned.

#### options.name

An optional descriptive name for this module; this can be useful for debugging (it will be inserted as a comment into the Blob sent to the worker) but is not currently used for anything else.

#### options.workerId

By default all modules will run in the same dedicated worker, but if you want to use multiple workers you can pass a `workerId` string to indicate a specific worker to spawn. Note that each worker is completely standalone and no data or state will be shared between them. If a worker module is used as a dependency by worker modules using different `workerId`s, then that dependency will be re-registered in each worker.

#### Return Value

The value returned by `defineWorkerModule` is a function. If your `options.init` returned a function, then this will be how you can invoke that within the worker. Call it, and it will give you a Promise for its return value.

### Contrived Example

```js
import { defineWorkerModule } from 'troika-worker-utils'

// A simple module with a value:
const workerModuleA = defineWorkerModule({
  init: function() {
    return Math.PI
  }
})

// A module that depends on the previous module:
const workerModuleB = defineWorkerModule({
  dependencies: [
    workerModuleA
  ],
  init: function(moduleAValue) {
    // moduleAValue here is "I'm the value of Module A!" from the first init function
    
    // This return function can be invoked by calling workerModuleB in the main thread:
    let callCount = 0
    return function(arg) {
      return `Called module B ${++callCount} times, ` 
        + `with arg "${arg}". Module A's value was ${moduleAValue}.`
    }
  }
})

workerModuleB('foo') // "Called module B 1 times, with arg "foo". Module A's value was 3.141592653589793."
workerModuleB('bar') // "Called module B 2 times, with arg "bar". Module A's value was 3.141592653589793."
```
