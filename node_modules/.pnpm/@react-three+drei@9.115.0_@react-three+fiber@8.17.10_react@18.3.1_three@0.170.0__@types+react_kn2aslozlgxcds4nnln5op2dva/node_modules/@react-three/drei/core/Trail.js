import { useFrame, useThree, createPortal } from '@react-three/fiber';
import * as React from 'react';
import { Vector3, Object3D, Vector2 } from 'three';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

const defaults = {
  width: 0.2,
  length: 1,
  decay: 1,
  local: false,
  stride: 0,
  interval: 1
};
const shiftLeft = (collection, steps = 1) => {
  collection.set(collection.subarray(steps));
  collection.fill(-Infinity, -steps);
  return collection;
};
function useTrail(target, settings) {
  const {
    length,
    local,
    decay,
    interval,
    stride
  } = {
    ...defaults,
    ...settings
  };
  const points = React.useRef();
  const [worldPosition] = React.useState(() => new Vector3());
  React.useLayoutEffect(() => {
    if (target) {
      points.current = Float32Array.from({
        length: length * 10 * 3
      }, (_, i) => target.position.getComponent(i % 3));
    }
  }, [length, target]);
  const prevPosition = React.useRef(new Vector3());
  const frameCount = React.useRef(0);
  useFrame(() => {
    if (!target) return;
    if (!points.current) return;
    if (frameCount.current === 0) {
      let newPosition;
      if (local) {
        newPosition = target.position;
      } else {
        target.getWorldPosition(worldPosition);
        newPosition = worldPosition;
      }
      const steps = 1 * decay;
      for (let i = 0; i < steps; i++) {
        if (newPosition.distanceTo(prevPosition.current) < stride) continue;
        shiftLeft(points.current, 3);
        points.current.set(newPosition.toArray(), points.current.length - 3);
      }
      prevPosition.current.copy(newPosition);
    }
    frameCount.current++;
    frameCount.current = frameCount.current % interval;
  });
  return points;
}
const Trail = /* @__PURE__ */React.forwardRef((props, forwardRef) => {
  const {
    children
  } = props;
  const {
    width,
    length,
    decay,
    local,
    stride,
    interval
  } = {
    ...defaults,
    ...props
  };
  const {
    color = 'hotpink',
    attenuation,
    target
  } = props;
  const size = useThree(s => s.size);
  const scene = useThree(s => s.scene);
  const ref = React.useRef(null);
  const [anchor, setAnchor] = React.useState(null);
  const points = useTrail(anchor, {
    length,
    decay,
    local,
    stride,
    interval
  });
  React.useEffect(() => {
    const t = (target == null ? void 0 : target.current) || ref.current.children.find(o => {
      return o instanceof Object3D;
    });
    if (t) {
      setAnchor(t);
    }
  }, [points, target]);
  const geo = React.useMemo(() => new MeshLineGeometry(), []);
  const mat = React.useMemo(() => {
    var _matOverride;
    const m = new MeshLineMaterial({
      lineWidth: 0.1 * width,
      color: color,
      sizeAttenuation: 1,
      resolution: new Vector2(size.width, size.height)
    });

    // Get and apply first <meshLineMaterial /> from children
    let matOverride;
    if (children) {
      if (Array.isArray(children)) {
        matOverride = children.find(child => {
          const c = child;
          return typeof c.type === 'string' && c.type === 'meshLineMaterial';
        });
      } else {
        const c = children;
        if (typeof c.type === 'string' && c.type === 'meshLineMaterial') {
          matOverride = c;
        }
      }
    }
    if (typeof ((_matOverride = matOverride) == null ? void 0 : _matOverride.props) === 'object') {
      m.setValues(matOverride.props);
    }
    return m;
  }, [width, color, size, children]);
  React.useEffect(() => {
    mat.uniforms.resolution.value.set(size.width, size.height);
  }, [size]);
  useFrame(() => {
    if (!points.current) return;
    geo.setPoints(points.current, attenuation);
  });
  return /*#__PURE__*/React.createElement("group", null, createPortal( /*#__PURE__*/React.createElement("mesh", {
    ref: forwardRef,
    geometry: geo,
    material: mat
  }), scene), /*#__PURE__*/React.createElement("group", {
    ref: ref
  }, children));
});

export { Trail, useTrail };
