(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.zustandMiddleware = {}));
})(this, (function (exports) { 'use strict';

  function _extends() {
    _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];

        for (var key in source) {
          if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }

      return target;
    };

    return _extends.apply(this, arguments);
  }

  var redux = function redux(reducer, initial) {
    return function (set, get, api) {
      api.dispatch = function (action) {
        set(function (state) {
          return reducer(state, action);
        }, false, action);
        return action;
      };

      api.dispatchFromDevtools = true;
      return _extends({
        dispatch: function dispatch() {
          return api.dispatch.apply(api, arguments);
        }
      }, initial);
    };
  };

  function devtools(fn, options) {
    return function (set, get, api) {
      var _serialize;

      var didWarnAboutNameDeprecation = false;

      if (typeof options === 'string' && !didWarnAboutNameDeprecation) {
        console.warn('[zustand devtools middleware]: passing `name` as directly will be not allowed in next major' + 'pass the `name` in an object `{ name: ... }` instead');
        didWarnAboutNameDeprecation = true;
      }

      var devtoolsOptions = options === undefined ? {
        name: undefined,
        anonymousActionType: undefined
      } : typeof options === 'string' ? {
        name: options
      } : options;

      if (typeof (devtoolsOptions == null ? void 0 : (_serialize = devtoolsOptions.serialize) == null ? void 0 : _serialize.options) !== 'undefined') {
        console.warn('[zustand devtools middleware]: `serialize.options` is deprecated, just use `serialize`');
      }

      var extensionConnector;

      try {
        extensionConnector = window.__REDUX_DEVTOOLS_EXTENSION__ || window.top.__REDUX_DEVTOOLS_EXTENSION__;
      } catch (_unused) {}

      if (!extensionConnector) {
        if (typeof window !== 'undefined') {
          console.warn('[zustand devtools middleware] Please install/enable Redux devtools extension');
        }

        return fn(set, get, api);
      }

      var extension = Object.create(extensionConnector.connect(devtoolsOptions));
      var didWarnAboutDevtools = false;
      Object.defineProperty(api, 'devtools', {
        get: function get() {
          if (!didWarnAboutDevtools) {
            console.warn('[zustand devtools middleware] `devtools` property on the store is deprecated ' + 'it will be removed in the next major.\n' + "You shouldn't interact with the extension directly. But in case you still want to " + 'you can patch `window.__REDUX_DEVTOOLS_EXTENSION__` directly');
            didWarnAboutDevtools = true;
          }

          return extension;
        },
        set: function set(value) {
          if (!didWarnAboutDevtools) {
            console.warn('[zustand devtools middleware] `api.devtools` is deprecated, ' + 'it will be removed in the next major.\n' + "You shouldn't interact with the extension directly. But in case you still want to " + 'you can patch `window.__REDUX_DEVTOOLS_EXTENSION__` directly');
            didWarnAboutDevtools = true;
          }

          extension = value;
        }
      });
      var didWarnAboutPrefix = false;
      Object.defineProperty(extension, 'prefix', {
        get: function get() {
          if (!didWarnAboutPrefix) {
            console.warn('[zustand devtools middleware] along with `api.devtools`, `api.devtools.prefix` is deprecated.\n' + 'We no longer prefix the actions/names' + devtoolsOptions.name === undefined ? ', pass the `name` option to create a separate instance of devtools for each store.' : ', because the `name` option already creates a separate instance of devtools for each store.');
            didWarnAboutPrefix = true;
          }

          return '';
        },
        set: function set() {
          if (!didWarnAboutPrefix) {
            console.warn('[zustand devtools middleware] along with `api.devtools`, `api.devtools.prefix` is deprecated.\n' + 'We no longer prefix the actions/names' + devtoolsOptions.name === undefined ? ', pass the `name` option to create a separate instance of devtools for each store.' : ', because the `name` option already creates a separate instance of devtools for each store.');
            didWarnAboutPrefix = true;
          }
        }
      });
      var isRecording = true;

      api.setState = function (state, replace, nameOrAction) {
        set(state, replace);
        if (!isRecording) return;
        extension.send(nameOrAction === undefined ? {
          type: devtoolsOptions.anonymousActionType || 'anonymous'
        } : typeof nameOrAction === 'string' ? {
          type: nameOrAction
        } : nameOrAction, get());
      };

      var setStateFromDevtools = function setStateFromDevtools() {
        var originalIsRecording = isRecording;
        isRecording = false;
        set.apply(void 0, arguments);
        isRecording = originalIsRecording;
      };

      var initialState = fn(api.setState, get, api);
      extension.init(initialState);

      if (api.dispatchFromDevtools && typeof api.dispatch === 'function') {
        var didWarnAboutReservedActionType = false;
        var originalDispatch = api.dispatch;

        api.dispatch = function () {
          for (var _len = arguments.length, a = new Array(_len), _key = 0; _key < _len; _key++) {
            a[_key] = arguments[_key];
          }

          if (a[0].type === '__setState' && !didWarnAboutReservedActionType) {
            console.warn('[zustand devtools middleware] "__setState" action type is reserved ' + 'to set state from the devtools. Avoid using it.');
            didWarnAboutReservedActionType = true;
          }
          originalDispatch.apply(void 0, a);
        };
      }

      extension.subscribe(function (message) {
        switch (message.type) {
          case 'ACTION':
            if (typeof message.payload !== 'string') {
              console.error('[zustand devtools middleware] Unsupported action format');
              return;
            }

            return parseJsonThen(message.payload, function (action) {
              if (action.type === '__setState') {
                setStateFromDevtools(action.state);
                return;
              }

              if (!api.dispatchFromDevtools) return;
              if (typeof api.dispatch !== 'function') return;
              api.dispatch(action);
            });

          case 'DISPATCH':
            switch (message.payload.type) {
              case 'RESET':
                setStateFromDevtools(initialState);
                return extension.init(api.getState());

              case 'COMMIT':
                return extension.init(api.getState());

              case 'ROLLBACK':
                return parseJsonThen(message.state, function (state) {
                  setStateFromDevtools(state);
                  extension.init(api.getState());
                });

              case 'JUMP_TO_STATE':
              case 'JUMP_TO_ACTION':
                return parseJsonThen(message.state, function (state) {
                  setStateFromDevtools(state);
                });

              case 'IMPORT_STATE':
                {
                  var _nextLiftedState$comp;

                  var nextLiftedState = message.payload.nextLiftedState;
                  var lastComputedState = (_nextLiftedState$comp = nextLiftedState.computedStates.slice(-1)[0]) == null ? void 0 : _nextLiftedState$comp.state;
                  if (!lastComputedState) return;
                  setStateFromDevtools(lastComputedState);
                  extension.send(null, nextLiftedState);
                  return;
                }

              case 'PAUSE_RECORDING':
                return isRecording = !isRecording;
            }

            return;
        }
      });
      return initialState;
    };
  }

  var parseJsonThen = function parseJsonThen(stringified, f) {
    var parsed;

    try {
      parsed = JSON.parse(stringified);
    } catch (e) {
      console.error('[zustand devtools middleware] Could not parse the received json', e);
    }

    if (parsed !== undefined) f(parsed);
  };

  var subscribeWithSelector = function subscribeWithSelector(fn) {
    return function (set, get, api) {
      var origSubscribe = api.subscribe;

      api.subscribe = function (selector, optListener, options) {
        var listener = selector;

        if (optListener) {
          var equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
          var currentSlice = selector(api.getState());

          listener = function listener(state) {
            var nextSlice = selector(state);

            if (!equalityFn(currentSlice, nextSlice)) {
              var previousSlice = currentSlice;
              optListener(currentSlice = nextSlice, previousSlice);
            }
          };

          if (options != null && options.fireImmediately) {
            optListener(currentSlice, currentSlice);
          }
        }

        return origSubscribe(listener);
      };

      var initialState = fn(set, get, api);
      return initialState;
    };
  };

  var combine = function combine(initialState, create) {
    return function (set, get, api) {
      return Object.assign({}, initialState, create(set, get, api));
    };
  };

  var toThenable = function toThenable(fn) {
    return function (input) {
      try {
        var result = fn(input);

        if (result instanceof Promise) {
          return result;
        }

        return {
          then: function then(onFulfilled) {
            return toThenable(onFulfilled)(result);
          },
          catch: function _catch(_onRejected) {
            return this;
          }
        };
      } catch (e) {
        return {
          then: function then(_onFulfilled) {
            return this;
          },
          catch: function _catch(onRejected) {
            return toThenable(onRejected)(e);
          }
        };
      }
    };
  };

  var persist = function persist(config, baseOptions) {
    return function (set, get, api) {
      var options = _extends({
        getStorage: function getStorage() {
          return localStorage;
        },
        serialize: JSON.stringify,
        deserialize: JSON.parse,
        partialize: function partialize(state) {
          return state;
        },
        version: 0,
        merge: function merge(persistedState, currentState) {
          return _extends({}, currentState, persistedState);
        }
      }, baseOptions);

      if (options.blacklist || options.whitelist) {
        console.warn("The " + (options.blacklist ? 'blacklist' : 'whitelist') + " option is deprecated and will be removed in the next version. Please use the 'partialize' option instead.");
      }

      var _hasHydrated = false;
      var hydrationListeners = new Set();
      var finishHydrationListeners = new Set();
      var storage;

      try {
        storage = options.getStorage();
      } catch (e) {}

      if (!storage) {
        return config(function () {
          console.warn("[zustand persist middleware] Unable to update item '" + options.name + "', the given storage is currently unavailable.");
          set.apply(void 0, arguments);
        }, get, api);
      } else if (!storage.removeItem) {
        console.warn("[zustand persist middleware] The given storage for item '" + options.name + "' does not contain a 'removeItem' method, which will be required in v4.");
      }

      var thenableSerialize = toThenable(options.serialize);

      var setItem = function setItem() {
        var state = options.partialize(_extends({}, get()));

        if (options.whitelist) {
          Object.keys(state).forEach(function (key) {
            var _options$whitelist;

            !((_options$whitelist = options.whitelist) != null && _options$whitelist.includes(key)) && delete state[key];
          });
        }

        if (options.blacklist) {
          options.blacklist.forEach(function (key) {
            return delete state[key];
          });
        }

        var errorInSync;
        var thenable = thenableSerialize({
          state: state,
          version: options.version
        }).then(function (serializedValue) {
          return storage.setItem(options.name, serializedValue);
        }).catch(function (e) {
          errorInSync = e;
        });

        if (errorInSync) {
          throw errorInSync;
        }

        return thenable;
      };

      var savedSetState = api.setState;

      api.setState = function (state, replace) {
        savedSetState(state, replace);
        void setItem();
      };

      var configResult = config(function () {
        set.apply(void 0, arguments);
        void setItem();
      }, get, api);
      var stateFromStorage;

      var hydrate = function hydrate() {
        if (!storage) return;
        _hasHydrated = false;
        hydrationListeners.forEach(function (cb) {
          return cb(get());
        });
        var postRehydrationCallback = (options.onRehydrateStorage == null ? void 0 : options.onRehydrateStorage(get())) || undefined;
        return toThenable(storage.getItem.bind(storage))(options.name).then(function (storageValue) {
          if (storageValue) {
            return options.deserialize(storageValue);
          }
        }).then(function (deserializedStorageValue) {
          if (deserializedStorageValue) {
            if (typeof deserializedStorageValue.version === 'number' && deserializedStorageValue.version !== options.version) {
              if (options.migrate) {
                return options.migrate(deserializedStorageValue.state, deserializedStorageValue.version);
              }

              console.error("State loaded from storage couldn't be migrated since no migrate function was provided");
            } else {
              return deserializedStorageValue.state;
            }
          }
        }).then(function (migratedState) {
          var _get;

          stateFromStorage = options.merge(migratedState, (_get = get()) != null ? _get : configResult);
          set(stateFromStorage, true);
          return setItem();
        }).then(function () {
          postRehydrationCallback == null ? void 0 : postRehydrationCallback(stateFromStorage, undefined);
          _hasHydrated = true;
          finishHydrationListeners.forEach(function (cb) {
            return cb(stateFromStorage);
          });
        }).catch(function (e) {
          postRehydrationCallback == null ? void 0 : postRehydrationCallback(undefined, e);
        });
      };

      api.persist = {
        setOptions: function setOptions(newOptions) {
          options = _extends({}, options, newOptions);

          if (newOptions.getStorage) {
            storage = newOptions.getStorage();
          }
        },
        clearStorage: function clearStorage() {
          var _storage;

          (_storage = storage) == null ? void 0 : _storage.removeItem == null ? void 0 : _storage.removeItem(options.name);
        },
        rehydrate: function rehydrate() {
          return hydrate();
        },
        hasHydrated: function hasHydrated() {
          return _hasHydrated;
        },
        onHydrate: function onHydrate(cb) {
          hydrationListeners.add(cb);
          return function () {
            hydrationListeners.delete(cb);
          };
        },
        onFinishHydration: function onFinishHydration(cb) {
          finishHydrationListeners.add(cb);
          return function () {
            finishHydrationListeners.delete(cb);
          };
        }
      };
      hydrate();
      return stateFromStorage || configResult;
    };
  };

  exports.combine = combine;
  exports.devtools = devtools;
  exports.persist = persist;
  exports.redux = redux;
  exports.subscribeWithSelector = subscribeWithSelector;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
