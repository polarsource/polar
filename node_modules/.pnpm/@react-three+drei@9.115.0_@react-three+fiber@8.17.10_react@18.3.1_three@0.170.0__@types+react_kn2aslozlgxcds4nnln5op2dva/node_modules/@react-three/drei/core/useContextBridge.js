import * as React from 'react';

/* eslint-disable react-hooks/rules-of-hooks */
function useContextBridge(...contexts) {
  const cRef = React.useRef([]);
  cRef.current = contexts.map(context => React.useContext(context));
  return React.useMemo(() => ({
    children
  }) => contexts.reduceRight((acc, Context, i) => /*#__PURE__*/React.createElement(Context.Provider, {
    value: cRef.current[i],
    children: acc
  }), children
  /*
   * done this way in reference to:
   * https://github.com/DefinitelyTyped/DefinitelyTyped/issues/44572#issuecomment-625878049
   * https://github.com/microsoft/TypeScript/issues/14729
   */), []);
}

export { useContextBridge };
