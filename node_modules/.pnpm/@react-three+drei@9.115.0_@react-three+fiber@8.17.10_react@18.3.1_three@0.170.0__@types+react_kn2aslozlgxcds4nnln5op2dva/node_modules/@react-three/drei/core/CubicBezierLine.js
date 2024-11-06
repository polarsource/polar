import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Vector3, CubicBezierCurve3 } from 'three';
import { Line } from './Line.js';

const CubicBezierLine = /* @__PURE__ */React.forwardRef(function CubicBezierLine({
  start,
  end,
  midA,
  midB,
  segments = 20,
  ...rest
}, ref) {
  const points = React.useMemo(() => {
    const startV = start instanceof Vector3 ? start : new Vector3(...start);
    const endV = end instanceof Vector3 ? end : new Vector3(...end);
    const midAV = midA instanceof Vector3 ? midA : new Vector3(...midA);
    const midBV = midB instanceof Vector3 ? midB : new Vector3(...midB);
    const interpolatedV = new CubicBezierCurve3(startV, midAV, midBV, endV).getPoints(segments);
    return interpolatedV;
  }, [start, end, midA, midB, segments]);
  return /*#__PURE__*/React.createElement(Line, _extends({
    ref: ref,
    points: points
  }, rest));
});

export { CubicBezierLine };
