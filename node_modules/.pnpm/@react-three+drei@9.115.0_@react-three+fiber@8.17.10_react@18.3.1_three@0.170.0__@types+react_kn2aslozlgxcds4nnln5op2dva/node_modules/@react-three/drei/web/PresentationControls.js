import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { MathUtils } from 'three';
import { useThree } from '@react-three/fiber';
import { useSpring, a } from '@react-spring/three';
import { useGesture } from '@use-gesture/react';

function PresentationControls({
  enabled = true,
  snap,
  global,
  domElement,
  cursor = true,
  children,
  speed = 1,
  rotation = [0, 0, 0],
  zoom = 1,
  polar = [0, Math.PI / 2],
  azimuth = [-Infinity, Infinity],
  config = {
    mass: 1,
    tension: 170,
    friction: 26
  }
}) {
  const events = useThree(state => state.events);
  const gl = useThree(state => state.gl);
  const explDomElement = domElement || events.connected || gl.domElement;
  const {
    size
  } = useThree();
  const rPolar = React.useMemo(() => [rotation[0] + polar[0], rotation[0] + polar[1]], [rotation[0], polar[0], polar[1]]);
  const rAzimuth = React.useMemo(() => [rotation[1] + azimuth[0], rotation[1] + azimuth[1]], [rotation[1], azimuth[0], azimuth[1]]);
  const rInitial = React.useMemo(() => [MathUtils.clamp(rotation[0], ...rPolar), MathUtils.clamp(rotation[1], ...rAzimuth), rotation[2]], [rotation[0], rotation[1], rotation[2], rPolar, rAzimuth]);
  const [spring, api] = useSpring(() => ({
    scale: 1,
    rotation: rInitial,
    config
  }));
  React.useEffect(() => void api.start({
    scale: 1,
    rotation: rInitial,
    config
  }), [rInitial]);
  React.useEffect(() => {
    if (global && cursor && enabled) {
      explDomElement.style.cursor = 'grab';
      gl.domElement.style.cursor = '';
      return () => {
        explDomElement.style.cursor = 'default';
        gl.domElement.style.cursor = 'default';
      };
    }
  }, [global, cursor, explDomElement, enabled]);
  const bind = useGesture({
    onHover: ({
      last
    }) => {
      if (cursor && !global && enabled) explDomElement.style.cursor = last ? 'auto' : 'grab';
    },
    onDrag: ({
      down,
      delta: [x, y],
      memo: [oldY, oldX] = spring.rotation.animation.to || rInitial
    }) => {
      if (!enabled) return [y, x];
      if (cursor) explDomElement.style.cursor = down ? 'grabbing' : 'grab';
      x = MathUtils.clamp(oldX + x / size.width * Math.PI * speed, ...rAzimuth);
      y = MathUtils.clamp(oldY + y / size.height * Math.PI * speed, ...rPolar);
      const sConfig = snap && !down && typeof snap !== 'boolean' ? snap : config;
      api.start({
        scale: down && y > rPolar[1] / 2 ? zoom : 1,
        rotation: snap && !down ? rInitial : [y, x, 0],
        config: n => n === 'scale' ? {
          ...sConfig,
          friction: sConfig.friction * 3
        } : sConfig
      });
      return [y, x];
    }
  }, {
    target: global ? explDomElement : undefined
  });
  return /*#__PURE__*/React.createElement(a.group, _extends({}, bind == null ? void 0 : bind(), spring), children);
}

export { PresentationControls };
