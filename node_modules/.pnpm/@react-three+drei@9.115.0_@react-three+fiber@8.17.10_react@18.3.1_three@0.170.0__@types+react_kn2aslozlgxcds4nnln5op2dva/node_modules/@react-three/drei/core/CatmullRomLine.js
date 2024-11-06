import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Vector3, CatmullRomCurve3, Color } from 'three';
import { Line } from './Line.js';

const CatmullRomLine = /* @__PURE__ */React.forwardRef(function CatmullRomLine({
  points,
  closed = false,
  curveType = 'centripetal',
  tension = 0.5,
  segments = 20,
  vertexColors,
  ...rest
}, ref) {
  const curve = React.useMemo(() => {
    const mappedPoints = points.map(pt => pt instanceof Vector3 ? pt : new Vector3(...pt));
    return new CatmullRomCurve3(mappedPoints, closed, curveType, tension);
  }, [points, closed, curveType, tension]);
  const segmentedPoints = React.useMemo(() => curve.getPoints(segments), [curve, segments]);
  const interpolatedVertexColors = React.useMemo(() => {
    if (!vertexColors || vertexColors.length < 2) return undefined;
    if (vertexColors.length === segments + 1) return vertexColors;
    const mappedColors = vertexColors.map(color => color instanceof Color ? color : new Color(...color));
    if (closed) mappedColors.push(mappedColors[0].clone());
    const iColors = [mappedColors[0]];
    const divisions = segments / (mappedColors.length - 1);
    for (let i = 1; i < segments; i++) {
      const alpha = i % divisions / divisions;
      const colorIndex = Math.floor(i / divisions);
      iColors.push(mappedColors[colorIndex].clone().lerp(mappedColors[colorIndex + 1], alpha));
    }
    iColors.push(mappedColors[mappedColors.length - 1]);
    return iColors;
  }, [vertexColors, segments]);
  return /*#__PURE__*/React.createElement(Line, _extends({
    ref: ref,
    points: segmentedPoints,
    vertexColors: interpolatedVertexColors
  }, rest));
});

export { CatmullRomLine };
