System.register(['react'], (function (exports) {
  'use strict';
  var createContext$1, useRef, createElement, useContext, useMemo;
  return {
    setters: [function (module) {
      createContext$1 = module.createContext;
      useRef = module.useRef;
      createElement = module.createElement;
      useContext = module.useContext;
      useMemo = module.useMemo;
    }],
    execute: (function () {

      exports('default', createContext);

      function createContext() {
        const ZustandContext = createContext$1(void 0);
        const Provider = ({
          initialStore,
          createStore,
          children
        }) => {
          const storeRef = useRef();
          if (!storeRef.current) {
            if (initialStore) {
              console.warn("Provider initialStore is deprecated and will be removed in the next version.");
              if (!createStore) {
                createStore = () => initialStore;
              }
            }
            storeRef.current = createStore();
          }
          return createElement(ZustandContext.Provider, { value: storeRef.current }, children);
        };
        const useStore = (selector, equalityFn = Object.is) => {
          const useProviderStore = useContext(ZustandContext);
          if (!useProviderStore) {
            throw new Error("Seems like you have not used zustand provider as an ancestor.");
          }
          return useProviderStore(selector, equalityFn);
        };
        const useStoreApi = () => {
          const useProviderStore = useContext(ZustandContext);
          if (!useProviderStore) {
            throw new Error("Seems like you have not used zustand provider as an ancestor.");
          }
          return useMemo(() => ({
            getState: useProviderStore.getState,
            setState: useProviderStore.setState,
            subscribe: useProviderStore.subscribe,
            destroy: useProviderStore.destroy
          }), [useProviderStore]);
        };
        return {
          Provider,
          useStore,
          useStoreApi
        };
      }

    })
  };
}));
