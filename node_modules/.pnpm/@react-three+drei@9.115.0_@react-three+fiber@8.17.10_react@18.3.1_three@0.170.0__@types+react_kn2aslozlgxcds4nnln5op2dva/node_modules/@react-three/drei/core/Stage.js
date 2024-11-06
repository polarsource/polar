import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Environment } from './Environment.js';
import { ContactShadows } from './ContactShadows.js';
import { Center } from './Center.js';
import { AccumulativeShadows, RandomizedLight } from './AccumulativeShadows.js';
import { Bounds, useBounds } from './Bounds.js';

const presets = {
  rembrandt: {
    main: [1, 2, 1],
    fill: [-2, -0.5, -2]
  },
  portrait: {
    main: [-1, 2, 0.5],
    fill: [-1, 0.5, -1.5]
  },
  upfront: {
    main: [0, 2, 1],
    fill: [-1, 0.5, -1.5]
  },
  soft: {
    main: [-2, 4, 4],
    fill: [-1, 0.5, -1.5]
  }
};
function Refit({
  radius,
  adjustCamera
}) {
  const api = useBounds();
  React.useEffect(() => {
    if (adjustCamera) api.refresh().clip().fit();
  }, [radius, adjustCamera]);
  return null;
}
function Stage({
  children,
  center,
  adjustCamera = true,
  intensity = 0.5,
  shadows = 'contact',
  environment = 'city',
  preset = 'rembrandt',
  ...props
}) {
  var _bias, _normalBias, _size, _offset, _amount, _radius, _ambient, _intensity;
  const config = typeof preset === 'string' ? presets[preset] : preset;
  const [{
    radius,
    height
  }, set] = React.useState({
    radius: 0,
    width: 0,
    height: 0,
    depth: 0
  });
  const shadowBias = (_bias = shadows == null ? void 0 : shadows.bias) !== null && _bias !== void 0 ? _bias : -0.0001;
  const normalBias = (_normalBias = shadows == null ? void 0 : shadows.normalBias) !== null && _normalBias !== void 0 ? _normalBias : 0;
  const shadowSize = (_size = shadows == null ? void 0 : shadows.size) !== null && _size !== void 0 ? _size : 1024;
  const shadowOffset = (_offset = shadows == null ? void 0 : shadows.offset) !== null && _offset !== void 0 ? _offset : 0;
  const contactShadow = shadows === 'contact' || (shadows == null ? void 0 : shadows.type) === 'contact';
  const accumulativeShadow = shadows === 'accumulative' || (shadows == null ? void 0 : shadows.type) === 'accumulative';
  const shadowSpread = {
    ...(typeof shadows === 'object' ? shadows : {})
  };
  const environmentProps = !environment ? null : typeof environment === 'string' ? {
    preset: environment
  } : environment;
  const onCentered = React.useCallback(props => {
    const {
      width,
      height,
      depth,
      boundingSphere
    } = props;
    set({
      radius: boundingSphere.radius,
      width,
      height,
      depth
    });
    if (center != null && center.onCentered) center.onCentered(props);
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ambientLight", {
    intensity: intensity / 3
  }), /*#__PURE__*/React.createElement("spotLight", {
    penumbra: 1,
    position: [config.main[0] * radius, config.main[1] * radius, config.main[2] * radius],
    intensity: intensity * 2,
    castShadow: !!shadows,
    "shadow-bias": shadowBias,
    "shadow-normalBias": normalBias,
    "shadow-mapSize": shadowSize
  }), /*#__PURE__*/React.createElement("pointLight", {
    position: [config.fill[0] * radius, config.fill[1] * radius, config.fill[2] * radius],
    intensity: intensity
  }), /*#__PURE__*/React.createElement(Bounds, _extends({
    fit: !!adjustCamera,
    clip: !!adjustCamera,
    margin: Number(adjustCamera),
    observe: true
  }, props), /*#__PURE__*/React.createElement(Refit, {
    radius: radius,
    adjustCamera: adjustCamera
  }), /*#__PURE__*/React.createElement(Center, _extends({}, center, {
    position: [0, shadowOffset / 2, 0],
    onCentered: onCentered
  }), children)), /*#__PURE__*/React.createElement("group", {
    position: [0, -height / 2 - shadowOffset / 2, 0]
  }, contactShadow && /*#__PURE__*/React.createElement(ContactShadows, _extends({
    scale: radius * 4,
    far: radius,
    blur: 2
  }, shadowSpread)), accumulativeShadow && /*#__PURE__*/React.createElement(AccumulativeShadows, _extends({
    temporal: true,
    frames: 100,
    alphaTest: 0.9,
    toneMapped: true,
    scale: radius * 4
  }, shadowSpread), /*#__PURE__*/React.createElement(RandomizedLight, {
    amount: (_amount = shadowSpread.amount) !== null && _amount !== void 0 ? _amount : 8,
    radius: (_radius = shadowSpread.radius) !== null && _radius !== void 0 ? _radius : radius,
    ambient: (_ambient = shadowSpread.ambient) !== null && _ambient !== void 0 ? _ambient : 0.5,
    intensity: (_intensity = shadowSpread.intensity) !== null && _intensity !== void 0 ? _intensity : 1,
    position: [config.main[0] * radius, config.main[1] * radius, config.main[2] * radius],
    size: radius * 4,
    bias: -shadowBias,
    mapSize: shadowSize
  }))), environment && /*#__PURE__*/React.createElement(Environment, environmentProps));
}

export { Stage };
