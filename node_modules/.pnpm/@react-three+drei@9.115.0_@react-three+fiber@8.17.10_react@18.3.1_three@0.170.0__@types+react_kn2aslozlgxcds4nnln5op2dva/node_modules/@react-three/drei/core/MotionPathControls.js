import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { misc, easing } from 'maath';

const isObject3DRef = ref => (ref == null ? void 0 : ref.current) instanceof THREE.Object3D;
const context = /* @__PURE__ */React.createContext(null);
function useMotion() {
  return React.useContext(context);
}
function Debug({
  points = 50
}) {
  const {
    path
  } = useMotion();
  const [dots, setDots] = React.useState([]);
  const [material] = React.useState(() => new THREE.MeshBasicMaterial({
    color: 'black'
  }));
  const [geometry] = React.useState(() => new THREE.SphereGeometry(0.025, 16, 16));
  const last = React.useRef([]);
  React.useEffect(() => {
    if (path.curves !== last.current) {
      setDots(path.getPoints(points));
      last.current = path.curves;
    }
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, dots.map((item, index) => /*#__PURE__*/React.createElement("mesh", {
    key: index,
    material: material,
    geometry: geometry,
    position: [item.x, item.y, item.z]
  })));
}
const MotionPathControls = /* @__PURE__ */React.forwardRef(({
  children,
  curves = [],
  object,
  debug = false,
  smooth = false,
  focus,
  offset = undefined,
  eps = 0.00001,
  damping = 0.1,
  focusDamping = 0.1,
  maxSpeed = Infinity,
  ...props
}, fref) => {
  const {
    camera
  } = useThree();
  const ref = React.useRef();
  const [path] = React.useState(() => new THREE.CurvePath());
  const pos = React.useRef(offset !== null && offset !== void 0 ? offset : 0);
  const state = React.useMemo(() => ({
    focus,
    object: (object == null ? void 0 : object.current) instanceof THREE.Object3D ? object : {
      current: camera
    },
    path,
    current: pos.current,
    offset: pos.current,
    point: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    next: new THREE.Vector3()
  }), [focus, object]);
  React.useLayoutEffect(() => {
    var _ref$current;
    path.curves = [];
    const _curves = curves.length > 0 ? curves : (_ref$current = ref.current) == null ? void 0 : _ref$current.__r3f.objects;
    for (var i = 0; i < _curves.length; i++) path.add(_curves[i]);

    //Smoothen curve
    if (smooth) {
      const points = path.getPoints(typeof smooth === 'number' ? smooth : 1);
      const catmull = new THREE.CatmullRomCurve3(points);
      path.curves = [catmull];
    }
    path.updateArcLengths();
  });
  React.useImperativeHandle(fref, () => ref.current, []);
  React.useLayoutEffect(() => {
    // When offset changes, normalise pos to avoid overshoot spinning
    pos.current = misc.repeat(pos.current, 1);
  }, [offset]);
  let last = 0;
  const [vec] = React.useState(() => new THREE.Vector3());
  useFrame((_state, delta) => {
    last = state.offset;
    easing.damp(pos, 'current', offset !== undefined ? offset : state.current, damping, delta, maxSpeed, undefined, eps);
    state.offset = misc.repeat(pos.current, 1);
    if (path.getCurveLengths().length > 0) {
      path.getPointAt(state.offset, state.point);
      path.getTangentAt(state.offset, state.tangent).normalize();
      path.getPointAt(misc.repeat(pos.current - (last - state.offset), 1), state.next);
      const target = (object == null ? void 0 : object.current) instanceof THREE.Object3D ? object.current : camera;
      target.position.copy(state.point);
      //@ts-ignore
      if (focus) {
        easing.dampLookAt(target, isObject3DRef(focus) ? focus.current.getWorldPosition(vec) : focus, focusDamping, delta, maxSpeed, undefined, eps);
      }
    }
  });
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, props), /*#__PURE__*/React.createElement(context.Provider, {
    value: state
  }, children, debug && /*#__PURE__*/React.createElement(Debug, null)));
});

export { MotionPathControls, useMotion };
