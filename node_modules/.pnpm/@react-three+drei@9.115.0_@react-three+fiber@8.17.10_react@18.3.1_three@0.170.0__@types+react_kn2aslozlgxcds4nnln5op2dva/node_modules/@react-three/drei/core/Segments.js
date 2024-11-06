import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { extend, useFrame } from '@react-three/fiber';
import { Line2, LineMaterial, LineSegmentsGeometry } from 'three-stdlib';

const context = /* @__PURE__ */React.createContext(null);
const Segments = /* @__PURE__ */React.forwardRef((props, forwardedRef) => {
  React.useMemo(() => extend({
    SegmentObject
  }), []);
  const {
    limit = 1000,
    lineWidth = 1.0,
    children,
    ...rest
  } = props;
  const [segments, setSegments] = React.useState([]);
  const [line] = React.useState(() => new Line2());
  const [material] = React.useState(() => new LineMaterial());
  const [geometry] = React.useState(() => new LineSegmentsGeometry());
  const [resolution] = React.useState(() => new THREE.Vector2(512, 512));
  const [positions] = React.useState(() => Array(limit * 6).fill(0));
  const [colors] = React.useState(() => Array(limit * 6).fill(0));
  const api = React.useMemo(() => ({
    subscribe: ref => {
      setSegments(segments => [...segments, ref]);
      return () => setSegments(segments => segments.filter(item => item.current !== ref.current));
    }
  }), []);
  useFrame(() => {
    for (let i = 0; i < limit; i++) {
      var _segments$i;
      const segment = (_segments$i = segments[i]) == null ? void 0 : _segments$i.current;
      if (segment) {
        positions[i * 6 + 0] = segment.start.x;
        positions[i * 6 + 1] = segment.start.y;
        positions[i * 6 + 2] = segment.start.z;
        positions[i * 6 + 3] = segment.end.x;
        positions[i * 6 + 4] = segment.end.y;
        positions[i * 6 + 5] = segment.end.z;
        colors[i * 6 + 0] = segment.color.r;
        colors[i * 6 + 1] = segment.color.g;
        colors[i * 6 + 2] = segment.color.b;
        colors[i * 6 + 3] = segment.color.r;
        colors[i * 6 + 4] = segment.color.g;
        colors[i * 6 + 5] = segment.color.b;
      }
    }
    geometry.setColors(colors);
    geometry.setPositions(positions);
    line.computeLineDistances();
  });
  return /*#__PURE__*/React.createElement("primitive", {
    object: line,
    ref: forwardedRef
  }, /*#__PURE__*/React.createElement("primitive", {
    object: geometry,
    attach: "geometry"
  }), /*#__PURE__*/React.createElement("primitive", _extends({
    object: material,
    attach: "material",
    vertexColors: true,
    resolution: resolution,
    linewidth: lineWidth
  }, rest)), /*#__PURE__*/React.createElement(context.Provider, {
    value: api
  }, children));
});
class SegmentObject {
  constructor() {
    this.color = new THREE.Color('white');
    this.start = new THREE.Vector3(0, 0, 0);
    this.end = new THREE.Vector3(0, 0, 0);
  }
}
const normPos = pos => pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(...(typeof pos === 'number' ? [pos, pos, pos] : pos));
const Segment = /* @__PURE__ */React.forwardRef(({
  color,
  start,
  end
}, forwardedRef) => {
  const api = React.useContext(context);
  if (!api) throw 'Segment must used inside Segments component.';
  const ref = React.useRef(null);
  React.useImperativeHandle(forwardedRef, () => ref.current, []);
  React.useLayoutEffect(() => api.subscribe(ref), []);
  return /*#__PURE__*/React.createElement("segmentObject", {
    ref: ref,
    color: color,
    start: normPos(start),
    end: normPos(end)
  });
});

export { Segment, SegmentObject, Segments };
