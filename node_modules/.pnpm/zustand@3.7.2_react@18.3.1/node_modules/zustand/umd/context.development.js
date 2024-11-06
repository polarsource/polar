(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.zustandContext = {}, global.React));
})(this, (function (exports, react) { 'use strict';

  function createContext() {
    var ZustandContext = react.createContext(undefined);

    var Provider = function Provider(_ref) {
      var initialStore = _ref.initialStore,
          createStore = _ref.createStore,
          children = _ref.children;
      var storeRef = react.useRef();

      if (!storeRef.current) {
        if (initialStore) {
          console.warn('Provider initialStore is deprecated and will be removed in the next version.');

          if (!createStore) {
            createStore = function createStore() {
              return initialStore;
            };
          }
        }

        storeRef.current = createStore();
      }

      return react.createElement(ZustandContext.Provider, {
        value: storeRef.current
      }, children);
    };

    var useStore = function useStore(selector, equalityFn) {
      if (equalityFn === void 0) {
        equalityFn = Object.is;
      }

      var useProviderStore = react.useContext(ZustandContext);

      if (!useProviderStore) {
        throw new Error('Seems like you have not used zustand provider as an ancestor.');
      }

      return useProviderStore(selector, equalityFn);
    };

    var useStoreApi = function useStoreApi() {
      var useProviderStore = react.useContext(ZustandContext);

      if (!useProviderStore) {
        throw new Error('Seems like you have not used zustand provider as an ancestor.');
      }

      return react.useMemo(function () {
        return {
          getState: useProviderStore.getState,
          setState: useProviderStore.setState,
          subscribe: useProviderStore.subscribe,
          destroy: useProviderStore.destroy
        };
      }, [useProviderStore]);
    };

    return {
      Provider: Provider,
      useStore: useStore,
      useStoreApi: useStoreApi
    };
  }

  exports["default"] = createContext;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
