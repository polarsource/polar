/*global require,global,_testDataBucket*/

require('./_jsdom-worker.js')
const {defineWorkerModule} = require('../src/WorkerModules.js')

beforeEach(() => {
  // Functions that are run in the worker can place breadcrumbs in this object that
  // `expect` matchers can then retrieve and test later on.
  global._testDataBucket = {}
})



test('requires an `options` argument', () => {
  expect(() => {
    defineWorkerModule()
  }).toThrow()
})

test('requires an `init` function option', () => {
  expect(() => {
    defineWorkerModule({notInit: 'blerp'})
  }).toThrow()
  expect(() => {
    defineWorkerModule({init: 'not_a_function'})
  }).toThrow()
  expect(() => {
    defineWorkerModule({init: () => {}})
  }).not.toThrow()
})

test('returns a function', () => {
  expect(typeof defineWorkerModule({init: () => {}})).toBe('function')
})

describe('calling the module function', () => {
  test('throws if init did not return a function', () => {
    const moduleFn = defineWorkerModule({
      init: function() {
        return 'not a function'
      }
    })
    return expect(moduleFn()).rejects.toThrow()
  })

  test('does not throw if init returns a function', () => {
    const moduleFn = defineWorkerModule({
      init: function() {
        return function() {}
      }
    })
    return expect(moduleFn()).resolves.toBe(undefined)
  })

  test('returns a thenable', () => {
    const moduleFn = defineWorkerModule({
      init: function() {return function() {}}
    })
    expect(moduleFn()).toEqual(expect.objectContaining({then: expect.any(Function)}))
  })

  test('invokes (a clone of) the init function', function() {
    const moduleFn = defineWorkerModule({
      init: function() {
        _testDataBucket.initWasCalled = true
        return function() {}
      }
    })
    return moduleFn().then(() => {
      expect(_testDataBucket.initWasCalled).toBe(true)
    })
  })

  test('invokes a function returned by the init function and resolves the thenable with its return value', () => {
    const moduleFn = defineWorkerModule({
      init: function() {
        return function() {
          _testDataBucket.initReturnFnWasCalled = true
          return 'this is the return value'
        }
      }
    })
    return moduleFn().then((result) => {
      expect(_testDataBucket.initReturnFnWasCalled).toBe(true)
      expect(result).toEqual('this is the return value')
    })
  })

  test('waits for a thenable returned by the init function', () => {
    const moduleFn = defineWorkerModule({
      init: function() {
        return function() {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve('promise resolution value')
            }, 50)
          })
        }
      }
    })
    return moduleFn().then((result) => {
      expect(result).toEqual('promise resolution value')
    })
  })

  test('throws if the init function throws', () => {
    const moduleFn = defineWorkerModule({
      init: function() {
        const err = new Error('blerp')
        err.noLog = true
        throw err
      }
    })
    return expect(moduleFn()).rejects.toThrow()
  })
})

describe('dependencies', () => {
  test('are passed to the init function', () => {
    const moduleFn = defineWorkerModule({
      dependencies: [
        1,
        true,
        'three'
      ],
      init: function(one, two, three) {
        expect(one).toBe(1)
        expect(two).toBe(true)
        expect(three).toBe('three')
        return function() {}
      }
    })
    return moduleFn()
  })

  test('can be functions', () => {
    const moduleFn = defineWorkerModule({
      dependencies: [
        function() {
          _testDataBucket.firstDepFnCalled = true
        },
        function(arg1, arg2) {
          _testDataBucket.secondDepFnArgs = [arg1, arg2]
        }
      ],
      init: function(dep1, dep2) {
        expect(typeof dep1).toBe('function')
        expect(typeof dep2).toBe('function')
        dep1()
        dep2('hey', 'jude')
        return function() {}
      }
    })
    return moduleFn().then(() => {
      expect(_testDataBucket.firstDepFnCalled).toBe(true)
      expect(_testDataBucket.secondDepFnArgs).toEqual(['hey', 'jude'])
    })
  })

  test('can be other worker modules', () => {
    const depMod1 = defineWorkerModule({
      dependencies: [123, 456],
      init: function(n1, n2) {
        return n1 + n2
      }
    })
    const depMod2 = defineWorkerModule({
      dependencies: ['abc', 'xyz'],
      init: function(s1, s2) {
        return s2 + s1
      }
    })
    const depMod3 = defineWorkerModule({
      dependencies: [depMod1, depMod2],
      init: function(d1, d2) {
        return d1 + d2
      }
    })

    const moduleFn = defineWorkerModule({
      dependencies: [
        depMod1,
        depMod2,
        depMod3
      ],
      init: function(dep1, dep2, dep3) {
        expect(dep1).toEqual(579)
        expect(dep2).toEqual('xyzabc')
        expect(dep3).toEqual('579xyzabc')
        return function() {
          return [dep1, dep2, dep3]
        }
      }
    })
    return moduleFn().then((result) => {
      expect(result).toEqual([579, 'xyzabc', '579xyzabc'])
    })
  })
})


