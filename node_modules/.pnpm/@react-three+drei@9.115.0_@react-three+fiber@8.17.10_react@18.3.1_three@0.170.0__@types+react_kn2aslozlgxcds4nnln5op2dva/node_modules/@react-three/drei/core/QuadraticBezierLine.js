import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { QuadraticBezierCurve3, Vector3 } from 'three';
import { Line } from './Line.js';

const v = /* @__PURE__ */new Vector3();
const QuadraticBezierLine = /* @__PURE__ */React.forwardRef(function QuadraticBezierLine({
  start = [0, 0, 0],
  end = [0, 0, 0],
  mid,
  segments = 20,
  ...rest
}, forwardref) {
  const ref = React.useRef(null);
  React.useImperativeHandle(forwardref, () => ref.current);
  const [curve] = React.useState(() => new QuadraticBezierCurve3(undefined, undefined, undefined));
  const getPoints = React.useCallback((start, end, mid, segments = 20) => {
    if (start instanceof Vector3) curve.v0.copy(start);else curve.v0.set(...start);
    if (end instanceof Vector3) curve.v2.copy(end);else curve.v2.set(...end);
    if (mid instanceof Vector3) {
      curve.v1.copy(mid);
    } else if (Array.isArray(mid)) {
      curve.v1.set(...mid);
    } else {
      curve.v1.copy(curve.v0.clone().add(curve.v2.clone().sub(curve.v0)).add(v.set(0, curve.v0.y - curve.v2.y, 0)));
    }
    return curve.getPoints(segments);
  }, []);
  React.useLayoutEffect(() => {
    ref.current.setPoints = (start, end, mid) => {
      const points = getPoints(start, end, mid);
      if (ref.current.geometry) ref.current.geometry.setPositions(points.map(p => p.toArray()).flat());
    };
  }, []);
  const points = React.useMemo(() => getPoints(start, end, mid, segments), [start, end, mid, segments]);
  return /*#__PURE__*/React.createElement(Line, _extends({
    ref: ref,
    points: points
  }, rest));
});

export { QuadraticBezierLine };
