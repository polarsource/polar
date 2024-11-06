import * as THREE from 'three';
import * as React from 'react';
import { useThree, createPortal, useFrame } from '@react-three/fiber';

function RenderHud({
  defaultScene,
  defaultCamera,
  renderPriority = 1
}) {
  const {
    gl,
    scene,
    camera
  } = useThree();
  let oldCLear;
  useFrame(() => {
    oldCLear = gl.autoClear;
    if (renderPriority === 1) {
      // Clear scene and render the default scene
      gl.autoClear = true;
      gl.render(defaultScene, defaultCamera);
    }
    // Disable cleaning and render the portal with its own camera
    gl.autoClear = false;
    gl.clearDepth();
    gl.render(scene, camera);
    // Restore default
    gl.autoClear = oldCLear;
  }, renderPriority);
  // Without an element that receives pointer events state.pointer will always be 0/0
  return /*#__PURE__*/React.createElement("group", {
    onPointerOver: () => null
  });
}
function Hud({
  children,
  renderPriority = 1
}) {
  const {
    scene: defaultScene,
    camera: defaultCamera
  } = useThree();
  const [hudScene] = React.useState(() => new THREE.Scene());
  return /*#__PURE__*/React.createElement(React.Fragment, null, createPortal( /*#__PURE__*/React.createElement(React.Fragment, null, children, /*#__PURE__*/React.createElement(RenderHud, {
    defaultScene: defaultScene,
    defaultCamera: defaultCamera,
    renderPriority: renderPriority
  })), hudScene, {
    events: {
      priority: renderPriority + 1
    }
  }));
}

export { Hud };
