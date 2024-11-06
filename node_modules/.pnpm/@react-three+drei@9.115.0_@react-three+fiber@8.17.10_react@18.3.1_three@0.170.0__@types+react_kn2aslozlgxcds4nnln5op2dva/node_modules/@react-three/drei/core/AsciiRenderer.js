import * as React from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { AsciiEffect } from 'three-stdlib';

function AsciiRenderer({
  renderIndex = 1,
  bgColor = 'black',
  fgColor = 'white',
  characters = ' .:-+*=%@#',
  invert = true,
  color = false,
  resolution = 0.15
}) {
  // Reactive state
  const {
    size,
    gl,
    scene,
    camera
  } = useThree();

  // Create effect
  const effect = React.useMemo(() => {
    const effect = new AsciiEffect(gl, characters, {
      invert,
      color,
      resolution
    });
    effect.domElement.style.position = 'absolute';
    effect.domElement.style.top = '0px';
    effect.domElement.style.left = '0px';
    effect.domElement.style.pointerEvents = 'none';
    return effect;
  }, [characters, invert, color, resolution]);

  // Styling
  React.useLayoutEffect(() => {
    effect.domElement.style.color = fgColor;
    effect.domElement.style.backgroundColor = bgColor;
  }, [fgColor, bgColor]);

  // Append on mount, remove on unmount
  React.useEffect(() => {
    gl.domElement.style.opacity = '0';
    gl.domElement.parentNode.appendChild(effect.domElement);
    return () => {
      gl.domElement.style.opacity = '1';
      gl.domElement.parentNode.removeChild(effect.domElement);
    };
  }, [effect]);

  // Set size
  React.useEffect(() => {
    effect.setSize(size.width, size.height);
  }, [effect, size]);

  // Take over render-loop (that is what the index is for)
  useFrame(state => {
    effect.render(scene, camera);
  }, renderIndex);

  // return something to not break type signatures
  return /*#__PURE__*/React.createElement(React.Fragment, null);
}

export { AsciiRenderer };
