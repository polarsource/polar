import * as React from 'react';

function call(ref, value) {
  if (typeof ref === 'function') ref(value);else if (ref != null) ref.current = value;
}
function useEffectfulState(fn, deps = [], cb) {
  const [state, set] = React.useState();
  React.useLayoutEffect(() => {
    const value = fn();
    set(value);
    call(cb, value);
    return () => call(cb, null);
  }, deps);
  return state;
}

export { useEffectfulState };
