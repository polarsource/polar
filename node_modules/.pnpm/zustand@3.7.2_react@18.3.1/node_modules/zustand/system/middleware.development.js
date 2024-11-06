System.register([], (function (exports) {
  'use strict';
  return {
    execute: (function () {

      exports('devtools', devtools);

      var __defProp$1 = Object.defineProperty;
      var __getOwnPropSymbols$1 = Object.getOwnPropertySymbols;
      var __hasOwnProp$1 = Object.prototype.hasOwnProperty;
      var __propIsEnum$1 = Object.prototype.propertyIsEnumerable;
      var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
      var __spreadValues$1 = (a, b) => {
        for (var prop in b || (b = {}))
          if (__hasOwnProp$1.call(b, prop))
            __defNormalProp$1(a, prop, b[prop]);
        if (__getOwnPropSymbols$1)
          for (var prop of __getOwnPropSymbols$1(b)) {
            if (__propIsEnum$1.call(b, prop))
              __defNormalProp$1(a, prop, b[prop]);
          }
        return a;
      };
      const redux = exports('redux', (reducer, initial) => (set, get, api) => {
        api.dispatch = (action) => {
          set((state) => reducer(state, action), false, action);
          return action;
        };
        api.dispatchFromDevtools = true;
        return __spreadValues$1({ dispatch: (...a) => api.dispatch(...a) }, initial);
      });

      function devtools(fn, options) {
        return (set, get, api) => {
          var _a;
          let didWarnAboutNameDeprecation = false;
          if (typeof options === "string" && !didWarnAboutNameDeprecation) {
            console.warn("[zustand devtools middleware]: passing `name` as directly will be not allowed in next majorpass the `name` in an object `{ name: ... }` instead");
            didWarnAboutNameDeprecation = true;
          }
          const devtoolsOptions = options === void 0 ? { name: void 0, anonymousActionType: void 0 } : typeof options === "string" ? { name: options } : options;
          if (typeof ((_a = devtoolsOptions == null ? void 0 : devtoolsOptions.serialize) == null ? void 0 : _a.options) !== "undefined") {
            console.warn("[zustand devtools middleware]: `serialize.options` is deprecated, just use `serialize`");
          }
          let extensionConnector;
          try {
            extensionConnector = window.__REDUX_DEVTOOLS_EXTENSION__ || window.top.__REDUX_DEVTOOLS_EXTENSION__;
          } catch {
          }
          if (!extensionConnector) {
            if (typeof window !== "undefined") {
              console.warn("[zustand devtools middleware] Please install/enable Redux devtools extension");
            }
            return fn(set, get, api);
          }
          let extension = Object.create(extensionConnector.connect(devtoolsOptions));
          let didWarnAboutDevtools = false;
          Object.defineProperty(api, "devtools", {
            get: () => {
              if (!didWarnAboutDevtools) {
                console.warn("[zustand devtools middleware] `devtools` property on the store is deprecated it will be removed in the next major.\nYou shouldn't interact with the extension directly. But in case you still want to you can patch `window.__REDUX_DEVTOOLS_EXTENSION__` directly");
                didWarnAboutDevtools = true;
              }
              return extension;
            },
            set: (value) => {
              if (!didWarnAboutDevtools) {
                console.warn("[zustand devtools middleware] `api.devtools` is deprecated, it will be removed in the next major.\nYou shouldn't interact with the extension directly. But in case you still want to you can patch `window.__REDUX_DEVTOOLS_EXTENSION__` directly");
                didWarnAboutDevtools = true;
              }
              extension = value;
            }
          });
          let didWarnAboutPrefix = false;
          Object.defineProperty(extension, "prefix", {
            get: () => {
              if (!didWarnAboutPrefix) {
                console.warn("[zustand devtools middleware] along with `api.devtools`, `api.devtools.prefix` is deprecated.\nWe no longer prefix the actions/names" + devtoolsOptions.name === void 0 ? ", pass the `name` option to create a separate instance of devtools for each store." : ", because the `name` option already creates a separate instance of devtools for each store.");
                didWarnAboutPrefix = true;
              }
              return "";
            },
            set: () => {
              if (!didWarnAboutPrefix) {
                console.warn("[zustand devtools middleware] along with `api.devtools`, `api.devtools.prefix` is deprecated.\nWe no longer prefix the actions/names" + devtoolsOptions.name === void 0 ? ", pass the `name` option to create a separate instance of devtools for each store." : ", because the `name` option already creates a separate instance of devtools for each store.");
                didWarnAboutPrefix = true;
              }
            }
          });
          let isRecording = true;
          api.setState = (state, replace, nameOrAction) => {
            set(state, replace);
            if (!isRecording)
              return;
            extension.send(nameOrAction === void 0 ? { type: devtoolsOptions.anonymousActionType || "anonymous" } : typeof nameOrAction === "string" ? { type: nameOrAction } : nameOrAction, get());
          };
          const setStateFromDevtools = (...a) => {
            const originalIsRecording = isRecording;
            isRecording = false;
            set(...a);
            isRecording = originalIsRecording;
          };
          const initialState = fn(api.setState, get, api);
          extension.init(initialState);
          if (api.dispatchFromDevtools && typeof api.dispatch === "function") {
            let didWarnAboutReservedActionType = false;
            const originalDispatch = api.dispatch;
            api.dispatch = (...a) => {
              if (a[0].type === "__setState" && !didWarnAboutReservedActionType) {
                console.warn('[zustand devtools middleware] "__setState" action type is reserved to set state from the devtools. Avoid using it.');
                didWarnAboutReservedActionType = true;
              }
              originalDispatch(...a);
            };
          }
          extension.subscribe((message) => {
            var _a2;
            switch (message.type) {
              case "ACTION":
                if (typeof message.payload !== "string") {
                  console.error("[zustand devtools middleware] Unsupported action format");
                  return;
                }
                return parseJsonThen(message.payload, (action) => {
                  if (action.type === "__setState") {
                    setStateFromDevtools(action.state);
                    return;
                  }
                  if (!api.dispatchFromDevtools)
                    return;
                  if (typeof api.dispatch !== "function")
                    return;
                  api.dispatch(action);
                });
              case "DISPATCH":
                switch (message.payload.type) {
                  case "RESET":
                    setStateFromDevtools(initialState);
                    return extension.init(api.getState());
                  case "COMMIT":
                    return extension.init(api.getState());
                  case "ROLLBACK":
                    return parseJsonThen(message.state, (state) => {
                      setStateFromDevtools(state);
                      extension.init(api.getState());
                    });
                  case "JUMP_TO_STATE":
                  case "JUMP_TO_ACTION":
                    return parseJsonThen(message.state, (state) => {
                      setStateFromDevtools(state);
                    });
                  case "IMPORT_STATE": {
                    const { nextLiftedState } = message.payload;
                    const lastComputedState = (_a2 = nextLiftedState.computedStates.slice(-1)[0]) == null ? void 0 : _a2.state;
                    if (!lastComputedState)
                      return;
                    setStateFromDevtools(lastComputedState);
                    extension.send(null, nextLiftedState);
                    return;
                  }
                  case "PAUSE_RECORDING":
                    return isRecording = !isRecording;
                }
                return;
            }
          });
          return initialState;
        };
      }
      const parseJsonThen = (stringified, f) => {
        let parsed;
        try {
          parsed = JSON.parse(stringified);
        } catch (e) {
          console.error("[zustand devtools middleware] Could not parse the received json", e);
        }
        if (parsed !== void 0)
          f(parsed);
      };

      const subscribeWithSelector = exports('subscribeWithSelector', (fn) => (set, get, api) => {
        const origSubscribe = api.subscribe;
        api.subscribe = (selector, optListener, options) => {
          let listener = selector;
          if (optListener) {
            const equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
            let currentSlice = selector(api.getState());
            listener = (state) => {
              const nextSlice = selector(state);
              if (!equalityFn(currentSlice, nextSlice)) {
                const previousSlice = currentSlice;
                optListener(currentSlice = nextSlice, previousSlice);
              }
            };
            if (options == null ? void 0 : options.fireImmediately) {
              optListener(currentSlice, currentSlice);
            }
          }
          return origSubscribe(listener);
        };
        const initialState = fn(set, get, api);
        return initialState;
      });

      const combine = exports('combine', (initialState, create) => (set, get, api) => Object.assign({}, initialState, create(set, get, api)));

      var __defProp = Object.defineProperty;
      var __getOwnPropSymbols = Object.getOwnPropertySymbols;
      var __hasOwnProp = Object.prototype.hasOwnProperty;
      var __propIsEnum = Object.prototype.propertyIsEnumerable;
      var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
      var __spreadValues = (a, b) => {
        for (var prop in b || (b = {}))
          if (__hasOwnProp.call(b, prop))
            __defNormalProp(a, prop, b[prop]);
        if (__getOwnPropSymbols)
          for (var prop of __getOwnPropSymbols(b)) {
            if (__propIsEnum.call(b, prop))
              __defNormalProp(a, prop, b[prop]);
          }
        return a;
      };
      const toThenable = (fn) => (input) => {
        try {
          const result = fn(input);
          if (result instanceof Promise) {
            return result;
          }
          return {
            then(onFulfilled) {
              return toThenable(onFulfilled)(result);
            },
            catch(_onRejected) {
              return this;
            }
          };
        } catch (e) {
          return {
            then(_onFulfilled) {
              return this;
            },
            catch(onRejected) {
              return toThenable(onRejected)(e);
            }
          };
        }
      };
      const persist = exports('persist', (config, baseOptions) => (set, get, api) => {
        let options = __spreadValues({
          getStorage: () => localStorage,
          serialize: JSON.stringify,
          deserialize: JSON.parse,
          partialize: (state) => state,
          version: 0,
          merge: (persistedState, currentState) => __spreadValues(__spreadValues({}, currentState), persistedState)
        }, baseOptions);
        if (options.blacklist || options.whitelist) {
          console.warn(`The ${options.blacklist ? "blacklist" : "whitelist"} option is deprecated and will be removed in the next version. Please use the 'partialize' option instead.`);
        }
        let hasHydrated = false;
        const hydrationListeners = /* @__PURE__ */ new Set();
        const finishHydrationListeners = /* @__PURE__ */ new Set();
        let storage;
        try {
          storage = options.getStorage();
        } catch (e) {
        }
        if (!storage) {
          return config((...args) => {
            console.warn(`[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`);
            set(...args);
          }, get, api);
        } else if (!storage.removeItem) {
          console.warn(`[zustand persist middleware] The given storage for item '${options.name}' does not contain a 'removeItem' method, which will be required in v4.`);
        }
        const thenableSerialize = toThenable(options.serialize);
        const setItem = () => {
          const state = options.partialize(__spreadValues({}, get()));
          if (options.whitelist) {
            Object.keys(state).forEach((key) => {
              var _a;
              !((_a = options.whitelist) == null ? void 0 : _a.includes(key)) && delete state[key];
            });
          }
          if (options.blacklist) {
            options.blacklist.forEach((key) => delete state[key]);
          }
          let errorInSync;
          const thenable = thenableSerialize({ state, version: options.version }).then((serializedValue) => storage.setItem(options.name, serializedValue)).catch((e) => {
            errorInSync = e;
          });
          if (errorInSync) {
            throw errorInSync;
          }
          return thenable;
        };
        const savedSetState = api.setState;
        api.setState = (state, replace) => {
          savedSetState(state, replace);
          void setItem();
        };
        const configResult = config((...args) => {
          set(...args);
          void setItem();
        }, get, api);
        let stateFromStorage;
        const hydrate = () => {
          var _a;
          if (!storage)
            return;
          hasHydrated = false;
          hydrationListeners.forEach((cb) => cb(get()));
          const postRehydrationCallback = ((_a = options.onRehydrateStorage) == null ? void 0 : _a.call(options, get())) || void 0;
          return toThenable(storage.getItem.bind(storage))(options.name).then((storageValue) => {
            if (storageValue) {
              return options.deserialize(storageValue);
            }
          }).then((deserializedStorageValue) => {
            if (deserializedStorageValue) {
              if (typeof deserializedStorageValue.version === "number" && deserializedStorageValue.version !== options.version) {
                if (options.migrate) {
                  return options.migrate(deserializedStorageValue.state, deserializedStorageValue.version);
                }
                console.error(`State loaded from storage couldn't be migrated since no migrate function was provided`);
              } else {
                return deserializedStorageValue.state;
              }
            }
          }).then((migratedState) => {
            var _a2;
            stateFromStorage = options.merge(migratedState, (_a2 = get()) != null ? _a2 : configResult);
            set(stateFromStorage, true);
            return setItem();
          }).then(() => {
            postRehydrationCallback == null ? void 0 : postRehydrationCallback(stateFromStorage, void 0);
            hasHydrated = true;
            finishHydrationListeners.forEach((cb) => cb(stateFromStorage));
          }).catch((e) => {
            postRehydrationCallback == null ? void 0 : postRehydrationCallback(void 0, e);
          });
        };
        api.persist = {
          setOptions: (newOptions) => {
            options = __spreadValues(__spreadValues({}, options), newOptions);
            if (newOptions.getStorage) {
              storage = newOptions.getStorage();
            }
          },
          clearStorage: () => {
            var _a;
            (_a = storage == null ? void 0 : storage.removeItem) == null ? void 0 : _a.call(storage, options.name);
          },
          rehydrate: () => hydrate(),
          hasHydrated: () => hasHydrated,
          onHydrate: (cb) => {
            hydrationListeners.add(cb);
            return () => {
              hydrationListeners.delete(cb);
            };
          },
          onFinishHydration: (cb) => {
            finishHydrationListeners.add(cb);
            return () => {
              finishHydrationListeners.delete(cb);
            };
          }
        };
        hydrate();
        return stateFromStorage || configResult;
      });

    })
  };
}));