describe('getTransferables', () => {
  test('is called before result is sent to main thread', () => {
    _testDataBucket.callOrder = []

    const moduleFn = defineWorkerModule({
      init: function() {
        _testDataBucket.callOrder.push('init')
        return function() {
          _testDataBucket.callOrder.push('module')
          return {data: new Uint8Array(32)}
        }
      },
      getTransferables: function (result) {
        _testDataBucket.callOrder.push('getTransferables')
        return result.data
      }
    })

    return moduleFn().then(() => {
      _testDataBucket.callOrder.push('response')
    }).then(() => {
      expect(_testDataBucket.callOrder).toEqual(['init', 'module', 'getTransferables', 'response'])
    })
  })

  test('is called with the module return value as param', () => {
    const moduleFn = defineWorkerModule({
      init: function() {
        return function() {
          return {data: new Uint8Array(32)}
        }
      },
      getTransferables: function (result) {
        _testDataBucket.getTransferablesParam = result
        return result.data
      }
    })

    return moduleFn().then(() => {
      expect(_testDataBucket.getTransferablesParam).toEqual({data: expect.any(Uint8Array)})
    })
  })

  // TODO not working yet, see comment below
  test.skip('its return value is used as the `transferables` in postMessage', () => {
    const moduleFn = defineWorkerModule({
      init: function() {
        // Hack: override the worker's postMessage with one we can spy on
        // TODO this doesn't work, because `init` is invoked in the worker's global scope but
        // the WorkerModule framework code (that calls postMessage) is wrapped in a narrower
        // scope by the jsdom-worker polyfill. Will need to find a way around that before this
        // test can work.
        const _origPostMessage = postMessage
        // eslint-disable-next-line no-global-assign
        postMessage = function(e, transferList) {
          _testDataBucket.postMessageTransferList = transferList
          _origPostMessage(e)
        }

        return function() {
          return {data: new Uint8Array(32)}
        }
      },
      getTransferables: function (result) {
        return [result.data]
      }
    })

    return moduleFn().then(() => {
      expect(_testDataBucket.postMessageTransferList).toEqual([expect.any(Uint8Array)])
    })
  })
})

describe('multiple workers', () => {
  test('different `workerId`s execute in different workers', () => {

    const commonDep = defineWorkerModule({
      init: function() {
        return Math.random() //give a unique value per worker
      }
    })

    // 1a and 1b share a worker so their dependency should init with the same value;
    // 2 is a different worker so the dependency should init with a different value.
    const module1a = defineWorkerModule({
      workerId: 'worker1',
      dependencies: [commonDep],
      init: function(depVal) {
        return () => depVal
      }
    })
    const module1b = defineWorkerModule({
      workerId: 'worker1',
      dependencies: [commonDep],
      init: function(depVal) {
        return () => depVal
      }
    })
    const module2 = defineWorkerModule({
      workerId: 'worker2',
      dependencies: [commonDep],
      init: function(depVal) {
        return () => depVal
      }
    })
    const module3 = defineWorkerModule({
      workerId: null, //default worker
      dependencies: [commonDep],
      init: function(depVal) {
        return () => depVal
      }
    })

    return Promise.all([module1a(), module1b(), module2(), module3()]).then(([result1a, result1b, result2, result3]) => {
      expect(typeof result1a).toEqual('number')
      expect(typeof result1b).toEqual('number')
      expect(typeof result2).toEqual('number')
      expect(typeof result3).toEqual('number')
      expect(result1a).toEqual(result1b)
      expect(result2).not.toEqual(result1a)
      expect(result3).not.toEqual(result1a)
      expect(result3).not.toEqual(result2)
    })
  })
})
