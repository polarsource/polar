import * as React from 'react';
import { Text3D } from './Text3D.js';
import { Center } from './Center.js';

/* eslint react-hooks/exhaustive-deps: 1 */
/**
 * A simple counter example component. Click to increment, meta-click to decrement.
 */
const Example = /* @__PURE__ */React.forwardRef(({
  font,
  color = '#cbcbcb',
  bevelSize = 0.04,
  debug = false,
  children,
  ...props
}, fref) => {
  const [counter, setCounter] = React.useState(0);
  const incr = React.useCallback((x = 1) => setCounter(counter + x), [counter]);
  const decr = React.useCallback((x = 1) => setCounter(counter - x), [counter]);

  // ref-API
  const api = React.useMemo(() => ({
    incr,
    decr
  }), [incr, decr]);
  React.useImperativeHandle(fref, () => api, [api]);
  return /*#__PURE__*/React.createElement("group", props, /*#__PURE__*/React.createElement(React.Suspense, {
    fallback: null
  }, /*#__PURE__*/React.createElement(Center, {
    top: true,
    cacheKey: JSON.stringify({
      counter,
      font
    })
  }, /*#__PURE__*/React.createElement(Text3D, {
    bevelEnabled: true,
    bevelSize: bevelSize,
    font: font
  }, debug ? /*#__PURE__*/React.createElement("meshNormalMaterial", {
    wireframe: true
  }) : /*#__PURE__*/React.createElement("meshStandardMaterial", {
    color: color
  }), counter))), children);
});

export { Example };
